import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  const apiToken = process.env.CLOUDFLARE_STREAM_API_TOKEN || process.env.CLOUDFLARE_API_TOKEN || process.env.CLOUDFLARE_STREAM_TOKEN;

  if (!accountId || !apiToken) {
    return res.status(500).json({ error: 'Faltan credenciales de Cloudflare' });
  }

  const { live_input_id } = req.body;
  if (!live_input_id) {
    return res.status(400).json({ error: 'Falta live_input_id' });
  }

  try {
    const response = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${accountId}/stream/live_inputs/${live_input_id}`,
      {
        headers: {
          'Authorization': `Bearer ${apiToken}`,
          'Content-Type': 'application/json',
        },
      }
    );

    if (!response.ok) {
      return res.status(200).json({ connected: false, error: 'No se pudo consultar estado' });
    }

    const data = await response.json();
    const input = data?.result;

    // Cloudflare Live Input status: null (idle) or connected (receiving data)
    const connected = input?.status?.connected === true;
    const meta = input?.meta || {};

    return res.status(200).json({
      connected,
      status: input?.status || null,
      name: meta.name || null,
    });
  } catch (error) {
    console.error("Server error:", error);
    return res.status(200).json({ connected: false, error: 'Error interno' });
  }
}
