import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  const apiToken = process.env.CLOUDFLARE_STREAM_API_TOKEN || process.env.CLOUDFLARE_API_TOKEN || process.env.CLOUDFLARE_STREAM_TOKEN;

  if (!accountId || !apiToken) {
    console.error("Missing Cloudflare credentials");
    return res.status(500).json({ error: 'Faltan credenciales de Cloudflare en el servidor' });
  }

  const { live_input_id } = req.body;
  if (!live_input_id) {
    return res.status(400).json({ error: 'Falta live_input_id' });
  }

  try {
    const response = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${accountId}/stream?type=live&live_input=${live_input_id}&per_page=1`,
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
    return res.status(200).json({
      recording_uid: video.uid,
      title: video.meta?.name || null,
      duration: video.duration,
      status: video.status?.state || null,
    });
  } catch (error) {
    console.error("Server error:", error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
}
