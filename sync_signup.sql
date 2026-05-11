-- Modificar la tabla profiles si hace falta (añadir plan por si acaso, aunque normalmente va en subscriptions)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS plan public.plan_type DEFAULT 'free'::public.plan_type;

-- Actualizar el trigger de creación de usuario para que lea el plan y cree la suscripción
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
DECLARE
  selected_plan public.plan_type;
BEGIN
  -- Leer el plan de la metadata, si no existe o es inválido, usar 'free'
  BEGIN
    selected_plan := COALESCE(NEW.raw_user_meta_data->>'plan', 'free')::public.plan_type;
  EXCEPTION WHEN OTHERS THEN
    selected_plan := 'free'::public.plan_type;
  END;

  -- Crear el perfil
  INSERT INTO public.profiles (id, full_name, email, role, plan)
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data->>'full_name',
    NEW.email,
    'student'::public.user_role,
    selected_plan
  );

  -- Crear la suscripción de forma automática
  INSERT INTO public.subscriptions (user_id, plan, status, current_period_end)
  VALUES (
    NEW.id,
    selected_plan,
    'active',
    now() + interval '30 days'
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
