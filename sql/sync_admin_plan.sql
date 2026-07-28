-- Crear RPC para que un Admin modifique el plan saltándose las políticas RLS restrictivas
CREATE OR REPLACE FUNCTION public.admin_update_user_plan(target_user_id uuid, new_plan public.plan_type)
RETURNS void AS $$
DECLARE
  caller_role public.user_role;
BEGIN
  -- 1. Verificar que quien llama es administrador
  SELECT role INTO caller_role FROM public.profiles WHERE id = auth.uid();
  IF caller_role != 'admin' THEN
    RAISE EXCEPTION 'Not authorized. Only admins can change plans.';
  END IF;

  -- 2. Actualizar el perfil (para visualización rápida en la UI)
  UPDATE public.profiles
  SET plan = new_plan, updated_at = now()
  WHERE id = target_user_id;

  -- 3. Actualizar suscripción activa o crearla si no existe
  IF EXISTS (SELECT 1 FROM public.subscriptions WHERE user_id = target_user_id AND status = 'active') THEN
    UPDATE public.subscriptions 
    SET plan = new_plan, updated_at = now() 
    WHERE user_id = target_user_id AND status = 'active';
  ELSE
    INSERT INTO public.subscriptions (user_id, plan, status, current_period_end)
    VALUES (target_user_id, new_plan, 'active', now() + interval '30 days');
  END IF;

END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
