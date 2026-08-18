import type { VercelRequest, VercelResponse } from '@vercel/node';
import { timingSafeEqual } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';
import { liveReminderHtml } from './_live-reminder-template.js';

/**
 * Recordatorio de lives VIP. A diferencia de la bienvenida (disparada por un
 * evento), esto es POR TIEMPO: lo llama un cron (pg_cron cada ~5 min, ver
 * sql/notifications-live-reminders.sql). Se autentica con el mismo secreto
 * compartido `NOTIFICATIONS_WEBHOOK_SECRET`.
 *
 * Flujo (fan-out a muchos usuarios):
 *   1. Busca lives que arrancan dentro de los próximos LEAD minutos.
 *   2. Por cada live, resuelve los usuarios elegibles según allowed_plans.
 *   3. Idempotencia por (user_id, 'live_reminder', live_id): reserva ANTES de
 *      enviar; solo manda a los recién reservados → nunca duplica, aunque el
 *      cron corra cada 5 min mientras el live sigue en la ventana.
 *   4. Envía uno por uno (resend.emails.send, que funciona en sandbox; el
 *      endpoint batch necesita dominio verificado). Si un envío falla, libera
 *      esa reserva para que el próximo cron reintente.
 */

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const WEBHOOK_SECRET = process.env.NOTIFICATIONS_WEBHOOK_SECRET || '';
const RESEND_API_KEY = process.env.RESEND_API_KEY || '';
const APP_URL = (process.env.APP_URL || 'https://escuela-riqueza.vercel.app').replace(/\/$/, '');
const EMAIL_FROM = process.env.EMAIL_FROM || 'Escuela de la Riqueza <onboarding@resend.dev>';
const LEAD_MINUTES = Number(process.env.LIVE_REMINDER_LEAD_MINUTES || '30');

interface LiveRow {
  id: string;
  title: string;
  starts_at: string;
  allowed_plans: string[] | null;
  required_plan: string | null;
}

interface ProfileRow {
  id: string;
  email: string | null;
  full_name: string | null;
}

function secretMatches(header: string | undefined): boolean {
  if (!header || !WEBHOOK_SECRET) return false;
  const a = Buffer.from(header);
  const b = Buffer.from(WEBHOOK_SECRET);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

function formatStartsAt(iso: string): string {
  return new Intl.DateTimeFormat('es-CO', {
    timeZone: 'America/Bogota',
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(new Date(iso));
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }
  if (!WEBHOOK_SECRET || !RESEND_API_KEY || !SUPABASE_URL || !SERVICE_KEY) {
    console.error('[live-reminders] missing env vars');
    return res.status(503).json({ error: 'Not configured' });
  }
  if (!secretMatches(req.headers['x-webhook-secret'] as string | undefined)) {
    return res.status(401).json({ error: 'Invalid secret' });
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const resend = new Resend(RESEND_API_KEY);

  const nowIso = new Date().toISOString();
  const untilIso = new Date(Date.now() + LEAD_MINUTES * 60_000).toISOString();

  const { data: lives, error: livesErr } = await supabase
    .from('lives')
    .select('id, title, starts_at, allowed_plans, required_plan')
    .eq('status', 'scheduled')
    .eq('is_active', true)
    .gt('starts_at', nowIso)
    .lte('starts_at', untilIso)
    .returns<LiveRow[]>();

  if (livesErr) {
    console.error('[live-reminders] lives query error', livesErr);
    return res.status(500).json({ error: 'DB error' });
  }
  if (!lives || lives.length === 0) {
    return res.status(200).json({ ok: true, lives: 0, sent: 0 });
  }

  let totalSent = 0;
  const sendErrors: string[] = [];

  for (const live of lives) {
    const plans =
      live.allowed_plans && live.allowed_plans.length > 0
        ? live.allowed_plans
        : live.required_plan
          ? [live.required_plan]
          : [];
    if (plans.length === 0) continue;

    // Usuarios con suscripción activa en alguno de los planes permitidos.
    const { data: subs } = await supabase
      .from('subscriptions')
      .select('user_id')
      .eq('status', 'active')
      .in('plan', plans);
    const userIds = [...new Set((subs ?? []).map((s) => s.user_id as string))];
    if (userIds.length === 0) continue;

    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, email, full_name')
      .in('id', userIds)
      .not('email', 'is', null)
      .returns<ProfileRow[]>();
    if (!profiles || profiles.length === 0) continue;

    // Reservar (idempotencia por live). Solo los recién insertados reciben correo.
    const rows = profiles.map((p) => ({
      user_id: p.id,
      event_type: 'live_reminder',
      dedupe_key: live.id,
    }));
    const { data: reserved, error: reserveErr } = await supabase
      .from('notification_log')
      .upsert(rows, { onConflict: 'user_id,event_type,dedupe_key', ignoreDuplicates: true })
      .select('user_id');
    if (reserveErr) {
      console.error('[live-reminders] reserve error', reserveErr);
      continue;
    }
    const newIds = new Set((reserved ?? []).map((r) => r.user_id as string));
    const recipients = profiles.filter((p) => newIds.has(p.id) && p.email);
    if (recipients.length === 0) continue;

    const startsAtLabel = formatStartsAt(live.starts_at);
    const ctaUrl = `${APP_URL}/vip-live`;

    for (const p of recipients) {
      const { error: sendErr } = await resend.emails.send({
        from: EMAIL_FROM,
        to: p.email as string,
        subject: `Tu live "${live.title}" empieza pronto`,
        html: liveReminderHtml({
          firstName: (p.full_name ?? '').trim().split(/\s+/)[0] ?? '',
          liveTitle: live.title,
          startsAtLabel,
          ctaUrl,
        }),
      });
      if (sendErr) {
        // Liberar la reserva de este usuario para que el próximo cron reintente.
        await supabase
          .from('notification_log')
          .delete()
          .eq('event_type', 'live_reminder')
          .eq('dedupe_key', live.id)
          .eq('user_id', p.id);
        const msg = (sendErr as { message?: string }).message ?? JSON.stringify(sendErr);
        sendErrors.push(msg);
        console.error('[live-reminders] send error', p.email, sendErr);
        continue;
      }
      totalSent += 1;
    }
  }

  console.log(`[live-reminders] lives=${lives.length} sent=${totalSent} errors=${sendErrors.length}`);
  return res.status(200).json({
    ok: true,
    lives: lives.length,
    sent: totalSent,
    ...(sendErrors.length > 0 ? { errors: sendErrors.slice(0, 3) } : {}),
  });
}
