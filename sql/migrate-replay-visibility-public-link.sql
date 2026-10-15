-- Regla unificada de repetición: `lives.replay_visibility` decide quién ve la
-- grabación de un live finalizado EN TODOS LADOS (sección «En vivo y
-- grabaciones» de la escuela Y link público `/live/<token>`).
--
--   'hidden' -> nadie salvo admin. Por el link público la repetición NO existe
--               (ni siquiera para alumnos pagos) y se ve como "sin repetición".
--   'paid'   -> Individual/VIP con sesión iniciada (y admin). Anónimos y Free ven
--               el paywall del link público.
--   'all'    -> CUALQUIERA, incluso sin cuenta, por el link público.
--
-- `is_public` solo controla si el link/sala pública existe. `replay_is_public`
-- queda DEPRECADA: la columna se conserva (no se borra) pero ya nada la lee para
-- autorizar. Un frontend viejo que siga mostrando el toggle «Repetición abierta
-- a todos» escribiría una columna sin efecto (no-op).
--
-- ORDEN DE DEPLOY: correr DESPUÉS de sql/migrate-lives-replay-visibility.sql y
-- ANTES de desplegar el frontend.
--
-- Idempotente: se puede correr las veces que haga falta.

-- 1. Migración de datos: las salas que ya tenían la repetición abierta pasan a
--    'all'. No se convierte ninguna otra fila.
UPDATE public.lives
SET replay_visibility = 'all'
WHERE replay_is_public = true
  AND replay_visibility <> 'all';

-- 2. Helper de entitlement para el link público. A diferencia de
--    can_watch_school_replay, 'all' también admite usuario NULL (anónimo).
--    Interno: recibe un id de usuario arbitrario, por eso no se otorga a nadie
--    (las RPC SECURITY DEFINER corren como owner y lo pueden invocar).
CREATE OR REPLACE FUNCTION public.can_watch_public_replay(p_visibility text, p_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p_visibility = 'all'
    OR public.can_watch_school_replay(p_visibility, p_user_id);
$$;

REVOKE ALL ON FUNCTION public.can_watch_public_replay(text, uuid) FROM public, anon, authenticated;

-- 3. Sala pública por token. Misma firma, filtros y grants; solo cambia la
--    condición que revela `recording_stream_uid` / `recording_r2_key`.
CREATE OR REPLACE FUNCTION public.get_public_live(p_token text)
RETURNS SETOF public.lives
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT (
    jsonb_populate_record(
      NULL::public.lives,
      CASE
        WHEN public.can_watch_public_replay(l.replay_visibility, auth.uid()) THEN to_jsonb(l)
        ELSE to_jsonb(l) || jsonb_build_object(
          'recording_stream_uid', NULL,
          'recording_r2_key', NULL
        )
      END
    )
  ).*
  FROM public.lives l
  WHERE l.share_token = p_token
    AND l.is_public = true
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.get_public_live(text) FROM public;
GRANT EXECUTE ON FUNCTION public.get_public_live(text) TO anon, authenticated;

-- 4. Alimenta el paywall ("hay grabación pero no puedes verla"). 'hidden' debe
--    verse como "sin repetición", no como paywall.
CREATE OR REPLACE FUNCTION public.public_live_has_recording(p_token text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.lives l
    WHERE l.share_token = p_token
      AND l.is_public = true
      AND l.replay_visibility <> 'hidden'
      AND (l.recording_stream_uid IS NOT NULL OR l.recording_r2_key IS NOT NULL)
  );
$$;

REVOKE ALL ON FUNCTION public.public_live_has_recording(text) FROM public;
GRANT EXECUTE ON FUNCTION public.public_live_has_recording(text) TO anon, authenticated;
