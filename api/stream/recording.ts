import type { VercelRequest, VercelResponse } from '@vercel/node';
import { z } from 'zod';
import { applyCors, requireAdmin } from '../_lib/auth.js';
import { applyRateLimit } from '../_lib/ratelimit.js';

const BodySchema = z.object({
  live_input_id: z.string().trim().min(8).max(128),
});

interface StreamVideo {
  uid: string;
  created?: string;
  duration?: number;
  status?: { state?: string };
  meta?: { name?: string };
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
  const { live_input_id } = parsed.data;

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

    // Grabación más reciente que ya esté lista (descarta la que sigue 'live-inprogress'
    // y las que todavía están procesando).
    const readyRecording = videos
      .filter(v => (v?.status?.state || '').toLowerCase() === 'ready')
      .sort((a, b) => new Date(b.created || 0).getTime() - new Date(a.created || 0).getTime())[0];

    if (!readyRecording) {
      return res.status(200).json({ recording_uid: null, message: 'No se encontró grabación lista para este Live Input. Cloudflare puede tardar unos minutos en procesarla.' });
    }

    const video = readyRecording;

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
    });
  } catch (error) {
    console.error("Server error:", error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
}
