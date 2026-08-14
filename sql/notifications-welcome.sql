-- =============================================================================
-- Notificaciones por evento — Bienvenida (Opción B: al confirmar el email)
-- =============================================================================
-- Correr en el SQL Editor de Supabase. Antes de correr, reemplazá los DOS
-- placeholders del final:
--   __APP_WEBHOOK_URL__   ej: https://escuela-riqueza.vercel.app/api/notifications/welcome
--   __WEBHOOK_SECRET__    el MISMO valor que pusiste en la env NOTIFICATIONS_WEBHOOK_SECRET de Vercel
-- =============================================================================

-- 1) Extensión para hacer HTTP desde Postgres (fire-and-forget, no bloquea el signup).
create extension if not exists pg_net;

-- 2) Tabla de log / idempotencia. La única (user_id, event_type, dedupe_key)
--    garantiza que un mismo evento se manda UNA sola vez por usuario.
--    dedupe_key queda '' para eventos únicos (bienvenida); para eventos que se
--    repiten (ej. pago) ahí va el id de factura y no colisionan.
create table if not exists public.notification_log (
  id                   uuid primary key default gen_random_uuid(),
  user_id              uuid not null references auth.users(id) on delete cascade,
  event_type           text not null,
  dedupe_key           text not null default '',
  channel              text not null default 'email',
  provider_message_id  text,
  created_at           timestamptz not null default now(),
  constraint notification_log_unique unique (user_id, event_type, dedupe_key)
);

-- 3) RLS habilitada SIN policies para roles de cliente => nadie desde el
--    navegador puede leer ni escribir esta tabla. Solo el service_role (que
--    bypassa RLS) la toca, y únicamente desde la Vercel Function. Es un log
--    interno: el usuario no tiene por qué verlo.
alter table public.notification_log enable row level security;

-- 4) Trigger: cuando email_confirmed_at pasa de null -> fecha (el usuario acaba
--    de confirmar), pega al dispatcher con el secreto en el header. pg_net es
--    asíncrono, así que no demora ni bloquea la confirmación.
create or replace function public.notify_welcome_on_confirm()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (old.email_confirmed_at is null and new.email_confirmed_at is not null) then
    perform net.http_post(
      url     := '__APP_WEBHOOK_URL__',
      headers := jsonb_build_object(
        'Content-Type',    'application/json',
        'x-webhook-secret', '__WEBHOOK_SECRET__'
      ),
      body    := jsonb_build_object(
        'user_id',    new.id,
        'email',      new.email,
        'full_name',  new.raw_user_meta_data->>'full_name',
        'event_type', 'welcome'
      )
    );
  end if;
  return new;
end;
$$;

drop trigger if exists on_auth_user_email_confirmed on auth.users;
create trigger on_auth_user_email_confirmed
  after update of email_confirmed_at on auth.users
  for each row
  execute function public.notify_welcome_on_confirm();
