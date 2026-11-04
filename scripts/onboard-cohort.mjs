/**
 * Alta masiva de una cohorte: crea las cuentas, les da el plan y manda la
 * bienvenida con una contraseña temporal que hay que cambiar al entrar.
 *
 * Uso (desde la raíz del repo, con SUPABASE_SERVICE_ROLE_KEY y RESEND_API_KEY
 * en .env):
 *
 *   node --env-file=.env scripts/onboard-cohort.mjs --file <personas.csv> --plan vip --cohort cohorte-29
 *
 * Sin --send NO escribe nada: lista qué haría con cada persona (prueba).
 * Con --send crea las cuentas y manda los correos. Para probar con una sola:
 *   ... --send --only tu-correo@gmail.com
 *
 * Opciones:
 *   --file      CSV con columnas `nombre,correo` (encabezado en la 1.ª fila).
 *   --plan      free | individual | vip.
 *   --cohort    Clave de la cohorte (ej. cohorte-29): evita mandar dos veces la
 *               bienvenida a la misma persona por la misma cohorte.
 *   --label     Línea opcional en el correo (ej. "Presencial 2026 · Cohorte 29").
 *   --until     Fecha AAAA-MM-DD hasta la que dura el plan. Sin esto queda lo
 *               que pone el alta automática (30 días).
 *   --only      Procesar solo este correo.
 *   --send      Escribir de verdad.
 *
 * Qué hace con cada persona:
 *   - NUEVA: crea la cuenta (correo ya confirmado), contraseña temporal propia,
 *     marca `must_change_password` (la app obliga a cambiarla: ver
 *     sql/migrate-must-change-password.sql, que hay que correr ANTES), plan y
 *     correo de bienvenida.
 *   - YA EXISTÍA: no la toca. Se informa con su plan actual.
 *   - Creada pero sin bienvenida (falló el envío en una corrida anterior):
 *     genera otra contraseña temporal y reenvía. Rerun-safe.
 *
 * El informe final (sin contraseñas) queda junto al CSV de entrada.
 */
import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";
import { randomInt } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { cohortWelcomeEmail } from "./lib/cohortWelcomeEmail.mjs";

// ── Argumentos ────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const arg = (name) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] && !args[i + 1].startsWith("--") ? args[i + 1] : null;
};
const SEND = args.includes("--send");
const FILE = arg("file");
const PLAN = arg("plan");
const COHORT = arg("cohort");
const LABEL = arg("label") ?? "";
const UNTIL = arg("until");
const ONLY = arg("only")?.trim().toLowerCase() ?? null;

const PLANS = ["free", "individual", "vip"];
const fail = (msg) => {
  console.error(`\n✖ ${msg}\n`);
  process.exit(1);
};
if (!FILE) fail("Falta --file <personas.csv>");
if (!PLAN || !PLANS.includes(PLAN)) fail(`Falta --plan (${PLANS.join(" | ")})`);
if (!COHORT || !/^[a-z0-9-]+$/.test(COHORT)) fail("Falta --cohort (minúsculas, números y guiones, ej. cohorte-29)");
if (UNTIL && (!/^\d{4}-\d{2}-\d{2}$/.test(UNTIL) || Number.isNaN(Date.parse(UNTIL)))) fail("--until debe ser AAAA-MM-DD");

const SUPABASE_URL = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const RESEND_API_KEY = process.env.RESEND_API_KEY;
const APP_URL = (process.env.APP_URL || "https://www.escueladelariqueza.com").replace(/\/$/, "");
const EMAIL_FROM = process.env.EMAIL_FROM || "Escuela de la Riqueza <hola@escueladelariqueza.com>";
if (!SUPABASE_URL || !SERVICE_KEY) fail("Faltan VITE_SUPABASE_URL y/o SUPABASE_SERVICE_ROLE_KEY en .env");
if (SEND && !RESEND_API_KEY) fail("Falta RESEND_API_KEY en .env");
if (SEND && EMAIL_FROM.includes("resend.dev")) fail("EMAIL_FROM apunta al dominio de prueba de Resend: no le llegaría a nadie");

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const resend = SEND ? new Resend(RESEND_API_KEY) : null;
const EVENT_TYPE = "cohort_welcome";
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// ── CSV ───────────────────────────────────────────────────────────────────
/** CSV simple con comillas opcionales. Devuelve filas de celdas. */
function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === "," || ch === ";") { row.push(cell); cell = ""; }
    else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(cell); rows.push(row); row = []; cell = "";
    } else cell += ch;
  }
  if (cell !== "" || row.length) { row.push(cell); rows.push(row); }
  return rows.filter((r) => r.some((c) => c.trim() !== ""));
}

const [header, ...dataRows] = parseCsv(readFileSync(FILE, "utf8").replace(/^﻿/, ""));
const col = (name) => header.findIndex((h) => h.trim().toLowerCase() === name);
const nameCol = col("nombre");
const emailCol = col("correo");
if (nameCol < 0 || emailCol < 0) fail("El CSV necesita las columnas `nombre` y `correo` en la primera fila");

const people = dataRows
  .map((r) => ({
    name: (r[nameCol] ?? "").trim().replace(/\s+/g, " "),
    email: (r[emailCol] ?? "").trim().toLowerCase(),
  }))
  .filter((p) => !ONLY || p.email === ONLY);
if (ONLY && people.length === 0) fail(`${ONLY} no está en el CSV`);

// ── Utilidades ────────────────────────────────────────────────────────────
/** 12 caracteres sin confundibles (sin 0/O, 1/l/I), con mayúscula, minúscula y número. */
function tempPassword() {
  const sets = ["ABCDEFGHJKLMNPQRSTUVWXYZ", "abcdefghijkmnpqrstuvwxyz", "23456789"];
  const all = sets.join("");
  const chars = sets.map((s) => s[randomInt(s.length)]);
  while (chars.length < 12) chars.push(all[randomInt(all.length)]);
  for (let i = chars.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  const s = chars.join("");
  return `${s.slice(0, 4)}-${s.slice(4, 8)}-${s.slice(8)}`;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function loadUsersByEmail() {
  const map = new Map();
  for (let page = 1; ; page++) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) fail(`No se pudieron leer los usuarios: ${error.message}`);
    for (const u of data.users) if (u.email) map.set(u.email.trim().toLowerCase(), u);
    if (data.users.length < 1000) break;
  }
  return map;
}

async function currentPlan(userId) {
  const { data } = await supabase
    .from("subscriptions")
    .select("plan, status, current_period_end")
    .eq("user_id", userId)
    .order("current_period_end", { ascending: false, nullsFirst: false })
    .limit(1)
    .maybeSingle();
  return data;
}

async function alreadyWelcomed(userId) {
  const { data } = await supabase
    .from("notification_log")
    .select("id")
    .eq("user_id", userId)
    .eq("event_type", EVENT_TYPE)
    .eq("dedupe_key", COHORT)
    .maybeSingle();
  return Boolean(data);
}

/** Plan en la suscripción y en el perfil (el alta automática puede no haberlo puesto). */
async function applyPlan(userId, fullName, email) {
  const periodEnd = UNTIL ? new Date(`${UNTIL}T23:59:59-05:00`).toISOString() : null;
  const { data: sub } = await supabase
    .from("subscriptions")
    .select("user_id")
    .eq("user_id", userId)
    .limit(1)
    .maybeSingle();
  const subFields = { plan: PLAN, status: "active", ...(periodEnd ? { current_period_end: periodEnd } : {}) };
  const subResult = sub
    ? await supabase.from("subscriptions").update(subFields).eq("user_id", userId)
    : await supabase.from("subscriptions").insert({
        user_id: userId,
        ...subFields,
        current_period_end: periodEnd ?? new Date(Date.now() + 30 * 86_400_000).toISOString(),
      });
  if (subResult.error) throw new Error(`suscripción: ${subResult.error.message}`);

  const { error: profileError } = await supabase
    .from("profiles")
    .upsert({ id: userId, full_name: fullName || null, email, plan: PLAN }, { onConflict: "id" });
  if (profileError) throw new Error(`perfil: ${profileError.message}`);
}

/** Reserva el envío (idempotencia), manda y guarda el id de Resend. */
async function sendWelcome(user, person, password) {
  const { data: reserved, error: logError } = await supabase
    .from("notification_log")
    .upsert(
      { user_id: user.id, event_type: EVENT_TYPE, dedupe_key: COHORT },
      { onConflict: "user_id,event_type,dedupe_key", ignoreDuplicates: true },
    )
    .select("id");
  if (logError) throw new Error(`registro de envío: ${logError.message}`);
  if (!reserved?.length) return "ya enviado";

  const { subject, html, text } = cohortWelcomeEmail({
    firstName: person.name.split(" ")[0],
    email: person.email,
    tempPassword: password,
    loginUrl: `${APP_URL}/login`,
    cohortLabel: LABEL,
  });
  const { data, error } = await resend.emails.send({ from: EMAIL_FROM, to: person.email, subject, html, text });
  if (error) {
    // Sin reserva: la próxima corrida lo reintenta con otra contraseña.
    await supabase.from("notification_log").delete().eq("id", reserved[0].id);
    throw new Error(`correo: ${error.message}`);
  }
  await supabase.from("notification_log").update({ provider_message_id: data?.id ?? null }).eq("id", reserved[0].id);
  return "enviado";
}

// ── Proceso ───────────────────────────────────────────────────────────────
console.log(`\n${SEND ? "▶ ALTA REAL" : "◇ PRUEBA (sin --send no se escribe nada)"} · ${people.length} personas · plan ${PLAN} · ${COHORT}${UNTIL ? ` · hasta ${UNTIL}` : ""}\n`);

const usersByEmail = await loadUsersByEmail();
const report = [];
const seen = new Set();

for (const person of people) {
  const row = { nombre: person.name, correo: person.email, resultado: "", detalle: "" };
  report.push(row);

  if (!EMAIL_RE.test(person.email)) { row.resultado = "SIN CORREO VÁLIDO"; continue; }
  if (seen.has(person.email)) { row.resultado = "REPETIDO EN EL CSV"; continue; }
  seen.add(person.email);

  const existing = usersByEmail.get(person.email);
  try {
    if (existing) {
      const pending = existing.app_metadata?.must_change_password === true && !(await alreadyWelcomed(existing.id));
      if (!pending) {
        const sub = await currentPlan(existing.id);
        row.resultado = "YA EXISTÍA";
        row.detalle = sub ? `plan ${sub.plan} (${sub.status})` : "sin plan";
        continue;
      }
      // Quedó creada sin bienvenida en una corrida anterior: contraseña nueva y reenvío.
      row.resultado = SEND ? "REENVIADO" : "SE REENVIARÍA";
      if (!SEND) continue;
      const password = tempPassword();
      // Dos escrituras a propósito: cambiar la contraseña borra la marca (trigger).
      const r1 = await supabase.auth.admin.updateUserById(existing.id, { password });
      if (r1.error) throw new Error(`contraseña: ${r1.error.message}`);
      const r2 = await supabase.auth.admin.updateUserById(existing.id, {
        app_metadata: { ...existing.app_metadata, must_change_password: true },
      });
      if (r2.error) throw new Error(`marca: ${r2.error.message}`);
      await applyPlan(existing.id, person.name, person.email);
      row.detalle = await sendWelcome(existing, person, password);
      await sleep(600);
      continue;
    }

    row.resultado = SEND ? "CREADO" : "SE CREARÍA";
    if (!SEND) continue;
    const password = tempPassword();
    const { data, error } = await supabase.auth.admin.createUser({
      email: person.email,
      password,
      // Confirmado: la persona no tiene que confirmar nada. Tampoco dispara la
      // bienvenida genérica (esa sale al confirmar un registro propio).
      email_confirm: true,
      user_metadata: { full_name: person.name, plan: PLAN },
      app_metadata: { must_change_password: true, cohort: COHORT },
    });
    if (error) throw new Error(`cuenta: ${error.message}`);
    await applyPlan(data.user.id, person.name, person.email);
    row.detalle = await sendWelcome(data.user, person, password);
    // Resend acepta ~2 envíos por segundo.
    await sleep(600);
  } catch (err) {
    row.resultado = "ERROR";
    row.detalle = err instanceof Error ? err.message : String(err);
  }
}

// ── Informe ───────────────────────────────────────────────────────────────
const counts = report.reduce((acc, r) => ({ ...acc, [r.resultado]: (acc[r.resultado] ?? 0) + 1 }), {});
for (const r of report) {
  console.log(`  ${r.resultado.padEnd(18)} ${r.correo.padEnd(42)} ${r.nombre}${r.detalle ? `  · ${r.detalle}` : ""}`);
}
console.log("\nResumen:", Object.entries(counts).map(([k, v]) => `${k}: ${v}`).join(" · "));

const csvCell = (v) => `"${String(v).replace(/"/g, '""')}"`;
const outFile = join(dirname(FILE), `informe-${COHORT}-${SEND ? "alta" : "prueba"}-${new Date().toISOString().slice(0, 10)}.csv`);
writeFileSync(
  outFile,
  "﻿" + ["nombre,correo,resultado,detalle", ...report.map((r) => [r.nombre, r.correo, r.resultado, r.detalle].map(csvCell).join(","))].join("\n"),
);
console.log(`Informe (sin contraseñas): ${outFile}\n`);
if (report.some((r) => r.resultado === "ERROR")) process.exit(1);
