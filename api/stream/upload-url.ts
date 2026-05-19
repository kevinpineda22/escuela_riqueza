import type { VercelRequest, VercelResponse } from '@vercel/node';
import { z } from 'zod';
import { applyCors, requireAdmin } from '../_lib/auth';
import { applyRateLimit } from '../_lib/ratelimit';

const BodySchema = z.object({
  size: z.coerce.number().int().positive().max(5_000_000_000), // 5 GB cap
  name: z.string().trim().min(1).max(200).optional(),
});

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (applyCors(req, res)) return;

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const admin = await requireAdmin(req, res);
  if (!admin) return;

  const ok = await applyRateLimit(req, res, admin.id, {
    requests: 3,
    window: '1 m',
    prefix: 'upload-url',
  });
  if (!ok) return;

  const sizeFromHeader = req.headers['upload-length'];
  const parsed = BodySchema.safeParse({
    size: req.body?.size ?? sizeFromHeader,
    name: req.body?.name,
  });
  if (!parsed.success) {
    return res.status(400).json({ error: 'Body inválido', issues: parsed.error.issues });
  }
  const { size, name: videoName } = parsed.data;

  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  const apiToken = process.env.CLOUDFLARE_STREAM_API_TOKEN || process.env.CLOUDFLARE_API_TOKEN || process.env.CLOUDFLARE_STREAM_TOKEN;

  if (!accountId || !apiToken) {
    console.error("Missing Cloudflare credentials");
    return res.status(500).json({ error: 'Faltan credenciales de Cloudflare en el servidor' });
  }

  try {
    const maxDurationSeconds = 3600 * 4;

    const metadata: string[] = [];
    if (videoName) {
      metadata.push(`name ${Buffer.from(videoName).toString('base64')}`);
    }
    metadata.push(`maxDurationSeconds ${Buffer.from(String(maxDurationSeconds)).toString('base64')}`);

    const response = await fetch(`https://api.cloudflare.com/client/v4/accounts/${accountId}/stream?direct_user=true`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiToken}`,
        'Tus-Resumable': '1.0.0',
        'Upload-Length': String(size),
        'Upload-Creator': `escuela_riqueza_admin:${admin.id}`,
        'Upload-Metadata': metadata.join(',')
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Cloudflare error:", response.status, errorText);
      return res.status(500).json({ error: 'Fallo al obtener URL de subida de Cloudflare' });
    }

    const uploadURL = response.headers.get('Location');
    const uid = response.headers.get('stream-media-id');

    if (!uploadURL || !uid) {
      console.error("Missing headers in Cloudflare response:", [...response.headers]);
      return res.status(500).json({ error: 'Cloudflare no devolvió la URL de subida TUS' });
    }

    return res.status(200).json({
      uploadURL,
      uid,
    });
  } catch (error) {
    console.error("Server error:", error);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
}
