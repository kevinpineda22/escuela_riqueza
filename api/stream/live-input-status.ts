import type { VercelRequest, VercelResponse } from '@vercel/node';
import { z } from 'zod';
import { applyCors, requireAuth } from '../_lib/auth';
import { applyRateLimit } from '../_lib/ratelimit';

const BodySchema = z.object({
  live_input_id: z.string().trim().min(8).max(128),
});

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (applyCors(req, res)) return;

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const user = await requireAuth(req, res);
  if (!user) return;

  // Polling cada 10s = ~6/min normal; damos margen para reconexiones.
  const ok = await applyRateLimit(req, res, user.id, {
    requests: 30,
    window: '1 m',
    prefix: 'live-input-status',
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
    return res.status(200).json({ connected: false, disabled: true });
  }

  try {
    const response = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${accountId}/stream/live_inputs/${encodeURIComponent(live_input_id)}`,
      {
        headers: {
          'Authorization': `Bearer ${apiToken}`,
          'Content-Type': 'application/json',
        },
      }
    );

    if (!response.ok) {
      return res.status(200).json({ connected: false });
    }

    const data = await response.json();
    const input = data?.result;
    const connected = input?.status?.connected === true;
    const meta = input?.meta || {};

    return res.status(200).json({
      connected,
      status: input?.status || null,
      name: meta.name || null,
    });
  } catch {
    return res.status(200).json({ connected: false });
  }
}
