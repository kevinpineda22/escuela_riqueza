-- Contraseña temporal obligatoria de cambiar (alta masiva de cohortes, 2026-11-04).
--
-- El script scripts/onboard-cohort.mjs crea cada cuenta con una contraseña
-- temporal y la marca `must_change_password: true` en `app_metadata`. La app
-- (RequireAuth) no deja pasar de /crear-contrasena mientras la marca exista.
--
-- Por qué `app_metadata` y no una columna de profiles: el alumno NO puede
-- editarla (solo la service role), viaja en la sesión sin pedir nada más, y
-- no abre otra columna de profiles a lectura de todos.
--
-- Qué hace este archivo: cuando cambia la contraseña de una cuenta (la crea
-- en /crear-contrasena, o usa "Olvidé mi contraseña"), la marca se borra en la
-- misma escritura. Así nadie depende de que el navegador "avise" que ya la
-- cambió.
--
-- Ojo: la marca también se borra si un ADMIN cambia la contraseña. Por eso el
-- script, al reenviar una contraseña temporal, la vuelve a poner en una
-- segunda escritura (después de cambiar la contraseña, no en la misma).
--
-- Correr en el SQL Editor de Supabase ANTES de usar el script de alta.

CREATE OR REPLACE FUNCTION public.clear_must_change_password()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.encrypted_password IS DISTINCT FROM OLD.encrypted_password
     AND coalesce(NEW.raw_app_meta_data ? 'must_change_password', false) THEN
    NEW.raw_app_meta_data := NEW.raw_app_meta_data - 'must_change_password';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_password_changed ON auth.users;
CREATE TRIGGER on_auth_user_password_changed
  BEFORE UPDATE OF encrypted_password ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.clear_must_change_password();

-- Verificación (debe devolver una fila):
-- SELECT tgname FROM pg_trigger WHERE tgname = 'on_auth_user_password_changed';
