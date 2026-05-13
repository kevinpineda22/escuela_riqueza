-- 1. Agregar columnas (si no existen)
ALTER TABLE public.lives ADD COLUMN IF NOT EXISTS background_image_url text;
ALTER TABLE public.lives ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT false;
ALTER TABLE public.lives ADD COLUMN IF NOT EXISTS is_paused boolean NOT NULL DEFAULT false;
ALTER TABLE public.lives ADD COLUMN IF NOT EXISTS recording_stream_uid text;

-- 2. RLS para la tabla lives (permite CRUD a usuarios autenticados)
ALTER TABLE public.lives ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all for authenticated on lives" ON public.lives;
CREATE POLICY "Allow all for authenticated on lives" ON public.lives
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);

-- 3. RLS para el bucket backgrounds en Storage
-- (asegurate de haber creado el bucket 'backgrounds' primero en Supabase Storage)
DROP POLICY IF EXISTS "Allow authenticated uploads backgrounds" ON storage.objects;
CREATE POLICY "Allow authenticated uploads backgrounds" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'backgrounds');

DROP POLICY IF EXISTS "Allow public viewing backgrounds" ON storage.objects;
CREATE POLICY "Allow public viewing backgrounds" ON storage.objects
  FOR SELECT TO public
  USING (bucket_id = 'backgrounds');

-- 4. RLS para live_messages
ALTER TABLE public.live_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow read live_messages authenticated" ON public.live_messages;
CREATE POLICY "Allow read live_messages authenticated" ON public.live_messages
  FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Allow insert live_messages authenticated" ON public.live_messages;
CREATE POLICY "Allow insert live_messages authenticated" ON public.live_messages
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- 5. HABILITAR REALTIME para que VIP vea cambios sin recargar
-- Esto es crítico: sin esto, el botón "Forzar EN VIVO" no se refleja en la sala VIP hasta F5
ALTER PUBLICATION supabase_realtime ADD TABLE public.lives;
ALTER PUBLICATION supabase_realtime ADD TABLE public.live_messages;

-- 6. ⚠️ PASO MANUAL EN CLOUDFLARE DASHBOARD
-- Ve a Cloudflare Dashboard → Stream → Live Inputs
-- → Editar el Live Input que usás
-- → Activar "WebRTC" y "Low-Latency HLS"
-- → Guardar cambios
