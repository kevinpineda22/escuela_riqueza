-- Los admins pueden LEER todas las suscripciones.
--
-- Síntoma: en /admin/users la columna "Vigencia" sale "—" para todos, aunque
-- cada perfil tiene su suscripción activa (verificado con la service role:
-- 89 perfiles, 0 sin suscripción, 74 VIP sin fecha). La RLS de
-- `subscriptions` solo deja ver la fila propia, así que la consulta del panel
-- vuelve vacía sin error.
--
-- Solo lectura: los cambios de plan siguen pasando por el endpoint
-- /api/admin/users (service role) o el RPC admin_update_user_plan.
--
-- Para ver las políticas que ya hay (antes o después):
--   SELECT policyname, cmd, roles, qual FROM pg_policies WHERE tablename = 'subscriptions';

DROP POLICY IF EXISTS "Admins can read all subscriptions" ON public.subscriptions;

CREATE POLICY "Admins can read all subscriptions"
  ON public.subscriptions
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = (SELECT auth.uid()) AND p.role = 'admin'
    )
  );
