import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

export const config = { api: { bodyParser: false } };

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const WEBHOOK_SECRET = process.env.CLOUDFLARE_WEBHOOK_SECRET || '';

const REPLAY_WINDOW_SECONDS = 300;

async function readRawBody(req: VercelRequest): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : (chunk as Buffer));
  }
  return Buffer.concat(chunks).toString('utf-8');
}

function verifySignature(rawBody: string, header: string | undefined, secret: string): boolean {
  if (!header || !secret) return false;

  const parts = header.split(',').reduce<Record<string, string>>((acc, p) => {
    const [k, v] = p.split('=');
    if (k && v) acc[k.trim()] = v.trim();
    return acc;
  }, {});

  const time = parts.time;
  const sig = parts.sig1;
  if (!time || !sig) return false;

  const age = Date.now() / 1000 - Number(time);
  if (!Number.isFinite(age) || Math.abs(age) > REPLAY_WINDOW_SECONDS) return false;

  const expected = createHmac('sha256', secret)
    .update(`${time}.${rawBody}`)
    .digest('hex');

  try {
    const expectedBuf = Buffer.from(expected, 'hex');
    const sigBuf = Buffer.from(sig, 'hex');
    if (expectedBuf.length !== sigBuf.length) return false;
    return timingSafeEqual(expectedBuf, sigBuf);
  } catch {
    return false;
  }
}

interface ParsedEvent {
  kind: 'live_connected' | 'live_disconnected' | 'recording_ready' | 'unknown';
  liveInputId?: string;
  videoUid?: string;
}

interface CloudflarePayload {
  event?: string;
  notificationName?: string;
  uid?: string;
  liveInput?: string;
  meta?: { name?: string; liveInputUid?: string };
  status?: string | { state?: string };
  video?: { uid?: string; liveInput?: string };
}

function parseEvent(payload: CloudflarePayload): ParsedEvent {
  const event = (payload?.event || payload?.notificationName || '').toLowerCase();
  const rawStatus = payload?.status;
  const statusStr =
    typeof rawStatus === 'string'
      ? rawStatus.toLowerCase()
      : (rawStatus?.state || '').toLowerCase();

  const liveInputId =
    payload?.video?.liveInput ||
    payload?.liveInput ||
    payload?.meta?.liveInputUid;

  const videoUid = payload?.video?.uid || (typeof rawStatus === 'object' ? payload?.uid : undefined);

  if (event.includes('connected') || statusStr === 'connected' || statusStr === 'live') {
    return { kind: 'live_connected', liveInputId };
  }
  if (event.includes('disconnected') || statusStr === 'disconnected' || statusStr === 'idle') {
    return { kind: 'live_disconnected', liveInputId };
  }
  if (statusStr === 'ready' && liveInputId && videoUid) {
    return { kind: 'recording_ready', liveInputId, videoUid };
  }
  return { kind: 'unknown' };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  if (!WEBHOOK_SECRET || !SUPABASE_URL || !SERVICE_KEY) {
    console.error('[cloudflare-webhook] missing env: WEBHOOK_SECRET, SUPABASE_URL or SERVICE_KEY');
    return res.status(503).json({ error: 'Webhook not configured' });
  }

  let rawBody: string;
  try {
    rawBody = await readRawBody(req);
  } catch (err) {
    console.error('[cloudflare-webhook] failed to read body', err);
    return res.status(400).json({ error: 'Could not read body' });
  }

  const sigHeader =
    (req.headers['webhook-signature'] as string | undefined) ||
    (req.headers['Webhook-Signature'] as unknown as string | undefined);

  if (!verifySignature(rawBody, sigHeader, WEBHOOK_SECRET)) {
    console.warn('[cloudflare-webhook] invalid signature');
    return res.status(401).json({ error: 'Invalid signature' });
  }

  let payload: CloudflarePayload;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return res.status(400).json({ error: 'Invalid JSON' });
  }

  const parsed = parseEvent(payload);
  console.log('[cloudflare-webhook] event:', parsed.kind, 'liveInput:', parsed.liveInputId);

  if (parsed.kind === 'unknown' || !parsed.liveInputId) {
    return res.status(200).json({ ok: true, action: 'noop' });
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  try {
    if (parsed.kind === 'live_connected') {
      const { data, error } = await supabase
        .from('lives')
        .update({ status: 'live', is_paused: false })
        .eq('stream_live_input_id', parsed.liveInputId)
        .eq('is_active', true)
        .eq('status', 'scheduled')
        .select('id');
      if (error) throw error;
      return res.status(200).json({ ok: true, action: 'set_live', affected: data?.length || 0 });
    }

    if (parsed.kind === 'live_disconnected') {
      const { data, error } = await supabase
        .from('lives')
        .update({ is_paused: true })
        .eq('stream_live_input_id', parsed.liveInputId)
        .eq('status', 'live')
        .eq('is_paused', false)
        .select('id');
      if (error) throw error;
      return res.status(200).json({ ok: true, action: 'mark_paused', affected: data?.length || 0 });
    }

    if (parsed.kind === 'recording_ready' && parsed.videoUid) {
      const { data, error } = await supabase
        .from('lives')
        .update({ recording_stream_uid: parsed.videoUid })
        .eq('stream_live_input_id', parsed.liveInputId)
        .is('recording_stream_uid', null)
        .select('id');
      if (error) throw error;
      return res.status(200).json({ ok: true, action: 'set_recording', affected: data?.length || 0 });
    }

    return res.status(200).json({ ok: true, action: 'noop' });
  } catch (err) {
    console.error('[cloudflare-webhook] DB error', err);
    return res.status(500).json({ error: 'Database error' });
  }
}
