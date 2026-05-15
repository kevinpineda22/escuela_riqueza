-- Agrega columna badge_image_url a la tabla modules
-- para mostrar imágenes personalizadas en la sección de insignias.

alter table public.modules
add column if not exists badge_image_url text;

-- Opcional: bucket de storage para subir insignias desde el panel admin
-- (descomentar si se quiere usar):
-- insert into storage.buckets (id, name, public) values ('badges', 'badges', true)
-- on conflict (id) do nothing;
