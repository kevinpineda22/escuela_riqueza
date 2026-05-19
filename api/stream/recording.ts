import type { VercelRequest, VercelResponse } from '@vercel/node';
import { z } from 'zod';
import { applyCors, requireAdmin } from '../_lib/auth';
import { applyRateLimit } from '../_lib/ratelimit';

const BodySchema = z.object({
  live_input_id: z.string().trim().min(8).max(128),
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
    const response = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${accountId}/stream?type=live&live_input=${encodeURIComponent(live_input_id)}&per_page=1`,
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

    if (!data.result || data.result.length === 0) {
      return res.status(200).json({ recording_uid: null, message: 'No se encontró grabación para este Live Input. Cloudflare puede tardar unos minutos en procesarla.' });
    }

    const video = data.result[0];

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
