import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { applyCors, requireAdmin } from '../_lib/auth.js';
import { applyRateLimit } from '../_lib/ratelimit.js';
import { validateTrimRanges } from '../_lib/trimRanges.js';

/**
 * Pide el recorte del receso de una grabación antes de archivarla.
 * Ver docs/RECORTE_RECESO_DESIGN.md.
 *
 * 1. Valida los tramos contra la duración REAL del video en Stream.
 * 2. Reclama la sala con un UPDATE condicional pending → trimming. Si el cron ya la
 *    tomó para archivarla completa (venció el plazo), afecta 0 filas y se rechaza.
 * 3. Pide al Worker que dispare la GitHub Action, que lee los tramos de la base.
 *    Si el Worker falla, la sala vuelve a pending para que se pueda reintentar.
 */

const BodySchema = z.object({
  live_id: z.string().uuid(),
  // La forma de cada tramo la valida validateTrimRanges, con mensajes para el admin.
  trim_ranges: z.array(z.unknown()).min(1).max(20),
});

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

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
    prefix: 'request-trim',
  });
  if (!ok) return;

  const parsed = BodySchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Falta live_id o los tramos a recortar' });
  }
  const { live_id, trim_ranges } = parsed.data;

  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  const apiToken = process.env.CLOUDFLARE_STREAM_API_TOKEN || process.env.CLOUDFLARE_API_TOKEN || process.env.CLOUDFLARE_STREAM_TOKEN;
  const workerUrl = process.env.ARCHIVE_WORKER_URL;
  const sharedSecret = process.env.ARCHIVE_SHARED_SECRET;
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !accountId || !apiToken || !workerUrl || !sharedSecret) {
    console.error('[request-trim] faltan variables de Supabase, Cloudflare o del Worker');
    return res.status(500).json({ error: 'Recorte no configurado en el servidor' });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // 1. Estado de la sala.
  const { data: live, error: liveErr } = await supabase
    .from('lives')
    .select('id, status, recording_review, recording_stream_uid, archived_at')
    .eq('id', live_id)
    .maybeSingle();
  if (liveErr) {
    console.error('[request-trim] no se pudo leer la sala:', liveErr);
    return res.status(502).json({ error: 'No se pudo consultar la sala; vuelve a intentarlo' });
  }
  if (!live) return res.status(404).json({ error: 'La sala no existe' });
  if (live.status !== 'ended') {
    return res.status(409).json({ error: 'La sala no está finalizada' });
  }
  if (live.archived_at || !live.recording_stream_uid) {
    return res.status(409).json({ error: 'La grabación ya se archivó; no se puede recortar' });
  }
  if (live.recording_review !== 'pending') {
    return res.status(409).json({
      error:
        live.recording_review === 'trimming'
          ? 'El recorte ya está en curso'
          : 'La grabación ya se está archivando completa',
    });
  }
  const videoUid: string = live.recording_stream_uid;

  // 2. Duración real del video en Stream. Tiene que estar listo: si OBS siguió
  //    emitiendo después de finalizar, la grabación todavía está creciendo.
  let durationSeconds: number;
  try {
    const cfRes = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${accountId}/stream/${encodeURIComponent(videoUid)}`,
      { headers: { Authorization: `Bearer ${apiToken}` } },
    );
    const cfData = (await cfRes.json().catch(() => null)) as {
      result?: { duration?: number; status?: { state?: string } };
    } | null;
    if (!cfRes.ok || !cfData?.result) {
      return res.status(502).json({ error: 'Cloudflare no devolvió la grabación' });
    }
    if (cfData.result.status?.state !== 'ready') {
      return res.status(409).json({ error: 'La grabación todavía se está procesando; vuelve a intentarlo en unos minutos' });
    }
    durationSeconds = Number(cfData.result.duration);
  } catch (err) {
    console.error('[request-trim] error consultando Stream:', err);
    return res.status(502).json({ error: 'No se pudo contactar a Cloudflare' });
  }

  const validation = validateTrimRanges(trim_ranges, durationSeconds);
  if (!validation.ok) {
    return res.status(400).json({ error: validation.error });
  }

  // 3. Reclamo condicional: exactamente uno entre este pedido y el cron.
  const { data: claimed, error: claimErr } = await supabase
    .from('lives')
    .update({ recording_review: 'trimming', trim_ranges: validation.ranges })
    .eq('id', live_id)
    .eq('recording_review', 'pending')
    .eq('recording_stream_uid', videoUid)
    .is('archived_at', null)
    .select('id');
  if (claimErr) {
    console.error('[request-trim] no se pudo reclamar la sala:', claimErr);
    return res.status(502).json({ error: 'No se pudo guardar el recorte; vuelve a intentarlo' });
  }
  if (!claimed || claimed.length !== 1) {
    return res.status(409).json({ error: 'La grabación cambió mientras tanto; actualiza la página' });
  }

  // 4. El Worker dispara la Action (el token de GitHub vive solo ahí).
  let dispatched = false;
  try {
    const workerRes = await fetch(workerUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Archive-Secret': sharedSecret },
      body: JSON.stringify({ action: 'trim', live_id, stream_video_uid: videoUid }),
    });
    dispatched = workerRes.ok;
    if (!dispatched) {
      console.error(`[request-trim] el Worker respondió ${workerRes.status}: ${await workerRes.text()}`);
    }
  } catch (err) {
    console.error('[request-trim] error llamando al Worker:', err);
  }

  if (!dispatched) {
    // Nadie va a procesar la sala: se devuelve a pending para que el admin reintente
    // (o, si nadie lo hace, el cron la archive completa al vencer el plazo).
    const { error: revertErr } = await supabase
      .from('lives')
      .update({ recording_review: 'pending', trim_ranges: null })
      .eq('id', live_id)
      .eq('recording_review', 'trimming')
      .is('archived_at', null);
    if (revertErr) console.error('[request-trim] no se pudo devolver la sala a pending:', revertErr);
    return res.status(502).json({ error: 'No se pudo iniciar el recorte; vuelve a intentarlo' });
  }

  return res.status(202).json({ ok: true, status: 'trimming', trim_ranges: validation.ranges });
}
