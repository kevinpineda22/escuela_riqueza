import type { VercelRequest, VercelResponse } from '@vercel/node';
import { timingSafeEqual } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';
import { z } from 'zod';
import { welcomeEmailHtml } from './_welcome-template.js';

/**
 * Dispatcher del correo de bienvenida.
 *
 * NO es browser-facing: lo llama un trigger de Postgres (pg_net) cuando un
 * usuario confirma su email (`auth.users.email_confirmed_at` pasa de null a
 * fecha). Por eso no hay CORS ni JWT: se autentica con un secreto compartido
 * (`NOTIFICATIONS_WEBHOOK_SECRET`) que el trigger manda en el header.
 *
 * Idempotencia: la tabla `notification_log` tiene una única
 * `(user_id, event_type, dedupe_key)`. Insertamos ANTES de enviar; si ya
 * existe, es que ya se mandó → no-op. Si el envío falla, borramos el registro
 * para que un reintento pueda volver a intentarlo. Ver sql/notifications-welcome.sql.
 */

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const WEBHOOK_SECRET = process.env.NOTIFICATIONS_WEBHOOK_SECRET || '';
const RESEND_API_KEY = process.env.RESEND_API_KEY || '';
const APP_URL = (process.env.APP_URL || 'https://escuela-riqueza.vercel.app').replace(/\/$/, '');
const EMAIL_FROM = process.env.EMAIL_FROM || 'Escuela de la Riqueza <onboarding@resend.dev>';

const bodySchema = z.object({
  user_id: z.string().uuid(),
  email: z.string().email(),
  full_name: z.string().nullish(),
  event_type: z.literal('welcome').default('welcome'),
});

function secretMatches(header: string | undefined): boolean {
  if (!header || !WEBHOOK_SECRET) return false;
  const a = Buffer.from(header);
  const b = Buffer.from(WEBHOOK_SECRET);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  if (!WEBHOOK_SECRET || !RESEND_API_KEY || !SUPABASE_URL || !SERVICE_KEY) {
    console.error('[notifications/welcome] missing env vars');
    return res.status(503).json({ error: 'Not configured' });
  }

  const secret = req.headers['x-webhook-secret'] as string | undefined;
  if (!secretMatches(secret)) {
    console.warn('[notifications/welcome] invalid secret');
    return res.status(401).json({ error: 'Invalid secret' });
  }

  const parsed = bodySchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid body', issues: parsed.error.issues });
  }
  const { user_id, email, full_name, event_type } = parsed.data;

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // 1) Idempotencia: reservar el envío. Si ya existe, ya se mandó.
  const { data: reserved, error: logErr } = await supabase
    .from('notification_log')
    .upsert(
      { user_id, event_type, dedupe_key: '' },
      { onConflict: 'user_id,event_type,dedupe_key', ignoreDuplicates: true },
    )
    .select('id');

  if (logErr) {
    console.error('[notifications/welcome] log error', logErr);
    return res.status(500).json({ error: 'Log error' });
  }
  if (!reserved || reserved.length === 0) {
    return res.status(200).json({ ok: true, action: 'already_sent' });
  }
  const logId = reserved[0]!.id;

  // 2) Enviar. El componente maneja firstName vacío ("¡Bienvenido!").
  const firstName = (full_name ?? '').trim().split(/\s+/)[0] ?? '';
  const resend = new Resend(RESEND_API_KEY);

  const { data, error } = await resend.emails.send({
    from: EMAIL_FROM,
    to: email,
    subject: '¡Bienvenido a la Escuela de la Riqueza!',
    html: welcomeEmailHtml({ firstName, ctaUrl: `${APP_URL}/dashboard` }),
  });

  // 3) Si falló el envío, liberar la reserva para permitir reintento.
  if (error) {
    console.error('[notifications/welcome] resend error', error);
    await supabase.from('notification_log').delete().eq('id', logId);
    return res.status(502).json({ error: 'Send failed' });
  }

  // 4) Guardar el id del proveedor para trazabilidad.
  await supabase
    .from('notification_log')
    .update({ provider_message_id: data?.id ?? null })
    .eq('id', logId);

  console.log('[notifications/welcome] sent to', email, 'id', data?.id);
  return res.status(200).json({ ok: true, action: 'sent', id: data?.id });
}
