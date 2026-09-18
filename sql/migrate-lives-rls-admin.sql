-- Lives RLS hardening (H1 in docs/LIVE_STABILITY_PLAN.md)
-- Replaces the permissive "Allow all for authenticated on lives" policy.
-- Reads stay open (existing "Authenticated users can view lives" SELECT policy is kept).
-- Writes (INSERT / UPDATE / DELETE) are restricted to profiles.role = 'admin'.
-- The Cloudflare webhook uses the service role key and bypasses RLS, so it is unaffected.

ALTER TABLE public.lives ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all for authenticated on lives" ON public.lives;

DROP POLICY IF EXISTS "Admins can insert lives" ON public.lives;
CREATE POLICY "Admins can insert lives" ON public.lives
  FOR INSERT TO authenticated
  WITH CHECK (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

DROP POLICY IF EXISTS "Admins can update lives" ON public.lives;
CREATE POLICY "Admins can update lives" ON public.lives
  FOR UPDATE TO authenticated
  USING (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  )
  WITH CHECK (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

DROP POLICY IF EXISTS "Admins can delete lives" ON public.lives;
CREATE POLICY "Admins can delete lives" ON public.lives
  FOR DELETE TO authenticated
  USING (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

-- Verification (run as a non-admin user; both must fail with RLS violation):
-- update public.lives set is_paused = true where id = '<any-live-id>';
-- delete from public.lives where id = '<any-live-id>';
