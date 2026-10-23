-- Registro de errores del navegador: ¿plataforma o red del usuario?
-- Correr ANTES de deployar el front que llama a /api/errors (si no, los reportes
-- fallan en silencio y la vista del admin muestra "falta la tabla").
--
-- Quién escribe: SOLO /api/errors con la service key (valida, limita por IP y
-- resuelve el usuario desde el token). Quién lee: los admins, desde el panel.
-- RLS habilitada: sin policy de insert, el navegador no puede escribir directo.

create table if not exists public.client_errors (
  id uuid primary key default gen_random_uuid(),
  -- Código corto que ve el usuario ("Código: K7F2QA") y que pasa al reportar.
  code text not null check (code ~ '^[A-Z0-9]{6}$'),
  created_at timestamptz not null default now(),
  user_id uuid references auth.users (id) on delete set null,
  -- platform | network | offline | timeout
  kind text not null check (kind in ('platform', 'network', 'offline', 'timeout')),
  -- Dónde se capturó: supabase, api, boundary, global, toast…
  source text not null,
  message text not null,
  status int,
  -- "GET /rest/v1/lessons" — sin query string (puede tener ids o tokens).
  request text,
  -- Pantalla donde estaba el usuario.
  path text,
  -- Fallas de red agrupadas: cuántas hubo desde el último envío.
  occurrences int not null default 1 check (occurrences between 1 and 10000),
  user_agent text,
  detail jsonb
);

create index if not exists client_errors_created_at_idx on public.client_errors (created_at desc);
create index if not exists client_errors_code_idx on public.client_errors (code);
create index if not exists client_errors_kind_idx on public.client_errors (kind, created_at desc);

alter table public.client_errors enable row level security;

drop policy if exists "client_errors admin read" on public.client_errors;
create policy "client_errors admin read" on public.client_errors
  for select using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

drop policy if exists "client_errors admin delete" on public.client_errors;
create policy "client_errors admin delete" on public.client_errors
  for delete using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );
