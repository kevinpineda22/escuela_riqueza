-- Hide profiles.email from anon and authenticated (column-level SELECT).
--
-- PHASE 2 of 2. Run ONLY AFTER:
--   1. sql/migrate-profiles-admin-user-rpcs.sql has been run, AND
--   2. the new frontend (no `select("*")` on profiles; admin panel using the
--      admin_list_users / admin_get_user RPCs) is deployed to production.
--
-- If this runs BEFORE the frontend deploy, the old frontend's
-- `.from("profiles").select("*")` fails with "permission denied for column
-- email": login (signIn / getCurrentUser) and the admin user list break.
--
-- Problem (verified 2026-10-09): the SELECT policy "Profiles are viewable by
-- everyone" is `true` for role `public`, so anyone with the anon key (no
-- login) can read every user's email. Rows must stay readable (chat names,
-- community authors, and the many RLS policies that run
-- `exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')`
-- as the invoking user), so the fix is per column: only `email` is removed.
--
-- Unaffected on purpose:
--   - INSERT / UPDATE / DELETE privileges (only SELECT is revoked). A
--     supabase-js `.update()` without `.select()` sends `Prefer: return=minimal`
--     and does not need SELECT on email.
--   - The trigger trg_profiles_protect_privileged_columns (reads NEW/OLD
--     directly, no column privilege check).
--   - service_role, postgres and SECURITY DEFINER functions (they do not run
--     as anon/authenticated).
--
-- WARNING: any NEW column added to public.profiles is invisible to the app
-- until it is added to the GRANT below (or to a follow-up migration).
-- `select("*")` on profiles from the browser is no longer allowed.

REVOKE SELECT ON public.profiles FROM anon, authenticated;

GRANT SELECT (id, full_name, avatar_url, role, created_at, is_suspended, updated_at, plan)
  ON public.profiles TO anon, authenticated;

-- Rollback (restores the previous, email-exposing behavior):
-- GRANT SELECT ON public.profiles TO anon, authenticated;
