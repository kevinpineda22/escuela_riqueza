-- ============================================================================
-- Métricas admin: permitir que admins vean progreso global + RPC de top lecciones
-- ============================================================================

-- 1. Policy: admins pueden SELECT todo el progreso (sin tocar la policy existente
--    que deja a cada usuario ver el suyo).
DROP POLICY IF EXISTS "Admins can view all progress" ON public.user_lesson_progress;
CREATE POLICY "Admins can view all progress" ON public.user_lesson_progress
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role = 'admin'
    )
  );

-- 2. RPC: top lecciones por vistas (cuenta filas de progreso por lesson_id).
--    SECURITY DEFINER permite que se calculen los conteos globales sin depender
--    de RLS del caller. Internamente validamos que sea admin.
CREATE OR REPLACE FUNCTION public.admin_get_top_lessons(limit_count integer DEFAULT 5)
RETURNS TABLE (
  lesson_id uuid,
  title text,
  views bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Verificamos rol admin
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  ) THEN
    RAISE EXCEPTION 'No autorizado';
  END IF;

  RETURN QUERY
  SELECT
    l.id AS lesson_id,
    l.title,
    COUNT(p.id)::bigint AS views
  FROM public.lessons l
  LEFT JOIN public.user_lesson_progress p ON p.lesson_id = l.id
  GROUP BY l.id, l.title
  ORDER BY views DESC, l.title ASC
  LIMIT limit_count;
END;
$$;

-- 3. Permitir que cualquier usuario autenticado pueda ejecutar (la función
--    valida internamente que sea admin).
REVOKE ALL ON FUNCTION public.admin_get_top_lessons(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_get_top_lessons(integer) TO authenticated;
