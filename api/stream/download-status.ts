import type { VercelRequest, VercelResponse } from '@vercel/node';
import { z } from 'zod';
import { applyCors, requireAdmin } from '../_lib/auth.js';
import { applyRateLimit } from '../_lib/ratelimit.js';

const BodySchema = z.object({
  video_uid: z.string().trim().min(8).max(128),
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
    prefix: 'download-status',
  });
  if (!ok) return;

  const parsed = BodySchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Falta video_uid válido' });
  }
  const { video_uid } = parsed.data;

  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  const apiToken = process.env.CLOUDFLARE_STREAM_API_TOKEN || process.env.CLOUDFLARE_API_TOKEN || process.env.CLOUDFLARE_STREAM_TOKEN;

  if (!accountId || !apiToken) {
    console.error("Missing Cloudflare credentials");
    return res.status(500).json({ error: 'Faltan credenciales de Cloudflare' });
  }

  const downloadsUrl = `https://api.cloudflare.com/client/v4/accounts/${accountId}/stream/${encodeURIComponent(video_uid)}/downloads`;
  const authHeaders = {
    'Authorization': `Bearer ${apiToken}`,
    'Content-Type': 'application/json',
  };

  try {
    // 1. Consultar el estado actual del MP4
    const response = await fetch(downloadsUrl, { headers: authHeaders });
    if (!response.ok) {
      return res.status(500).json({ error: 'Error al consultar Cloudflare' });
    }

    const data = await response.json();
    let defaultDl = data.result?.default;

    // 2. Si nunca se pidió la descarga, la habilitamos ahora (POST). Sin esto,
    //    Cloudflare nunca genera el MP4 y el cliente se queda "preparando" para siempre.
    if (!defaultDl) {
      const enableRes = await fetch(downloadsUrl, { method: 'POST', headers: authHeaders });
      if (enableRes.ok) {
        const enableData = await enableRes.json();
        defaultDl = enableData.result?.default;
      }
    }

    return res.status(200).json({
      status: defaultDl?.status || 'inprogress', // 'inprogress', 'ready', 'error'
      percentComplete: defaultDl?.percentComplete || 0,
      url: defaultDl?.url || null
    });
  } catch (error) {
    console.error("Server error:", error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
}
