-- ============================================================================
-- COMUNIDAD VIP - Agregar soporte de imágenes a los posts
-- ============================================================================

ALTER TABLE public.community_posts
ADD COLUMN IF NOT EXISTS image_url text;
