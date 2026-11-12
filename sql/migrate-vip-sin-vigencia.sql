-- El plan VIP es el de quienes van a la formación presencial: no pagan la
-- plataforma, así que su suscripción NO tiene vigencia (current_period_end NULL).
-- Antes todo plan nacía con "now() + 30 days" y el panel del alumno mostraba
-- "Próximo cobro" a gente que nunca va a pagar una mensualidad.
--
-- Seguro de correr en cualquier momento (antes o después del deploy): el front
-- ya trata NULL como "sin vencimiento" y nada en la base corta el acceso por
-- fecha (current_period_end solo se muestra).

-- 1) La columna tiene que aceptar NULL (no-op si ya lo acepta).
ALTER TABLE public.subscriptions ALTER COLUMN current_period_end DROP NOT NULL;

-- 2) Los VIP actuales quedan sin vigencia.
UPDATE public.subscriptions
SET current_period_end = NULL, updated_at = now()
WHERE plan = 'vip' AND status = 'active' AND current_period_end IS NOT NULL;

-- 3) El RPC del admin aplica la misma regla: VIP → sin vigencia; otro plan
--    conserva su fecha o, si no tenía (venía de VIP), arranca 30 días.
--    Misma firma que sync_admin_plan.sql (lo reemplaza).
CREATE OR REPLACE FUNCTION public.admin_update_user_plan(target_user_id uuid, new_plan public.plan_type)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller_role public.user_role;
BEGIN
  SELECT role INTO caller_role FROM public.profiles WHERE id = auth.uid();
  IF caller_role IS DISTINCT FROM 'admin' THEN
    RAISE EXCEPTION 'Not authorized. Only admins can change plans.' USING ERRCODE = '42501';
  END IF;

  UPDATE public.profiles
  SET plan = new_plan, updated_at = now()
  WHERE id = target_user_id;

  IF EXISTS (SELECT 1 FROM public.subscriptions WHERE user_id = target_user_id AND status = 'active') THEN
    UPDATE public.subscriptions
    SET plan = new_plan,
        current_period_end = CASE
          WHEN new_plan = 'vip' THEN NULL
          ELSE COALESCE(current_period_end, now() + interval '30 days')
        END,
        updated_at = now()
    WHERE user_id = target_user_id AND status = 'active';
  ELSE
    INSERT INTO public.subscriptions (user_id, plan, status, current_period_end)
    VALUES (
      target_user_id, new_plan, 'active',
      CASE WHEN new_plan = 'vip' THEN NULL ELSE now() + interval '30 days' END
    );
  END IF;
END;
$$;

-- Verificación: debe dar 0.
-- SELECT count(*) FROM public.subscriptions
-- WHERE plan = 'vip' AND status = 'active' AND current_period_end IS NOT NULL;
