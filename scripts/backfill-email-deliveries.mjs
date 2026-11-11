/**
 * Carga en `email_deliveries` los correos que Resend ya tiene, para que el panel
 * no arranque vacío. El webhook solo ve lo que pasa desde que se activa.
 *
 * Uso (desde la raíz del repo, con RESEND_API_KEY_VER_EMAILS en .env: una key
 * Full access, porque la de envío no puede listar):
 *
 *   node --env-file=.env scripts/backfill-email-deliveries.mjs           # prueba
 *   node --env-file=.env scripts/backfill-email-deliveries.mjs --write   # guarda
 *
 * La API de listado da el último estado pero NO el motivo del rebote: esos
 * quedan sin motivo y el panel lo dice. Se puede correr más de una vez.
 */
import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";

const WRITE = process.argv.includes("--write");
const fail = (msg) => {
  console.error(`\n✖ ${msg}\n`);
  process.exit(1);
};

const SUPABASE_URL = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const RESEND_API_KEY = process.env.RESEND_API_KEY_VER_EMAILS;
if (!SUPABASE_URL || !SERVICE_KEY) fail("Faltan VITE_SUPABASE_URL y/o SUPABASE_SERVICE_ROLE_KEY en .env");
if (!RESEND_API_KEY) fail("Falta RESEND_API_KEY_VER_EMAILS (key Full access de Resend) en .env");

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const resend = new Resend(RESEND_API_KEY);

// `last_event` de Resend → estado del panel. Abierto o clicado implica entregado.
const STATUS = {
  sent: "sent",
  delivery_delayed: "delivery_delayed",
  delivered: "delivered",
  opened: "delivered",
  clicked: "delivered",
  failed: "failed",
  suppressed: "suppressed",
  bounced: "bounced",
  complained: "complained",
};

const PAGE_SIZE = 100;
const PAUSE_MS = 600;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const counts = {};
let after;
let total = 0;

for (;;) {
  const { data, error } = await resend.emails.list({ limit: PAGE_SIZE, ...(after ? { after } : {}) });
  if (error) {
    fail(
      `Resend rechazó el listado (${error.statusCode ?? "?"}): ${error.message}\n` +
        "  RESEND_API_KEY_VER_EMAILS tiene que ser una key Full access, no Sending access.",
    );
  }

  for (const email of data.data) {
    const status = STATUS[email.last_event];
    const recipient = email.to?.[0];
    if (!status || !recipient) continue;
    total++;
    counts[status] = (counts[status] ?? 0) + 1;
    if (!WRITE) continue;

    const { error: rpcError } = await supabase.rpc("record_email_event", {
      p_email_id: email.id,
      p_recipient: recipient,
      p_subject: email.subject ?? null,
      p_status: status,
      p_sent_at: email.created_at,
      p_event_at: email.created_at,
    });
    if (rpcError) fail(`No se pudo guardar ${email.id}: ${rpcError.message}`);
  }

  console.log(`  ${total} correos leídos…`);
  if (!data.has_more || data.data.length === 0) break;
  after = data.data[data.data.length - 1].id;
  await sleep(PAUSE_MS);
}

console.log(`\n${WRITE ? "▶ GUARDADO" : "◇ PRUEBA (sin --write no se guarda nada)"} · ${total} correos`);
console.log(Object.entries(counts).map(([s, n]) => `  ${s}: ${n}`).join("\n"));
