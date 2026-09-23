-- Repetición de lives públicos: solo para planes pagos.
--
-- Modelo de seguridad: el en vivo (`/live/<token>`) sigue siendo público para
-- cualquiera (anon incluido) mientras `is_public = true` — eso NO cambia. Lo
-- que cambia es la repetición: una vez el live termina (`status = 'ended'`),
-- `get_public_live` dejaba viajar `recording_stream_uid` / `recording_r2_key`
-- a cualquier caller con el token, y con eso el cliente podía armar la URL de
-- Cloudflare Stream o pedir la URL firmada de R2 sin tener plan pago.
--
-- Ahora `get_public_live` sigue devolviendo la fila completa (el token sigue
-- siendo válido, el resto de la UI —título, countdown, estado— no cambia),
-- pero anula esas dos columnas a menos que quien llama esté autenticado
-- (`auth.uid()` no nulo) Y su perfil sea `role = 'admin'` o `plan IN
-- ('individual', 'vip')`. Un visitante anónimo o Free ve el live y, cuando
-- termina, la pantalla de "repetición solo para alumnos" (frontend) — el uid
-- de Stream y la key de R2 nunca les llegan.
--
-- La firma de URL de R2 para la repetición pasa por `/api/stream/recording-url`
-- con `live_id` + JWT (rama autenticada, valida `allowed_plans`) — la rama
-- pública por `share_token` fue eliminada de ese endpoint porque firmaba sin
-- ningún chequeo de plan.
--
-- Nota de implementación: la proyección usa `to_jsonb` + `jsonb_populate_record`
-- en lugar de listar las columnas una por una. Así la función NO se rompe si la
-- tabla `lives` gana o pierde columnas (el repo no tiene el `CREATE TABLE`; la
-- tabla se creó directo en Supabase, por lo que una lista explícita sería
-- frágil).
--
-- Idempotente: se puede correr las veces que haga falta.

-- 1. Helper de entitlement: admin o plan pago (individual/vip).
--    Se define PRIMERO porque `get_public_live` lo referencia y Postgres valida
--    el cuerpo de las funciones SQL al crearlas.
CREATE OR REPLACE FUNCTION public.can_watch_live_replay(p_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p_user_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = p_user_id
      AND (role = 'admin' OR plan IN ('individual', 'vip'))
  );
$$;

REVOKE ALL ON FUNCTION public.can_watch_live_replay(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.can_watch_live_replay(uuid) TO anon, authenticated;

-- 2. Sala pública por token, con las columnas de grabación anuladas para
--    quienes no tienen plan pago.
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
        WHEN public.can_watch_live_replay(auth.uid()) THEN to_jsonb(l)
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

-- Verificación sugerida (como anónimo debe devolver ambas columnas en NULL):
--   select recording_stream_uid, recording_r2_key, status
--   from public.get_public_live('<share_token>');
