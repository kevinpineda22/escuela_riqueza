-- Admin-only RPCs that return profiles INCLUDING the email column.
--
-- PHASE 1 of 2 for hiding profiles.email from anon/authenticated.
-- Safe to run at any time, BEFORE the frontend deploy: it only adds functions
-- and does not change any existing grant or policy.
--
-- Why: public.profiles currently has a SELECT policy open to everyone, so any
-- client holding the anon key can read every user's email. Phase 2
-- (sql/migrate-profiles-hide-email.sql) revokes column-level access to
-- `email`. The admin panel still needs the email, so it reads it through these
-- SECURITY DEFINER functions, which check that the caller is an admin.
--
-- The return type is an explicit TABLE (not SETOF public.profiles) so a column
-- added to profiles in the future is NOT exposed here until it is added on
-- purpose. NOTE: CREATE OR REPLACE cannot change a function's return type; if
-- the column list below ever changes, run
--   DROP FUNCTION public.admin_list_users();
--   DROP FUNCTION public.admin_get_user(uuid);
-- first and then re-run this file.

CREATE OR REPLACE FUNCTION public.admin_list_users()
RETURNS TABLE (
  id uuid,
  full_name text,
  avatar_url text,
  role public.user_role,
  created_at timestamptz,
  email text,
  is_suspended boolean,
  updated_at timestamptz,
  plan public.plan_type
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller_role public.user_role;
BEGIN
  SELECT cp.role INTO caller_role FROM public.profiles cp WHERE cp.id = auth.uid();
  IF caller_role IS DISTINCT FROM 'admin' THEN
    RAISE EXCEPTION 'Not authorized. Only admins can list users.'
      USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
    SELECT p.id, p.full_name, p.avatar_url, p.role, p.created_at, p.email,
           p.is_suspended, p.updated_at, p.plan
    FROM public.profiles p
    ORDER BY p.created_at DESC;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_get_user(target_user_id uuid)
RETURNS TABLE (
  id uuid,
  full_name text,
  avatar_url text,
  role public.user_role,
  created_at timestamptz,
  email text,
  is_suspended boolean,
  updated_at timestamptz,
  plan public.plan_type
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller_role public.user_role;
BEGIN
  SELECT cp.role INTO caller_role FROM public.profiles cp WHERE cp.id = auth.uid();
  IF caller_role IS DISTINCT FROM 'admin' THEN
    RAISE EXCEPTION 'Not authorized. Only admins can read a user.'
      USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
    SELECT p.id, p.full_name, p.avatar_url, p.role, p.created_at, p.email,
           p.is_suspended, p.updated_at, p.plan
    FROM public.profiles p
    WHERE p.id = target_user_id;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_list_users() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_get_user(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_list_users() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_get_user(uuid) TO authenticated;

-- Rollback:
-- DROP FUNCTION IF EXISTS public.admin_list_users();
-- DROP FUNCTION IF EXISTS public.admin_get_user(uuid);
