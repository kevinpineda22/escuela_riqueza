-- =============================================================================
-- Recordatorio de lives VIP — scheduler (pg_cron)
-- =============================================================================
-- Corre cada 5 min y pega al dispatcher, que decide qué lives están por
-- empezar y a quién avisar. La tabla notification_log (ya creada en
-- notifications-welcome.sql) garantiza que a cada usuario se le avisa UNA vez
-- por live.
--
-- Antes de correr, reemplazá los DOS placeholders:
--   __APP_WEBHOOK_URL__   → https://escuela-riqueza.vercel.app/api/notifications/live-reminders
--   __WEBHOOK_SECRET__    → el MISMO valor de NOTIFICATIONS_WEBHOOK_SECRET en Vercel
-- =============================================================================

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Reprogramar de forma idempotente: si el job ya existe, lo borramos primero.
do $$
begin
  if exists (select 1 from cron.job where jobname = 'live-reminders') then
    perform cron.unschedule('live-reminders');
  end if;
end $$;

select cron.schedule(
  'live-reminders',
  '*/5 * * * *',   -- cada 5 minutos
  $cron$
  select net.http_post(
    url     := '__APP_WEBHOOK_URL__',
    headers := jsonb_build_object(
      'Content-Type',    'application/json',
      'x-webhook-secret', '__WEBHOOK_SECRET__'
    )
  );
  $cron$
);

-- Para verificar que quedó agendado:
--   select jobname, schedule, active from cron.job where jobname = 'live-reminders';
-- Para ver las últimas corridas:
--   select status, return_message, start_time from cron.job_run_details
--   where jobid = (select jobid from cron.job where jobname = 'live-reminders')
--   order by start_time desc limit 10;
