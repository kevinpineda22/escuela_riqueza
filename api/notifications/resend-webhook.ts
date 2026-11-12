import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';

/**
 * Webhook de Resend: guarda qué pasó con cada correo en `email_deliveries`, que
 * es lo que /admin/users muestra a los admins (sql/migrate-email-deliveries.sql).
 *
 * NO es browser-facing: se autentica con la firma de Resend (RESEND_WEBHOOK_SECRET).
 * La firma se calcula sobre el cuerpo exacto, por eso se lee crudo.
 *
 * Resend reintenta si no respondemos 2xx y no garantiza el orden: repetir un
 * evento es inocuo y `record_email_event` decide el estado final.
 */
export const config = { api: { bodyParser: false } };

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const RESEND_API_KEY = process.env.RESEND_API_KEY || '';
const WEBHOOK_SECRET = process.env.RESEND_WEBHOOK_SECRET || '';

const EVENT_STATUS: Record<string, string> = {
  'email.sent': 'sent',
  'email.delivery_delayed': 'delivery_delayed',
  'email.delivered': 'delivered',
  'email.failed': 'failed',
  'email.suppressed': 'suppressed',
  'email.bounced': 'bounced',
  'email.complained': 'complained',
};

const MAX_DETAIL = 1000;

interface EmailEventData {
  email_id: string;
  to: string[];
  subject?: string;
  created_at: string;
  bounce?: { type?: string; subType?: string; message?: string; diagnosticCode?: string[] };
  failed?: { reason?: string };
  suppressed?: { message?: string };
}

async function readRawBody(req: VercelRequest): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : (chunk as Buffer));
  }
  return Buffer.concat(chunks).toString('utf-8');
}

/** Lo que dijo el servidor que rechazó el correo. El diagnóstico SMTP es lo más específico. */
function eventDetail(data: EmailEventData): string | null {
  const parts = data.bounce
    ? [data.bounce.message, ...(data.bounce.diagnosticCode ?? [])]
    : [data.failed?.reason, data.suppressed?.message];
  const detail = parts.filter(Boolean).join(' | ');
  return detail ? detail.slice(0, MAX_DETAIL) : null;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  if (!SUPABASE_URL || !SERVICE_KEY || !RESEND_API_KEY || !WEBHOOK_SECRET) {
    console.error('[notifications/resend-webhook] faltan variables de entorno');
    return res.status(503).json({ error: 'Not configured' });
  }

  const payload = await readRawBody(req);
  let event: { type: string; created_at: string; data: unknown };
  try {
    event = new Resend(RESEND_API_KEY).webhooks.verify({
      payload,
      headers: {
        id: String(req.headers['svix-id'] ?? ''),
        timestamp: String(req.headers['svix-timestamp'] ?? ''),
        signature: String(req.headers['svix-signature'] ?? ''),
      },
      webhookSecret: WEBHOOK_SECRET,
    });
  } catch {
    console.warn('[notifications/resend-webhook] firma inválida');
    return res.status(401).json({ error: 'Invalid signature' });
  }

  const status = EVENT_STATUS[event.type];
  if (!status) return res.status(200).json({ ok: true, action: 'ignored' });

  const data = event.data as EmailEventData;
  // Todos nuestros envíos llevan un solo destinatario.
  const recipient = data.to?.[0];
  if (!recipient) return res.status(200).json({ ok: true, action: 'no_recipient' });

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { error } = await supabase.rpc('record_email_event', {
    p_email_id: data.email_id,
    p_recipient: recipient,
    p_subject: data.subject ?? null,
    p_status: status,
    p_sent_at: data.created_at,
    p_event_at: event.created_at,
    p_bounce_type: data.bounce?.type ?? null,
    p_bounce_subtype: data.bounce?.subType ?? null,
    p_detail: eventDetail(data),
  });

  if (error) {
    // 5xx: Resend lo reintenta.
    console.error('[notifications/resend-webhook] error guardando', event.type, error);
    return res.status(500).json({ error: 'Store error' });
  }

  return res.status(200).json({ ok: true, action: 'recorded' });
}
