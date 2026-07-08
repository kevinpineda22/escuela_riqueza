import type { VercelRequest, VercelResponse } from '@vercel/node';
import { z } from 'zod';
import { applyCors, requireAdmin } from '../_lib/auth.js';
import { applyRateLimit } from '../_lib/ratelimit.js';

const BodySchema = z.object({
  live_id: z.string().uuid(),
  stream_video_uid: z.string().trim().min(8).max(128),
});

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
    prefix: 'archive-recording',
  });
  if (!ok) return;

  const parsed = BodySchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Falta live_id o stream_video_uid válido' });
  }
  const { live_id, stream_video_uid } = parsed.data;

  const workerUrl = process.env.ARCHIVE_WORKER_URL;
  const sharedSecret = process.env.ARCHIVE_SHARED_SECRET;
  if (!workerUrl || !sharedSecret) {
    console.error('Missing ARCHIVE_WORKER_URL / ARCHIVE_SHARED_SECRET');
    return res.status(500).json({ error: 'Archivado no configurado en el servidor' });
  }

  try {
    const workerRes = await fetch(workerUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Archive-Secret': sharedSecret,
      },
      body: JSON.stringify({ live_id, stream_video_uid }),
    });

    const data = await workerRes.json().catch(() => ({}));
    // Relayamos el status del Worker tal cual (200 archived / processing, o error).
    return res.status(workerRes.status).json(data);
  } catch (err) {
    console.error('Error llamando al Worker de archivado:', err);
    return res.status(502).json({ error: 'No se pudo contactar el servicio de archivado' });
  }
}
