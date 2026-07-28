-- Migración: archivado de grabaciones de lives en Cloudflare R2.
-- Ver docs/RECORDINGS_ARCHITECTURE.md para el contexto completo.
--
-- Agrega columnas a `lives` para trackear dónde vive cada grabación (Stream vs R2),
-- su tamaño y duración (para estimar costo/minutos), y cuándo se archivó.

alter table public.lives
  -- Clave del objeto en el bucket R2 (ej. "recordings/<live_id>.mp4").
  add column if not exists recording_r2_key text,
  -- Dónde vive la grabación actualmente: 'stream' | 'r2' | null (sin grabación).
  add column if not exists recording_storage text
    check (recording_storage in ('stream', 'r2')),
  -- Tamaño del MP4 en bytes (para estimar costo de storage en R2).
  add column if not exists recording_bytes bigint,
  -- Duración de la grabación en segundos (para sumar minutos y estimar costo).
  add column if not exists recording_duration_seconds integer,
  -- Momento en que se completó el archivado a R2 y se borró de Stream.
  add column if not exists archived_at timestamptz;

-- Backfill: las grabaciones existentes que ya tienen recording_stream_uid
-- se marcan como almacenadas en Stream, para que el player siga sirviéndolas
-- por el camino viejo hasta que se migren a R2.
update public.lives
set recording_storage = 'stream'
where recording_stream_uid is not null
  and recording_stream_uid <> ''
  and recording_storage is null;

-- Nota: NO se agregan policies nuevas de RLS aquí. El acceso a las grabaciones
-- en R2 se controla por URL firmada de vida corta generada en
-- api/stream/recording-url.ts (valida el plan del usuario antes de firmar).
