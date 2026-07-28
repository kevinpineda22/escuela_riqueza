-- =========================================================
-- platform_settings: configuración global de la plataforma
-- Singleton (1 sola fila, id='global'). Lectura pública,
-- escritura sólo para admins.
-- =========================================================

create table if not exists public.platform_settings (
  id text primary key default 'global',
  -- Identidad
  platform_name text not null default 'Escuela de la Riqueza',
  support_email text not null default 'soporte@escuelariqueza.com',
  contact_phone text,
  whatsapp_number text default '573122975931',
  instagram_url text,
  facebook_url text default 'https://www.facebook.com/IvanMazoOficial',
  youtube_url text,
  tiktok_url text,
  footer_tagline text default 'Educación financiera con propósito.',

  -- Operativa
  maintenance_mode boolean not null default false,
  maintenance_message text default 'Estamos realizando mejoras. Volvemos pronto.',
  allow_signups boolean not null default true,
  default_signup_plan text not null default 'free' check (default_signup_plan in ('free','individual','vip')),

  -- Pagos (simulación / planes)
  currency text not null default 'USD' check (currency in ('USD','COP','MXN','EUR')),
  price_individual_monthly numeric(10,2) not null default 29.00,
  price_vip_monthly numeric(10,2) not null default 99.00,
  trial_days int not null default 0 check (trial_days >= 0),
  free_ad_frequency_seconds int not null default 120 check (free_ad_frequency_seconds >= 30),

  -- Notificaciones (toggles, sin efecto hasta que se conecte SMTP)
  notif_welcome_email boolean not null default true,
  notif_new_module boolean not null default true,
  notif_live_reminder boolean not null default true,
  notif_marketing boolean not null default false,

  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles(id) on delete set null,

  constraint platform_settings_singleton check (id = 'global')
);

-- Insertar fila inicial si no existe
insert into public.platform_settings (id) values ('global')
on conflict (id) do nothing;

-- Trigger: actualiza updated_at y updated_by
create or replace function public.platform_settings_touch()
returns trigger
language plpgsql
security definer
as $$
begin
  new.updated_at := now();
  new.updated_by := auth.uid();
  return new;
end;
$$;

drop trigger if exists trg_platform_settings_touch on public.platform_settings;
create trigger trg_platform_settings_touch
  before update on public.platform_settings
  for each row execute function public.platform_settings_touch();

-- =========================================================
-- RLS: lectura pública, update solo admins
-- =========================================================
alter table public.platform_settings enable row level security;

drop policy if exists "platform_settings_read_public" on public.platform_settings;
create policy "platform_settings_read_public"
  on public.platform_settings
  for select
  using (true);

drop policy if exists "platform_settings_admin_update" on public.platform_settings;
create policy "platform_settings_admin_update"
  on public.platform_settings
  for update
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  )
  with check (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  );

-- No INSERT ni DELETE: la fila singleton se crea aquí y nunca se borra.

grant select on public.platform_settings to anon, authenticated;
grant update on public.platform_settings to authenticated;
