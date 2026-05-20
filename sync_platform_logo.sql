-- Migración: agregar columna logo_url a platform_settings
-- Permite que el admin cambie el logo de la plataforma desde el panel.
-- El upload va directo del cliente a Cloudflare Images vía /api/images/upload-url

alter table public.platform_settings
  add column if not exists logo_url text;

-- Default (logo actual) para el registro global existente
update public.platform_settings
   set logo_url = coalesce(logo_url, 'https://imagedelivery.net/HGkLNfdVjFNAti8ZHHgxtQ/18dc9190-6625-4b89-8f1e-3f221e96b500/public')
 where id = 'global';

-- Verificación
select id, platform_name, logo_url from public.platform_settings where id = 'global';
