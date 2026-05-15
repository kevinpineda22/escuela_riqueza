import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS headers for preflight
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, tus-resumable, upload-length, upload-metadata');
    return res.status(204).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  const apiToken = process.env.CLOUDFLARE_STREAM_API_TOKEN || process.env.CLOUDFLARE_API_TOKEN || process.env.CLOUDFLARE_STREAM_TOKEN;

  if (!accountId || !apiToken) {
    console.error("Missing Cloudflare credentials");
    return res.status(500).json({ error: 'Faltan credenciales de Cloudflare en el servidor' });
  }

  try {
    const maxDurationSeconds = 3600 * 4;
    const videoName = req.body?.name || undefined;

    const size = req.body?.size || req.headers['upload-length'];
    if (!size) {
      return res.status(400).json({ error: 'Falta el tamaño del archivo (req.body.size)' });
    }

    const metadata = [];
    if (videoName) {
      metadata.push(`name ${Buffer.from(videoName).toString('base64')}`);
    }
    metadata.push(`maxDurationSeconds ${Buffer.from(String(maxDurationSeconds)).toString('base64')}`);
    metadata.push(`requiresignedurls ${Buffer.from('false').toString('base64')}`);

    const response = await fetch(`https://api.cloudflare.com/client/v4/accounts/${accountId}/stream?direct_user=true`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiToken}`,
        'Tus-Resumable': '1.0.0',
        'Upload-Length': String(size),
        'Upload-Creator': 'escuela_riqueza_admin',
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
