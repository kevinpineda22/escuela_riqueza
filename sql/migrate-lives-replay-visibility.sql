-- Visibilidad de repeticiones para alumnos ("En vivo y grabaciones").
--
-- Modelo: cada live finalizado tiene `replay_visibility`, controlada por el admin:
--   'hidden' (DEFAULT, incluye todas las filas existentes) -> no se lista a alumnos.
--   'paid'   -> reproducible por los planes individual y vip. Free la VE en el
--               listado pero bloqueada (teaser + CTA a /planes).
--   'all'    -> reproducible por cualquier plan, incluido free.
-- El admin siempre puede reproducir todo.
--
-- Es INDEPENDIENTE del link público (`is_public`, `replay_is_public`) y de
-- `get_public_live`: esas rutas no cambian.
--
-- Seguridad: el listado y el detalle pasan por RPC SECURITY DEFINER que anulan
-- `recording_stream_uid` cuando el usuario no puede reproducir y NUNCA devuelven
-- `recording_r2_key` (el cliente pide la URL firmada por `live_id` a
-- /api/stream/recording-url, que vuelve a validar la visibilidad en el servidor).
-- `get_school_replay` deja que un admin consulte también las filas 'hidden'
-- (vista previa); para el resto, 'hidden' no devuelve fila.
--
-- LIMITACIÓN CONOCIDA (fuera de alcance): el SELECT sobre `lives` está abierto a
-- `authenticated`, así que los ids de grabación siguen siendo legibles con una
-- consulta directa a la tabla. Requiere un seguimiento aparte.
--
-- ORDEN DE DEPLOY: correr este SQL ANTES de desplegar el frontend (el cliente
-- lee `replay_visibility` y llama a las RPC nuevas).
--
-- Idempotente: se puede correr las veces que haga falta.

-- 1. Columna + CHECK.
ALTER TABLE public.lives
  ADD COLUMN IF NOT EXISTS replay_visibility text NOT NULL DEFAULT 'hidden';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'lives_replay_visibility_check'
      AND conrelid = 'public.lives'::regclass
  ) THEN
    ALTER TABLE public.lives
      ADD CONSTRAINT lives_replay_visibility_check
      CHECK (replay_visibility IN ('hidden', 'paid', 'all'));
  END IF;
END
$$;

-- 2. Helper de entitlement. Devuelve false para usuario NULL o inexistente.
CREATE OR REPLACE FUNCTION public.can_watch_school_replay(p_visibility text, p_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p_user_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = p_user_id
      AND (
        p.role = 'admin'
        OR (p_visibility = 'all')
        OR (p_visibility = 'paid' AND p.plan IN ('individual', 'vip'))
      )
  );
$$;

-- Internal helper only: it takes an arbitrary user id, so exposing it would let
-- any caller probe another user's plan/role. The SECURITY DEFINER RPCs below
-- run as the owner and can call it without a grant.
REVOKE ALL ON FUNCTION public.can_watch_school_replay(text, uuid) FROM public, anon, authenticated;

-- 3. Listado para el alumno. Sin sesión no devuelve nada.
CREATE OR REPLACE FUNCTION public.list_school_replays()
RETURNS TABLE (
  id uuid,
  title text,
  description text,
  starts_at timestamptz,
  background_image_url text,
  recording_duration_seconds integer,
  replay_visibility text,
  can_watch boolean,
  recording_storage text,
  recording_stream_uid text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    l.id::uuid,
    l.title::text,
    l.description::text,
    l.starts_at::timestamptz,
    l.background_image_url::text,
    l.recording_duration_seconds::integer,
    l.replay_visibility::text,
    public.can_watch_school_replay(l.replay_visibility, auth.uid()) AS can_watch,
    l.recording_storage::text,
    CASE
      WHEN public.can_watch_school_replay(l.replay_visibility, auth.uid())
        THEN l.recording_stream_uid::text
      ELSE NULL
    END AS recording_stream_uid
  FROM public.lives l
  WHERE auth.uid() IS NOT NULL
    AND l.status = 'ended'
    AND l.replay_visibility <> 'hidden'
    AND (
      l.recording_stream_uid IS NOT NULL
      OR (l.recording_storage = 'r2' AND l.recording_r2_key IS NOT NULL)
    )
  ORDER BY l.starts_at DESC;
$$;

REVOKE ALL ON FUNCTION public.list_school_replays() FROM public;
GRANT EXECUTE ON FUNCTION public.list_school_replays() TO authenticated;

-- 4. Detalle de una repetición. Mismos filtros; los admins también ven 'hidden'.
CREATE OR REPLACE FUNCTION public.get_school_replay(p_live_id uuid)
RETURNS TABLE (
  id uuid,
  title text,
  description text,
  starts_at timestamptz,
  background_image_url text,
  recording_duration_seconds integer,
  replay_visibility text,
  can_watch boolean,
  recording_storage text,
  recording_stream_uid text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    l.id::uuid,
    l.title::text,
    l.description::text,
    l.starts_at::timestamptz,
    l.background_image_url::text,
    l.recording_duration_seconds::integer,
    l.replay_visibility::text,
    public.can_watch_school_replay(l.replay_visibility, auth.uid()) AS can_watch,
    l.recording_storage::text,
    CASE
      WHEN public.can_watch_school_replay(l.replay_visibility, auth.uid())
        THEN l.recording_stream_uid::text
      ELSE NULL
    END AS recording_stream_uid
  FROM public.lives l
  WHERE l.id = p_live_id
    AND auth.uid() IS NOT NULL
    AND l.status = 'ended'
    AND (
      l.replay_visibility <> 'hidden'
      OR EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = auth.uid() AND p.role = 'admin'
      )
    )
    AND (
      l.recording_stream_uid IS NOT NULL
      OR (l.recording_storage = 'r2' AND l.recording_r2_key IS NOT NULL)
    )
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.get_school_replay(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.get_school_replay(uuid) TO authenticated;

-- Los casts explícitos del SELECT protegen contra diferencias de tipo en `lives`
-- (la tabla no tiene CREATE TABLE en el repo).
--
-- Verificación sugerida (como alumno free, 'paid' aparece con can_watch = false
-- y recording_stream_uid en NULL):
--   select id, replay_visibility, can_watch, recording_stream_uid
--   from public.list_school_replays();
