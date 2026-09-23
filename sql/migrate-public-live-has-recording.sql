-- Deja saber si una sala pública ya tiene grabación, sin revelar la grabación.
--
-- `get_public_live` (ver sql/migrate-public-live-replay-paid.sql) anula
-- `recording_stream_uid` y `recording_r2_key` para cualquier caller sin plan
-- pago (anon incluido). Eso es correcto para no filtrar el id de la
-- grabación, pero como efecto secundario el frontend (`PublicLiveRoom.tsx`)
-- no puede distinguir "el live terminó y no hay grabación todavía" de "el
-- live terminó, hay grabación, pero está bloqueada por plan" — ambos casos
-- llegan con las dos columnas en NULL. Sin esa distinción, el paywall de
-- repetición nunca se mostraba: se caía siempre a la pantalla genérica de
-- "transmisión finalizada".
--
-- Esta función devuelve solo un boolean (no las columnas), así que es segura
-- para cualquier caller, autenticado o no, sin importar su plan.
--
-- Idempotente: se puede correr las veces que haga falta.

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
      AND (l.recording_stream_uid IS NOT NULL OR l.recording_r2_key IS NOT NULL)
  );
$$;

REVOKE ALL ON FUNCTION public.public_live_has_recording(text) FROM public;
GRANT EXECUTE ON FUNCTION public.public_live_has_recording(text) TO anon, authenticated;

-- Verificación sugerida (como anónimo, en una sala finalizada con grabación,
-- debe devolver true aunque get_public_live traiga las columnas en NULL):
--   select public.public_live_has_recording('<share_token>');
