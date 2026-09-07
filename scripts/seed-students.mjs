/**
 * Seed de estudiantes de prueba para Escuela de la Riqueza.
 *
 * Crea N usuarios con email ficticio + plan, usando la Admin API de Supabase
 * (requiere SUPABASE_SERVICE_ROLE_KEY en .env — nunca exponer al cliente).
 *
 * Uso:
 *   node --env-file=.env scripts/seed-students.mjs
 *
 * Rerun-safe: si el email ya existe, lo reporta y sigue.
 * Post-verificación: comprueba que el trigger handle_new_user() creó
 * profiles + subscriptions; si faltaran, las inserta manualmente.
 */
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.VITE_SUPABASE_URL ?? process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error("Faltan VITE_SUPABASE_URL y/o SUPABASE_SERVICE_ROLE_KEY en .env");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// ── Configuración del seed ────────────────────────────────────────────────
const COUNT = 10;
const PASSWORD = "Escuela2026!";
const PLAN = "vip"; // public.plan_type: free | individual | vip
const EMAIL_DOMAIN = "escueladelariqueza.com";

const NUMBER_WORDS = [
  "Uno", "Dos", "Tres", "Cuatro", "Cinco",
  "Seis", "Siete", "Ocho", "Nueve", "Diez",
];

const buildEmail = (i) => `estudiante${i}@${EMAIL_DOMAIN}`;

// ── 1. Crear usuarios ─────────────────────────────────────────────────────
console.log(`Creando ${COUNT} usuarios (plan=${PLAN})...\n`);

const created = [];
const failed = [];

for (let i = 1; i <= COUNT; i++) {
  const email = buildEmail(i);
  const fullName = `Estudiante ${NUMBER_WORDS[i - 1]}`;

  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password: PASSWORD,
    email_confirm: true, // evita que el trigger de bienvenida mande correo a emails ficticios
    user_metadata: { full_name: fullName, plan: PLAN },
  });

  if (error) {
    failed.push({ email, reason: error.message });
    console.log(`  [SKIP] ${email} — ${error.message}`);
  } else {
    created.push({ id: data.user.id, email });
    console.log(`  [OK]   ${email} → ${data.user.id}`);
  }
}

console.log(`\nCreados: ${created.length} | Omitidos: ${failed.length}`);

// ── 2. Verificar que el trigger creó profiles + subscriptions ─────────────
if (created.length === 0) {
  console.log("\nNada que verificar.");
  process.exit(failed.length ? 1 : 0);
}

const ids = created.map((c) => c.id);
const emails = created.map((c) => c.email);

const { data: profiles, error: profilesErr } = await supabase
  .from("profiles")
  .select("id, email, role, plan")
  .in("id", ids);

const { data: subs, error: subsErr } = await supabase
  .from("subscriptions")
  .select("user_id, plan, status, current_period_end")
  .in("user_id", ids);

if (profilesErr) console.error("\n[WARN] No se pudo leer profiles:", profilesErr.message);
if (subsErr) console.error("[WARN] No se pudo leer subscriptions:", subsErr.message);

const profileIds = new Set((profiles ?? []).map((p) => p.id));
const subIds = new Set((subs ?? []).map((s) => s.user_id));

const missingProfile = created.filter((c) => !profileIds.has(c.id));
const missingSub = created.filter((c) => !subIds.has(c.id));

let fixed = 0;

// Si el trigger no corrió (p.ej. no instalado), creamos lo faltante manualmente
for (const c of missingProfile) {
  const fullName = `Estudiante ${NUMBER_WORDS[created.indexOf(c)]}`;
  const { error } = await supabase.from("profiles").insert({
    id: c.id, full_name: fullName, email: c.email, role: "student", plan: PLAN,
  });
  if (error) console.error(`[FIX-FAIL] profile ${c.email}: ${error.message}`);
  else { fixed++; console.log(`  [FIX] profile creado para ${c.email}`); }
}

for (const c of missingSub) {
  const { error } = await supabase.from("subscriptions").insert({
    user_id: c.id, plan: PLAN, status: "active",
    current_period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
  });
  if (error) console.error(`[FIX-FAIL] subscription ${c.email}: ${error.message}`);
  else { fixed++; console.log(`  [FIX] subscription creada para ${c.email}`); }
}

// ── 3. Resumen final ──────────────────────────────────────────────────────
console.log("\n── Resumen ──");
console.log(`Usuarios creados:          ${created.length}`);
console.log(`Omitidos (ya existían/err): ${failed.length}`);
console.log(`Registros de plan reparados: ${fixed}`);
console.log(`Contraseña compartida:      ${PASSWORD}`);

if (failed.length > 0) {
  console.log("\nOmitidos detalle:");
  for (const f of failed) console.log(`  - ${f.email}: ${f.reason}`);
}