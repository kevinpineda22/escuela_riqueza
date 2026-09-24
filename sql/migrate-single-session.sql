-- Sesión única por usuario (anti-cuentas compartidas).
--
-- Regla: gana la sesión MÁS NUEVA (por auth.sessions.created_at), la misma
-- semántica que la opción "Single session per user" del plan Pro de Supabase,
-- pero disponible en el plan gratuito. Aplica a TODAS las cuentas, admins
-- incluidos: un admin tampoco puede tener el panel abierto en dos dispositivos.
--
-- Cómo funciona:
--   1. El cliente llama a claim_active_session() al arrancar, al volver a la
--      pestaña y cuando cambia su fila en user_active_sessions (Realtime).
--   2. Si la sesión que llama es la más nueva, queda registrada como activa y se
--      borran las demás de auth.sessions (sus refresh tokens caen en cascada:
--      no pueden renovar el access token).
--   3. Si ya hay una sesión más nueva, la que llama se revoca y la función
--      devuelve false: el cliente cierra la sesión local y avisa.
--
-- Por qué la fecha de creación y no "el último que llamó": recargar la página en
-- el dispositivo viejo vuelve a llamar a la función; si ganara el último en
-- llamar, un simple F5 le robaría la sesión al dispositivo nuevo.
--
-- Límite conocido: un access token ya emitido sigue siendo válido hasta que
-- vence (JWT expiry, 1 h por defecto). El cierre inmediato lo hace el cliente.
--
-- Aplicar manualmente en el SQL Editor de Supabase. Idempotente.

-- 1. Tabla: una fila por usuario con la sesión vigente.
CREATE TABLE IF NOT EXISTS public.user_active_sessions (
  user_id    uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  session_id uuid NOT NULL,
  claimed_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.user_active_sessions ENABLE ROW LEVEL SECURITY;

-- Cada usuario solo lee su propia fila (necesario para Realtime).
-- Sin policies de escritura: solo se escribe vía claim_active_session().
DROP POLICY IF EXISTS "Users read own active session" ON public.user_active_sessions;
CREATE POLICY "Users read own active session" ON public.user_active_sessions
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- 2. Realtime: el dispositivo desplazado se entera en segundos.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'user_active_sessions'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.user_active_sessions;
  END IF;
END $$;

-- 3. Función: reclama (o confirma) la sesión activa del usuario que llama.
--    Devuelve true si la sesión que llama es la vigente, false si fue desplazada.
CREATE OR REPLACE FUNCTION public.claim_active_session()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid             uuid := auth.uid();
  v_sid             uuid := nullif(auth.jwt() ->> 'session_id', '')::uuid;
  v_created         timestamptz;
  v_current         uuid;
  v_current_created timestamptz;
BEGIN
  IF v_uid IS NULL OR v_sid IS NULL THEN
    RAISE EXCEPTION 'not authenticated' USING ERRCODE = '28000';
  END IF;

  -- Serializa reclamos simultáneos del mismo usuario (dos logins a la vez).
  PERFORM pg_advisory_xact_lock(hashtextextended(v_uid::text, 0));

  SELECT created_at INTO v_created
  FROM auth.sessions
  WHERE id = v_sid AND user_id = v_uid;

  -- La sesión ya no existe (la revocó un login más nuevo): desplazada.
  IF NOT FOUND THEN
    RETURN false;
  END IF;

  SELECT session_id INTO v_current
  FROM public.user_active_sessions
  WHERE user_id = v_uid;

  IF v_current = v_sid THEN
    RETURN true;
  END IF;

  IF v_current IS NOT NULL THEN
    SELECT created_at INTO v_current_created
    FROM auth.sessions
    WHERE id = v_current;

    -- Hay una sesión vigente y es más nueva: esta queda desplazada y se revoca.
    IF FOUND AND v_current_created > v_created THEN
      DELETE FROM auth.sessions WHERE id = v_sid;
      RETURN false;
    END IF;
  END IF;

  -- Esta sesión es la más nueva (o la vigente ya no existe): toma el lugar.
  INSERT INTO public.user_active_sessions (user_id, session_id, claimed_at)
  VALUES (v_uid, v_sid, now())
  ON CONFLICT (user_id) DO UPDATE
    SET session_id = excluded.session_id,
        claimed_at = excluded.claimed_at;

  DELETE FROM auth.sessions
  WHERE user_id = v_uid AND id <> v_sid;

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_active_session() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.claim_active_session() TO authenticated;
