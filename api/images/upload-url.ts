import type { VercelRequest, VercelResponse } from '@vercel/node';
import { z } from 'zod';
import { applyCors, requireAdmin } from '../_lib/auth.js';
import { applyRateLimit } from '../_lib/ratelimit.js';

/**
 * Genera una "direct upload URL" de Cloudflare Images.
 * El cliente sube el archivo directo a Cloudflare (multipart/form-data) sin pasar por nuestro server.
 *
 * Docs: https://developers.cloudflare.com/images/upload-images/direct-creator-upload/
 *
 * Body:
 *   - purpose: "logo" | "banner" (futuro; solo se usa para metadata)
 *
 * Devuelve:
 *   - uploadURL: URL one-shot para hacer POST con el archivo (válida 30 min)
 *   - imageId:   ID que asignará Cloudflare al recurso
 *   - deliveryUrl: URL pública final una vez subida (https://imagedelivery.net/<hash>/<id>/public)
 */
const BodySchema = z.object({
  purpose: z.enum(['logo', 'banner']).default('logo'),
});

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (applyCors(req, res)) return;

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const admin = await requireAdmin(req, res);
  if (!admin) return;

  const ok = await applyRateLimit(req, res, admin.id, {
    requests: 5,
    window: '1 m',
    prefix: 'images-upload-url',
  });
  if (!ok) return;

  const parsed = BodySchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    return res.status(400).json({ error: 'Body inválido', issues: parsed.error.issues });
  }
  const { purpose } = parsed.data;

  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  const apiToken =
    process.env.CLOUDFLARE_IMAGES_API_TOKEN ||
    process.env.CLOUDFLARE_API_TOKEN ||
    process.env.CLOUDFLARE_STREAM_API_TOKEN;
  // Account hash de Cloudflare Images (visible en cualquier URL pública: imagedelivery.net/<HASH>/<id>/public)
  // Se puede setear como env o derivar; lo dejamos como env para no depender del fallback.
  const accountHash = process.env.CLOUDFLARE_IMAGES_ACCOUNT_HASH || 'HGkLNfdVjFNAti8ZHHgxtQ';

  if (!accountId || !apiToken) {
    console.error('Missing Cloudflare credentials for Images');
    return res
      .status(500)
      .json({ error: 'Faltan credenciales de Cloudflare Images en el servidor' });
  }

  try {
    const form = new URLSearchParams();
    form.append('requireSignedURLs', 'false');
    form.append(
      'metadata',
      JSON.stringify({ uploadedBy: admin.id, purpose, source: 'admin-panel' }),
    );

    const response = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${accountId}/images/v2/direct_upload`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiToken}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: form.toString(),
      },
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Cloudflare Images error:', response.status, errorText);
      return res
        .status(500)
        .json({ error: 'Fallo al solicitar URL de subida a Cloudflare Images' });
    }

    const data = (await response.json()) as {
      success: boolean;
      result?: { id: string; uploadURL: string };
      errors?: unknown;
    };

    if (!data.success || !data.result?.uploadURL || !data.result?.id) {
      console.error('Cloudflare Images bad response:', data);
      return res.status(500).json({ error: 'Respuesta inválida de Cloudflare Images' });
    }

    const imageId = data.result.id;
    const uploadURL = data.result.uploadURL;
    const deliveryUrl = `https://imagedelivery.net/${accountHash}/${imageId}/public`;

    return res.status(200).json({ uploadURL, imageId, deliveryUrl });
  } catch (error) {
    console.error('Server error (images upload-url):', error);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
}
