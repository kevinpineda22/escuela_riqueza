import type { VercelRequest, VercelResponse } from '@vercel/node';
import { z } from 'zod';
import { applyCors, requireAdmin } from '../_lib/auth.js';
import { applyRateLimit } from '../_lib/ratelimit.js';

const BodySchema = z.object({
  live_input_id: z.string().trim().min(8).max(128),
  // Opcional: el admin eligió una grabación puntual de la lista en vez de la sugerida.
  video_uid: z.string().trim().min(8).max(128).optional(),
  // Fecha programada del vivo (ISO). Acota la búsqueda a las grabaciones de ESE día;
  // sin esto se mezclan las de todos los sábados que el Live Input acumula.
  starts_at: z.string().datetime({ offset: true }).optional(),
});

export interface StreamVideo {
  uid: string;
  created?: string;
  duration?: number;
  status?: { state?: string };
  meta?: { name?: string };
}

// Ventana alrededor de `starts_at` dentro de la cual una grabación "pertenece" al vivo.
// Amplia a propósito: el vivo puede arrancar antes de lo programado (pruebas de OBS)
// o extenderse mucho más de lo previsto.
const WINDOW_BEFORE_MS = 3 * 3600 * 1000;
const WINDOW_AFTER_MS = 12 * 3600 * 1000;

/**
 * Ordena las grabaciones listas de un Live Input, sugiriendo primero la correcta.
 *
 * Un Live Input acumula UN VIDEO POR CADA TRANSMISIÓN, de todos los días. Dos
 * incidentes definieron el criterio:
 * - 2026-09-05: elegir "la más reciente" vinculaba una reconexión de OBS de 15 min
 *   en vez del vivo de 3 h. → Dentro del día, la duración es la señal correcta.
 * - 2026-09-12: elegir "la más larga" a secas vinculó al vivo de ese día la
 *   grabación de dos semanas antes (4 h 10 m, todavía sin archivar). → Primero hay
 *   que acotar por fecha.
 *
 * Con `startsAt`: las grabaciones del día del vivo van primero (más larga a más
 * corta), y las de otros días después, también por duración. Sin `startsAt`, solo
 * por duración.
 */
export function sortReadyRecordings(videos: StreamVideo[], startsAt?: string | null): StreamVideo[] {
  const ready = videos.filter(v => (v?.status?.state || '').toLowerCase() === 'ready');
  const byDuration = (a: StreamVideo, b: StreamVideo) => (Number(b.duration) || 0) - (Number(a.duration) || 0);

  const start = startsAt ? Date.parse(startsAt) : NaN;
  if (!Number.isFinite(start)) return ready.sort(byDuration);

  const inWindow = (v: StreamVideo) => {
    const created = v.created ? Date.parse(v.created) : NaN;
    return Number.isFinite(created) && created >= start - WINDOW_BEFORE_MS && created <= start + WINDOW_AFTER_MS;
  };
  const sameDay = ready.filter(inWindow).sort(byDuration);
  const others = ready.filter(v => !inWindow(v)).sort(byDuration);
  return [...sameDay, ...others];
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (applyCors(req, res)) return;

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const admin = await requireAdmin(req, res);
  if (!admin) return;

  const ok = await applyRateLimit(req, res, admin.id, {
    requests: 10,
    window: '1 m',
    prefix: 'recording',
  });
  if (!ok) return;

  const parsed = BodySchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Falta live_input_id válido' });
  }
  const { live_input_id, video_uid, starts_at } = parsed.data;

  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  const apiToken = process.env.CLOUDFLARE_STREAM_API_TOKEN || process.env.CLOUDFLARE_API_TOKEN || process.env.CLOUDFLARE_STREAM_TOKEN;

  if (!accountId || !apiToken) {
    console.error("Missing Cloudflare credentials");
    return res.status(500).json({ error: 'Faltan credenciales de Cloudflare en el servidor' });
  }

  try {
    // Endpoint dedicado: lista las grabaciones (videos) de un Live Input.
    // Un Live Input tiene un video por cada transmisión. Si hay una transmisión
    // en curso, el primero viene con estado 'live-inprogress'; el resto son
    // grabaciones VOD reproducibles on-demand. Filtramos por 'ready' para
    // quedarnos solo con grabaciones ya procesadas.
    const response = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${accountId}/stream/live_inputs/${encodeURIComponent(live_input_id)}/videos`,
      {
        headers: {
          'Authorization': `Bearer ${apiToken}`,
          'Content-Type': 'application/json',
        },
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Cloudflare error:", response.status, errorText);
      return res.status(500).json({ error: 'Error al consultar Cloudflare Stream' });
    }

    const data = await response.json();
    const videos: StreamVideo[] = Array.isArray(data.result) ? data.result : [];

    const readyRecordings = sortReadyRecordings(videos, starts_at);

    if (readyRecordings.length === 0) {
      return res.status(200).json({
        recording_uid: null,
        recordings: [],
        message: 'No se encontró grabación lista para este Live Input. Cloudflare puede tardar unos minutos en procesarla.',
      });
    }

    // El admin puede elegir una puntual de la lista; si no, se sugiere la más larga.
    const chosen = video_uid
      ? readyRecordings.find(v => v.uid === video_uid)
      : readyRecordings[0];

    if (!chosen) {
      return res.status(404).json({ error: 'La grabación indicada no existe en este Live Input' });
    }

    const video = chosen;

    // Enable MP4 downloads for this video via Cloudflare API
    let downloadEnabled = false;
    try {
      const dlRes = await fetch(
        `https://api.cloudflare.com/client/v4/accounts/${accountId}/stream/${video.uid}/downloads`,
        { method: 'POST', headers: { 'Authorization': `Bearer ${apiToken}` } }
      );
      if (dlRes.ok) downloadEnabled = true;
    } catch { /* non-critical, continue */ }

    return res.status(200).json({
      recording_uid: video.uid,
      title: video.meta?.name || null,
      duration: video.duration,
      status: video.status?.state || null,
      downloadEnabled,
      // Lista completa para que el admin pueda corregir la sugerencia desde la UI.
      recordings: readyRecordings.map(v => ({
        uid: v.uid,
        created: v.created || null,
        duration: Number(v.duration) || 0,
        name: v.meta?.name || null,
      })),
    });
  } catch (error) {
    console.error("Server error:", error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
}
