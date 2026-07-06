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
  ('footer_tagline', 'Tu transformación empieza hoy.'),
  -- Página /historia
  ('history_badge', 'Nuestra historia'),
  ('history_title', '¿Qué es la Escuela de La Riqueza y por qué llegó para'),
  ('history_title_accent', 'cambiar tu vida?'),
  ('history_quote_1', '“La riqueza es una consecuencia de la transformación mental, del carácter, de la conciencia y de la manera de servir al mundo”.'),
  ('history_intro_1', 'La Escuela de la riqueza es un programa de rediseño cerebral basado en el uso de la inteligencia en su máxima expresión. Enseñamos todo lo que no se enseña en la academia cuya función es preparar sólo la mente racional. De ningún modo los contenidos de la academia tradicional preparan al empresario; la academia es muy buena para preparar gerentes y administradores, no empresarios.'),
  ('history_intro_2', 'La Escuela de la Riqueza está orientada a transformar la mentalidad del empresario y del directivo para que desarrolle una mente cósmica, de carácter mundial que lo lleve a concebir la innovación mental como el fundamento de su nuevo modelo de pensar la vida empresarial y la competitividad de este exigente siglo XXI.'),
  ('history_founder_title', '¿Quién fundó La Escuela de la Riqueza?'),
  ('history_founder_1', 'Es un programa único en su genero, radicalmente innovador en sus contenidos, creado por Iván Mazo Mejía hace 15 años, consultor y asesor empresarial desde hace 27 años en varios países de América y con experiencia en todo tipo de industrias.'),
  ('history_founder_2', 'Dicha experiencia me permite plantear este rediseño cerebral en función de entregarle al mundo un nuevo modelo de empresario que potencia su inteligencia de una manera más integradora, más creadora, y sobre todo más comprometida con la nueva competitividad mundial.'),
  ('history_founder_3', 'La Escuela de la Riqueza enseña al empresario a ver de una forma totalmente diferente la realidad que vive, lo dota de conceptos que le generan grandes transformaciones mentales de tal manera que al terminar el ciclo ya no vuelve a ser el mismo que llegó.'),
  ('history_audience_title', 'Para quién es la Escuela de la Riqueza'),
  ('history_audience_1', 'es un innovador programa de formación para empresarios que se toman la vida con carácter y poder. Aunque usted tenga una empresa es posible que su vida no sea la de un empresario, eso ocurre demasiado y es uno de los aspectos que más bloquea la riqueza.'),
  ('history_audience_2', 'Escuela de la Riqueza acoge a jóvenes que están soñando su vida como empresarios. Nuestro revolucionario programa despierta el genio creador que cada joven lleva dentro.'),
  ('history_audience_3', 'Por la Escuela de la Riqueza pasan profesionales de todas las disciplinas que se ven enfrentadas a la realidad de formar empresa y no saben qué pasos dar, cómo se pueden proyectar, hacia donde deben dirigir sus esfuerzos, en qué se deben centrar sus acciones de cada día.'),
  ('history_quote_2', '“La verdadera riqueza no es cuánto dinero produces, sino en quién te conviertes mientras lo produces”.')
on conflict (key) do nothing;
