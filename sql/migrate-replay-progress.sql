-- Progreso de reproducción de grabaciones (retomar donde se quedó el alumno).
--
-- Una fila por (usuario, live): última posición vista de la grabación. Permite
-- retomar entre sesiones y dispositivos en /grabaciones/:liveId (solo grabaciones
-- en R2; las de Stream se ven en un iframe y no reportan posición).
--
-- Seguridad: RLS estricta, cada usuario solo lee/escribe/borra SU fila. Sin acceso
-- para anon. El link público (sin sesión) no guarda progreso.
--
-- ORDEN DE DEPLOY: correr este SQL ANTES de desplegar el frontend. Idempotente.

CREATE TABLE IF NOT EXISTS public.user_replay_progress (
  user_id          uuid        NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  live_id          uuid        NOT NULL REFERENCES public.lives(id) ON DELETE CASCADE,
  position_seconds integer     NOT NULL CHECK (position_seconds >= 0),
  duration_seconds integer,
  updated_at       timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, live_id)
);

ALTER TABLE public.user_replay_progress ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "replay_progress_select_own" ON public.user_replay_progress;
CREATE POLICY "replay_progress_select_own" ON public.user_replay_progress
  FOR SELECT TO authenticated USING (user_id = auth.uid());

DROP POLICY IF EXISTS "replay_progress_insert_own" ON public.user_replay_progress;
CREATE POLICY "replay_progress_insert_own" ON public.user_replay_progress
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "replay_progress_update_own" ON public.user_replay_progress;
CREATE POLICY "replay_progress_update_own" ON public.user_replay_progress
  FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "replay_progress_delete_own" ON public.user_replay_progress;
CREATE POLICY "replay_progress_delete_own" ON public.user_replay_progress
  FOR DELETE TO authenticated USING (user_id = auth.uid());

REVOKE ALL ON public.user_replay_progress FROM PUBLIC, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_replay_progress TO authenticated;
