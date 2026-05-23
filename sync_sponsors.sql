-- =========================================================
-- sponsors: sistema de aliados/patrocinadores publicitarios
-- ad_sponsors: aliados con peso relativo (auto-normalizado a %)
-- ad_videos:   videos publicitarios vinculados a cada aliado
-- =========================================================
-- Idempotente. Re-ejecutable. RLS estricto: lectura pública
-- de filas activas (para que el LessonPlayer pueda consumir),
-- escritura solo admin.
-- =========================================================

-- ---------- Tabla: ad_sponsors ----------
create table if not exists public.ad_sponsors (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  logo_url text,
  weight integer not null default 10 check (weight >= 0 and weight <= 1000),
  is_active boolean not null default true,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.ad_sponsors is
  'Aliados publicitarios. weight es relativo (no necesariamente suma 100); el frontend lo normaliza a %.';
comment on column public.ad_sponsors.weight is
  'Peso relativo (0-1000). A mayor peso, mayor probabilidad de salir su anuncio.';

create index if not exists idx_ad_sponsors_active on public.ad_sponsors(is_active) where is_active = true;

-- ---------- Tabla: ad_videos ----------
create table if not exists public.ad_videos (
  id uuid primary key default gen_random_uuid(),
  sponsor_id uuid not null references public.ad_sponsors(id) on delete cascade,
  title text not null,
  stream_uid text not null,
  duration_seconds integer,
  is_active boolean not null default true,
  impression_count bigint not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.ad_videos is
  'Videos publicitarios subidos a Cloudflare Stream. Un aliado puede tener múltiples videos; al elegirlo, se rota aleatoriamente entre sus videos activos.';
comment on column public.ad_videos.stream_uid is 'UID del video en Cloudflare Stream.';
comment on column public.ad_videos.impression_count is 'Contador de veces que se reprodujo este anuncio (impresiones).';

create index if not exists idx_ad_videos_sponsor on public.ad_videos(sponsor_id);
create index if not exists idx_ad_videos_active on public.ad_videos(is_active) where is_active = true;

-- ---------- Trigger: touch updated_at ----------
create or replace function public.ad_touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_ad_sponsors_touch on public.ad_sponsors;
create trigger trg_ad_sponsors_touch
  before update on public.ad_sponsors
  for each row execute function public.ad_touch_updated_at();

drop trigger if exists trg_ad_videos_touch on public.ad_videos;
create trigger trg_ad_videos_touch
  before update on public.ad_videos
  for each row execute function public.ad_touch_updated_at();

-- ---------- RPC: incrementar impresiones (atómico) ----------
create or replace function public.increment_ad_impression(p_video_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.ad_videos
    set impression_count = impression_count + 1
    where id = p_video_id;
end;
$$;

comment on function public.increment_ad_impression is
  'Incrementa atómicamente el contador de impresiones de un anuncio. Cualquier usuario puede llamarlo (es solo un contador, no datos sensibles).';

grant execute on function public.increment_ad_impression(uuid) to anon, authenticated;

-- ---------- RLS ----------
alter table public.ad_sponsors enable row level security;
alter table public.ad_videos   enable row level security;

-- ad_sponsors: lectura pública de filas activas; admin ve todas y escribe
drop policy if exists "ad_sponsors_select_active" on public.ad_sponsors;
create policy "ad_sponsors_select_active"
  on public.ad_sponsors for select
  using (
    is_active = true
    or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
  );

drop policy if exists "ad_sponsors_admin_insert" on public.ad_sponsors;
create policy "ad_sponsors_admin_insert"
  on public.ad_sponsors for insert
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));

drop policy if exists "ad_sponsors_admin_update" on public.ad_sponsors;
create policy "ad_sponsors_admin_update"
  on public.ad_sponsors for update
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));

drop policy if exists "ad_sponsors_admin_delete" on public.ad_sponsors;
create policy "ad_sponsors_admin_delete"
  on public.ad_sponsors for delete
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));

-- ad_videos: idem patrón
drop policy if exists "ad_videos_select_active" on public.ad_videos;
create policy "ad_videos_select_active"
  on public.ad_videos for select
  using (
    is_active = true
    or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
  );

drop policy if exists "ad_videos_admin_insert" on public.ad_videos;
create policy "ad_videos_admin_insert"
  on public.ad_videos for insert
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));

drop policy if exists "ad_videos_admin_update" on public.ad_videos;
create policy "ad_videos_admin_update"
  on public.ad_videos for update
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));

drop policy if exists "ad_videos_admin_delete" on public.ad_videos;
create policy "ad_videos_admin_delete"
  on public.ad_videos for delete
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));

grant select on public.ad_sponsors to anon, authenticated;
grant select on public.ad_videos   to anon, authenticated;
grant insert, update, delete on public.ad_sponsors to authenticated;
grant insert, update, delete on public.ad_videos   to authenticated;
