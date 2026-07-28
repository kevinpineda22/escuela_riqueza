-- ============================================================================
-- v2: admin_get_top_lessons ahora acepta filtro de período (since timestamptz).
-- Reemplaza la versión anterior. Si pasás NULL en `since`, devuelve histórico.
-- ============================================================================

-- Eliminar versión vieja (firma cambia: agregamos un parámetro)
DROP FUNCTION IF EXISTS public.admin_get_top_lessons(integer);

CREATE OR REPLACE FUNCTION public.admin_get_top_lessons(
  limit_count integer DEFAULT 5,
  since timestamptz DEFAULT NULL
)
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
  -- Sólo admins
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
  LEFT JOIN public.user_lesson_progress p
    ON p.lesson_id = l.id
    AND (since IS NULL OR p.updated_at >= since)
  GROUP BY l.id, l.title
  ORDER BY views DESC, l.title ASC
  LIMIT limit_count;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_get_top_lessons(integer, timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_get_top_lessons(integer, timestamptz) TO authenticated;

-- ============================================================================
-- RPC para "Nuevos usuarios en el período" (filtrado por profiles.created_at)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.admin_count_new_users(
  since timestamptz DEFAULT NULL
)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result bigint;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  ) THEN
    RAISE EXCEPTION 'No autorizado';
  END IF;

  SELECT COUNT(*) INTO result
  FROM public.profiles
  WHERE (since IS NULL OR created_at >= since);

  RETURN result;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_count_new_users(timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_count_new_users(timestamptz) TO authenticated;

-- ============================================================================
-- RPC para "Ingresos del período" (cuando Stripe esté conectado)
-- Hoy retorna 0 porque subscriptions.amount no existe todavía.
-- Cuando agregues columna `amount_cents int` a subscriptions, descomentar bloque.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.admin_revenue_in_period(
  since timestamptz DEFAULT NULL
)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  ) THEN
    RAISE EXCEPTION 'No autorizado';
  END IF;

  -- TODO Stripe: cuando exista subscriptions.amount_cents y subscriptions.paid_at:
  -- RETURN (SELECT COALESCE(SUM(amount_cents), 0) FROM public.subscriptions
  --         WHERE status = 'active'
  --         AND (since IS NULL OR paid_at >= since));

  -- Por ahora estimación: individual=29, vip=99 (USD) sobre suscripciones activas
  RETURN (
    SELECT COALESCE(SUM(CASE
      WHEN plan = 'individual' THEN 29
      WHEN plan = 'vip' THEN 99
      ELSE 0
    END), 0)
    FROM public.subscriptions
    WHERE status = 'active'
      AND (since IS NULL OR updated_at >= since)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_revenue_in_period(timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_revenue_in_period(timestamptz) TO authenticated;
