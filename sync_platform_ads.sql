-- Agrega nuevos campos para el control detallado de anuncios en el plan Free
ALTER TABLE public.platform_settings
ADD COLUMN IF NOT EXISTS free_ad_type text NOT NULL DEFAULT 'both' CHECK (free_ad_type IN ('preroll', 'midroll', 'both', 'none')),
ADD COLUMN IF NOT EXISTS free_ads_per_block integer NOT NULL DEFAULT 1;

-- Comentario para registro
COMMENT ON COLUMN public.platform_settings.free_ad_type IS 'preroll (solo inicio), midroll (solo intervalos), both (ambos), none (desactivados)';
COMMENT ON COLUMN public.platform_settings.free_ads_per_block IS 'Cantidad de anuncios consecutivos por pausa publicitaria';
