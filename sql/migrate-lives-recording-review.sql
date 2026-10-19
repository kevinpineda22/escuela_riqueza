-- Revisión de la grabación antes de archivar (recorte del receso).
--
-- Al finalizar una clase, la grabación queda esperando que el admin la revise:
-- puede marcar un tramo a quitar (el receso) o archivarla completa. Si nadie la
-- revisa antes de `review_deadline_at` (finalizar + 48 h), el cron del Worker la
-- archiva completa, como antes. Ver docs/RECORTE_RECESO_DESIGN.md.
--
-- `recording_review`:
--   NULL       -> sala anterior a esta migración o sin revisión: el cron la archiva
--                 como siempre.
--   'pending'  -> esperando revisión. El cron NO la toca hasta review_deadline_at.
--   'keep'     -> archivar completa (el admin eligió no recortar, o venció el plazo).
--   'trimming' -> recorte pedido: la GitHub Action es dueña de la sala y el cron
--                 NO la toca.
-- Toda transición sale de 'pending' con un UPDATE condicional sobre ese valor, así
-- que el cron y el pedido de recorte nunca trabajan la misma sala a la vez.
--
-- `trim_ranges`: tramos a QUITAR, en segundos de la grabación original:
--   [{"start": 3600, "end": 5400}]
-- Se conserva después de archivar, como registro de qué se cortó.
--
-- ORDEN DE DEPLOY: correr este SQL ANTES de desplegar el Worker (su filtro del cron
-- lee estas columnas: sin ellas PostgREST responde 400 y no se archiva nada) y
-- antes del frontend (al finalizar escribe `recording_review`).
--
-- Idempotente: se puede correr las veces que haga falta. Las filas existentes
-- quedan en NULL, es decir, con el comportamiento de siempre.

ALTER TABLE public.lives
  ADD COLUMN IF NOT EXISTS recording_review text,
  ADD COLUMN IF NOT EXISTS review_deadline_at timestamptz,
  ADD COLUMN IF NOT EXISTS trim_ranges jsonb;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'lives_recording_review_check'
      AND conrelid = 'public.lives'::regclass
  ) THEN
    ALTER TABLE public.lives
      ADD CONSTRAINT lives_recording_review_check
      CHECK (recording_review IS NULL OR recording_review IN ('pending', 'keep', 'trimming'));
  END IF;

  -- Una sala en revisión sin plazo quedaría frenada para siempre en Stream, que
  -- cobra por minuto almacenado: es justo el costo que el archivado vino a cortar.
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'lives_review_deadline_check'
      AND conrelid = 'public.lives'::regclass
  ) THEN
    ALTER TABLE public.lives
      ADD CONSTRAINT lives_review_deadline_check
      CHECK (recording_review IS DISTINCT FROM 'pending' OR review_deadline_at IS NOT NULL);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'lives_trim_ranges_check'
      AND conrelid = 'public.lives'::regclass
  ) THEN
    ALTER TABLE public.lives
      ADD CONSTRAINT lives_trim_ranges_check
      CHECK (trim_ranges IS NULL OR jsonb_typeof(trim_ranges) = 'array');
  END IF;
END
$$;
