-- Migración: Tabla landing_texts para Live Edit Mode
-- Permite a los administradores editar textos de la landing page desde la UI.

create table if not exists public.landing_texts (
  key text primary key,
  value text not null default '',
  updated_at timestamptz default timezone('utc'::text, now()) not null
);

-- RLS: lectura pública, escritura solo admin. Idempotente (drop if exists).
alter table public.landing_texts enable row level security;

drop policy if exists "lectura_publica" on public.landing_texts;
create policy "lectura_publica" on public.landing_texts
  for select using (true);

drop policy if exists "solo_admin_edita" on public.landing_texts;
create policy "solo_admin_edita" on public.landing_texts
  for insert with check (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

drop policy if exists "solo_admin_actualiza" on public.landing_texts;
create policy "solo_admin_actualiza" on public.landing_texts
  for update using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  )
  with check (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

drop policy if exists "solo_admin_elimina" on public.landing_texts;
create policy "solo_admin_elimina" on public.landing_texts
  for delete using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

-- Grants de tabla (RLS filtra las filas; los grants habilitan la operación).
grant select on public.landing_texts to anon, authenticated;
grant insert, update, delete on public.landing_texts to authenticated;

-- Poblar con valores iniciales (los textos actuales de la landing)
-- Esto asegura que la tabla tenga registros desde el inicio y el
-- componente EditableField tenga de dónde leer.
insert into public.landing_texts (key, value) values
  ('hero_title', 'Una escuela de'),
  ('hero_accent', 'rediseño cerebral'),
  ('hero_subtitle', 'para que te conviertas en el'),
  ('hero_accent_2', 'gigante mental'),
  ('hero_subtitle_end', 'que llevas dentro.'),
  ('awakening_question', '¿Cuántas oportunidades dejaste pasar?'),
  ('awakening_answer', 'Es momento de'),
  ('awakening_accent', 'cambiar.'),
  ('stat_1_value', '15.000+'),
  ('stat_1_label', 'Alumnos transformados'),
  ('stat_2_value', '120 h'),
  ('stat_2_label', 'Horas de contenido'),
  ('stat_3_value', '6'),
  ('stat_3_label', 'Inteligencias críticas'),
  ('intelligences_title_prefix', 'Seis inteligencias.'),
  ('intelligences_title_accent', 'Una transformación.'),
  ('intelligences_description', 'Cada módulo es una pieza del rediseño. Recórrelas a tu ritmo.'),
  ('path_title', 'Tu camino en'),
  ('path_accent', 'tres pasos'),
  ('path_subtitle', 'Aprender, practicar, transformar. Sin atajos, sin promesas vacías.'),
  ('path_step_1_title', 'Aprende'),
  ('path_step_1_desc', 'Asimila los marcos mentales en clases pre-grabadas de alto valor. Cada lección entrega un concepto claro y aplicable desde el día uno.'),
  ('path_step_2_title', 'Practica'),
  ('path_step_2_desc', 'Aplica lo aprendido con ejercicios y desafíos semanales. La comunidad y los lives VIP te acompañan en la construcción de hábitos sólidos.'),
  ('path_step_3_title', 'Transforma'),
  ('path_step_3_desc', 'Resultados medibles en tu economía, decisiones y propósito. Esto no es teoría motivacional — es rediseño real, sostenido en el tiempo.'),
  ('plans_title', 'Elige tu Plan de Crecimiento'),
  ('plans_subtitle', 'Impulsa tu desarrollo al nivel que necesitas. Comienza gratis o accede a la experiencia completa.'),
  ('footer_tagline', 'Tu transformación empieza hoy.')
on conflict (key) do nothing;
