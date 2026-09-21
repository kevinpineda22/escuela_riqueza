-- ============================================================================
-- Comunidad: lectura para Free, escritura solo Individual/VIP/admin
-- ============================================================================
-- Modelo de seguridad:
--   - can_read_community(uid)  -> true para cualquier perfil con plan
--     free/individual/vip, o role='admin'. Free puede VER posts, comentarios
--     y likes, pero no puede crear/editar/borrar nada (eso sigue gateado por
--     is_vip_or_admin).
--   - is_vip_or_admin(uid)     -> sin cambios, sigue siendo el gate de
--     escritura (INSERT/UPDATE/DELETE) para individual/vip/admin.
-- Idempotente: se puede correr múltiples veces sin efectos secundarios.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Helper de lectura
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.can_read_community(uid uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = uid
      AND (role = 'admin' OR plan IN ('free', 'individual', 'vip'))
  );
$$;

GRANT EXECUTE ON FUNCTION public.can_read_community(uuid) TO authenticated;

-- ----------------------------------------------------------------------------
-- 2. POSTS — SELECT ahora usa can_read_community; INSERT/UPDATE/DELETE
--    quedan igual (is_vip_or_admin / autor-o-admin).
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "VIP can view posts" ON public.community_posts;
DROP POLICY IF EXISTS "Community can view posts" ON public.community_posts;
CREATE POLICY "Community can view posts" ON public.community_posts
  FOR SELECT USING (public.can_read_community(auth.uid()));

-- ----------------------------------------------------------------------------
-- 3. COMMENTS — SELECT ahora usa can_read_community.
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "VIP can view comments" ON public.community_comments;
DROP POLICY IF EXISTS "Community can view comments" ON public.community_comments;
CREATE POLICY "Community can view comments" ON public.community_comments
  FOR SELECT USING (public.can_read_community(auth.uid()));

-- ----------------------------------------------------------------------------
-- 4. LIKES — SELECT ahora usa can_read_community (necesario para que el
--    cliente resuelva "liked_by_me" al listar posts/comentarios).
--    INSERT sigue exigiendo is_vip_or_admin (solo quien puede escribir puede
--    dar like).
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "VIP can view likes" ON public.community_likes;
DROP POLICY IF EXISTS "Community can view likes" ON public.community_likes;
CREATE POLICY "Community can view likes" ON public.community_likes
  FOR SELECT USING (public.can_read_community(auth.uid()));

-- ----------------------------------------------------------------------------
-- 5. Storage de imágenes de la comunidad: ya es público en
--    sql/sync_community_individual_storage.sql ("Public community images"
--    FOR SELECT USING (bucket_id = 'community_images')), sin gate de plan.
--    No requiere cambios: Free ya puede ver las imágenes adjuntas a los posts.
--    El INSERT de storage.objects sigue exigiendo is_vip_or_admin (sin tocar).
-- ============================================================================
