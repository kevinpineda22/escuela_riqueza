-- Protect privileged columns of public.profiles from direct client writes.
--
-- Problem (verified 2026-10-09): the policy "Users can update own profile"
-- is `USING (auth.uid() = id)` with no column restriction, and profiles had
-- no triggers. Any logged-in user could run, from the browser console:
--   supabase.from("profiles").update({ role: "admin" }).eq("id", myId)
-- and become admin (every admin RLS policy in this project trusts
-- profiles.role), give themselves `plan = 'vip'`, or lift their own
-- suspension. The INSERT policy had the same gap for a profile row inserted
-- by the client.
--
-- Fix: a BEFORE INSERT OR UPDATE trigger that looks at WHO is writing.
-- PostgREST runs client requests as the database role `authenticated` or
-- `anon`. Legitimate privileged writers do not:
--   - admin RPCs (admin_update_user_plan, admin_toggle_suspend, ...) and the
--     signup / email-sync triggers are SECURITY DEFINER, so `current_user`
--     is their owner;
--   - server code using the service-role key runs as `service_role`.
-- The trigger function is deliberately SECURITY INVOKER (the default): a
-- SECURITY DEFINER trigger would always see its own owner as current_user
-- and could not tell the client apart.
--
-- Students can still edit their own full_name / avatar_url (the only columns
-- the app updates directly, see StudentDashboard.tsx).

CREATE OR REPLACE FUNCTION public.protect_profile_privileged_columns()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF current_user NOT IN ('authenticated', 'anon') THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    -- A client-inserted profile always starts unprivileged; email is owned
    -- by the auth.users sync trigger.
    NEW.role := 'student';
    NEW.plan := 'free';
    NEW.is_suspended := false;
    NEW.email := NULL;
    RETURN NEW;
  END IF;

  IF NEW.role IS DISTINCT FROM OLD.role
     OR NEW.plan IS DISTINCT FROM OLD.plan
     OR NEW.is_suspended IS DISTINCT FROM OLD.is_suspended
     OR NEW.email IS DISTINCT FROM OLD.email THEN
    RAISE EXCEPTION 'Not allowed to change role, plan, suspension or email of a profile'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_profiles_protect_privileged_columns ON public.profiles;
CREATE TRIGGER trg_profiles_protect_privileged_columns
  BEFORE INSERT OR UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_profile_privileged_columns();

-- Rollback (only if this trigger breaks a legitimate flow):
-- DROP TRIGGER IF EXISTS trg_profiles_protect_privileged_columns ON public.profiles;
