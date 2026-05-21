-- ============================================================================
-- Modificar función is_vip_or_admin para permitir también a 'individual'
-- y crear Storage para imágenes de la comunidad
-- ============================================================================

-- 1. Ampliar permisos a plan individual
CREATE OR REPLACE FUNCTION public.is_vip_or_admin(uid uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = uid AND (role = 'admin' OR plan = 'vip' OR plan = 'individual')
  );
$$;

-- 2. Crear bucket de Storage si no existe
INSERT INTO storage.buckets (id, name, public)
VALUES ('community_images', 'community_images', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- 3. Políticas de Storage
-- Todo el mundo puede ver las imágenes
DROP POLICY IF EXISTS "Public community images" ON storage.objects;
CREATE POLICY "Public community images"
ON storage.objects FOR SELECT
USING (bucket_id = 'community_images');

-- Usuarios con acceso pueden subir
DROP POLICY IF EXISTS "Users can upload community images" ON storage.objects;
CREATE POLICY "Users can upload community images"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'community_images' 
  AND auth.role() = 'authenticated'
  AND public.is_vip_or_admin(auth.uid())
);

-- Dueños o admins pueden borrar
DROP POLICY IF EXISTS "Users can delete own community images" ON storage.objects;
CREATE POLICY "Users can delete own community images"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'community_images' 
  AND (
    auth.uid() = owner 
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  )
);
