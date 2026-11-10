-- Seguimiento de correos en /admin/users: qué correos salieron, si llegaron y,
-- si rebotaron, por qué. Lo alimenta el webhook de Resend
-- (api/notifications/resend-webhook.ts).
--
-- Correr ANTES de activar el webhook en Resend. Se puede correr antes o después
-- del deploy: solo agrega objetos nuevos, y el panel sigue funcionando sin ellos.

CREATE TABLE IF NOT EXISTS public.email_deliveries (
  email_id        text PRIMARY KEY,               -- id de Resend
  recipient       text NOT NULL,                  -- en minúsculas
  user_id         uuid REFERENCES auth.users (id) ON DELETE CASCADE,
  subject         text,
  status          text NOT NULL,
  sent_at         timestamptz NOT NULL,           -- cuándo se creó el correo
  status_at       timestamptz NOT NULL,           -- cuándo llegó a este estado
  bounce_type     text,                           -- Permanent | Temporary | ...
  bounce_subtype  text,                           -- General | NoEmail | MailboxFull | ...
  detail          text                            -- mensaje del servidor que lo rechazó
);

CREATE INDEX IF NOT EXISTS email_deliveries_recipient_idx
  ON public.email_deliveries (recipient, sent_at DESC);
CREATE INDEX IF NOT EXISTS email_deliveries_user_idx
  ON public.email_deliveries (user_id, sent_at DESC);

-- RLS sin policies: desde el navegador solo se lee por los RPC de abajo.
ALTER TABLE public.email_deliveries ENABLE ROW LEVEL SECURITY;

-- Registra un evento. Resend reintenta y no garantiza el orden, así que el
-- estado se decide por rango y no por hora de llegada: un "delivered" atrasado
-- nunca pisa un "bounced", y el "suppressed" que sigue a un rebote no borra que
-- rebotó. Repetir un evento no cambia nada.
CREATE OR REPLACE FUNCTION public.record_email_event(
  p_email_id text,
  p_recipient text,
  p_subject text,
  p_status text,
  p_sent_at timestamptz,
  p_event_at timestamptz,
  p_bounce_type text DEFAULT NULL,
  p_bounce_subtype text DEFAULT NULL,
  p_detail text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  ranks constant text[] := ARRAY['sent', 'delivery_delayed', 'delivered', 'failed', 'suppressed', 'bounced', 'complained'];
  clean_recipient text := lower(trim(p_recipient));
BEGIN
  IF array_position(ranks, p_status) IS NULL THEN
    RAISE EXCEPTION 'Estado de correo desconocido: %', p_status;
  END IF;

  INSERT INTO public.email_deliveries AS d (
    email_id, recipient, user_id, subject, status, sent_at, status_at,
    bounce_type, bounce_subtype, detail
  )
  VALUES (
    p_email_id,
    clean_recipient,
    (SELECT p.id FROM public.profiles p WHERE lower(p.email) = clean_recipient LIMIT 1),
    p_subject,
    p_status,
    p_sent_at,
    p_event_at,
    p_bounce_type,
    p_bounce_subtype,
    p_detail
  )
  ON CONFLICT (email_id) DO UPDATE SET
    status = CASE
      WHEN array_position(ranks, EXCLUDED.status) >= array_position(ranks, d.status) THEN EXCLUDED.status
      ELSE d.status
    END,
    status_at = CASE
      WHEN array_position(ranks, EXCLUDED.status) >= array_position(ranks, d.status) THEN EXCLUDED.status_at
      ELSE d.status_at
    END,
    bounce_type = COALESCE(EXCLUDED.bounce_type, d.bounce_type),
    bounce_subtype = COALESCE(EXCLUDED.bounce_subtype, d.bounce_subtype),
    -- El detalle del rebote manda: el "suppressed" que le sigue no aporta nada.
    detail = CASE
      WHEN d.bounce_type IS NOT NULL AND EXCLUDED.bounce_type IS NULL THEN d.detail
      ELSE COALESCE(EXCLUDED.detail, d.detail)
    END,
    user_id = COALESCE(d.user_id, EXCLUDED.user_id);
END;
$$;

-- Usuarios cuyo correo ACTUAL tiene un problema: el último envío a esa dirección
-- falló. Une por correo y no por user_id a propósito: al corregir el correo en
-- la ficha, el aviso se apaga solo.
CREATE OR REPLACE FUNCTION public.admin_email_issues()
RETURNS TABLE (
  user_id uuid,
  recipient text,
  subject text,
  status text,
  sent_at timestamptz,
  status_at timestamptz,
  bounce_type text,
  bounce_subtype text,
  detail text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller_role public.user_role;
BEGIN
  SELECT cp.role INTO caller_role FROM public.profiles cp WHERE cp.id = auth.uid();
  IF caller_role IS DISTINCT FROM 'admin' THEN
    RAISE EXCEPTION 'Not authorized. Only admins can read email deliveries.' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
    SELECT p.id, latest.recipient, latest.subject, latest.status, latest.sent_at,
           latest.status_at, latest.bounce_type, latest.bounce_subtype, latest.detail
    FROM (
      SELECT DISTINCT ON (d.recipient) d.*
      FROM public.email_deliveries d
      ORDER BY d.recipient, d.sent_at DESC
    ) latest
    JOIN public.profiles p ON lower(p.email) = latest.recipient
    WHERE latest.status IN ('bounced', 'failed', 'suppressed', 'complained');
END;
$$;

-- Historial de un usuario: lo enviado a su cuenta y a su correo actual.
CREATE OR REPLACE FUNCTION public.admin_user_emails(target_user_id uuid)
RETURNS TABLE (
  email_id text,
  recipient text,
  subject text,
  status text,
  sent_at timestamptz,
  status_at timestamptz,
  bounce_type text,
  bounce_subtype text,
  detail text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller_role public.user_role;
  target_email text;
BEGIN
  SELECT cp.role INTO caller_role FROM public.profiles cp WHERE cp.id = auth.uid();
  IF caller_role IS DISTINCT FROM 'admin' THEN
    RAISE EXCEPTION 'Not authorized. Only admins can read email deliveries.' USING ERRCODE = '42501';
  END IF;

  SELECT lower(p.email) INTO target_email FROM public.profiles p WHERE p.id = target_user_id;

  RETURN QUERY
    SELECT d.email_id, d.recipient, d.subject, d.status, d.sent_at, d.status_at,
           d.bounce_type, d.bounce_subtype, d.detail
    FROM public.email_deliveries d
    WHERE d.user_id = target_user_id OR d.recipient = target_email
    ORDER BY d.sent_at DESC
    LIMIT 30;
END;
$$;

REVOKE ALL ON FUNCTION public.record_email_event(text, text, text, text, timestamptz, timestamptz, text, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_email_event(text, text, text, text, timestamptz, timestamptz, text, text, text) TO service_role;

REVOKE ALL ON FUNCTION public.admin_email_issues() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_user_emails(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_email_issues() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_user_emails(uuid) TO authenticated;

-- Verificación: debe dar 3.
-- SELECT count(*) FROM pg_proc
-- WHERE proname IN ('record_email_event', 'admin_email_issues', 'admin_user_emails');

-- Rollback:
-- DROP FUNCTION IF EXISTS public.admin_user_emails(uuid);
-- DROP FUNCTION IF EXISTS public.admin_email_issues();
-- DROP FUNCTION IF EXISTS public.record_email_event(text, text, text, text, timestamptz, timestamptz, text, text, text);
-- DROP TABLE IF EXISTS public.email_deliveries;
