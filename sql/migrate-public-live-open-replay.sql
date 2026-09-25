-- Repetición abierta a todos: opt-in, por sala.
--
-- Modelo: el en vivo (`/live/<token>`) ya es público para cualquiera mientras
-- `is_public = true` (sql/migrate-lives-public-link.sql). La REPETICIÓN, en
-- cambio, es contenido pago por defecto: solo Individual/VIP/admin la ven
-- (`can_watch_live_replay`, sql/migrate-public-live-replay-paid.sql).
--
-- Esta migración agrega una tercera puerta, explícita y por sala:
-- `replay_is_public`. Si el admin la activa para una sala puntual, CUALQUIER
-- visitante con el link (sin cuenta, sin plan) puede ver la repetición de
-- ESA clase — el resto de las salas sigue con la repetición paga por
-- defecto (`replay_is_public` nace en `false`).
--
-- `get_public_live` revela `recording_stream_uid` / `recording_r2_key`
-- cuando `can_watch_live_replay(auth.uid())` ES TRUE **O** la fila tiene
-- `replay_is_public = true` — sigue usando `to_jsonb` + `jsonb_populate_record`
-- (no una lista de columnas explícita) por la misma razón que la migración
-- anterior: la tabla `lives` se administra a mano en Supabase y no hay
-- `CREATE TABLE` en el repo, así que una proyección explícita sería frágil
-- ante un ALTER TABLE futuro.
--
-- Escritura de `replay_is_public`: ya es admin-only a través de las RLS
-- policies existentes de `lives` (sql/migrate-lives-rls-admin.sql) — no hace
-- falta una policy nueva, es la misma columna que `is_public`/`share_token`.
--
-- Idempotente: se puede correr las veces que haga falta.

ALTER TABLE public.lives ADD COLUMN IF NOT EXISTS replay_is_public boolean NOT NULL DEFAULT false;

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
        WHEN public.can_watch_live_replay(auth.uid()) OR l.replay_is_public THEN to_jsonb(l)
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

-- Verificación sugerida (como anónimo, en una sala con replay_is_public = true,
-- debe devolver recording_stream_uid/recording_r2_key SIN anular):
--   select recording_stream_uid, recording_r2_key, replay_is_public
--   from public.get_public_live('<share_token>');
