#!/usr/bin/env node
/**
 * Configura el Live Input de Cloudflare Stream para evitar la FRAGMENTACIÓN de
 * grabaciones.
 *
 * Problema: cuando la conexión de OBS se corta unos segundos y reconecta,
 * Cloudflare crea un video NUEVO por cada reconexión (de ahí decenas de videítos
 * de pocos segundos). Subiendo `recording.timeoutSeconds`, los cortes breves
 * CONTINÚAN la misma grabación en vez de fragmentarla.
 *
 * ⚠️ Esto mitiga la fragmentación, NO arregla los cortes en sí. Si la conexión
 * se cae, el espectador igual ve el video congelarse. Eso se arregla en OBS/red
 * (bitrate sostenible + ethernet).
 *
 * Uso (Node 18+, trae fetch global):
 *   CLOUDFLARE_ACCOUNT_ID=xxx CLOUDFLARE_STREAM_API_TOKEN=yyy \
 *     node scripts/configure-live-input.mjs [liveInputId] [timeoutSeconds]
 *
 * Defaults:
 *   liveInputId    = 950f6b77844e5a369bbeea208b2c428e  (el "Principal" del admin)
 *   timeoutSeconds = 60
 *
 * El token necesita permiso Stream:Edit.
 */

const ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID;
const API_TOKEN =
  process.env.CLOUDFLARE_STREAM_API_TOKEN ||
  process.env.CLOUDFLARE_API_TOKEN ||
  process.env.CLOUDFLARE_STREAM_TOKEN;

const LIVE_INPUT_ID = process.argv[2] || '950f6b77844e5a369bbeea208b2c428e';
const TIMEOUT_SECONDS = Number(process.argv[3] ?? 60);

if (!ACCOUNT_ID || !API_TOKEN) {
  console.error(
    '❌ Faltan CLOUDFLARE_ACCOUNT_ID y/o CLOUDFLARE_STREAM_API_TOKEN en el entorno.',
  );
  process.exit(1);
}
if (!Number.isFinite(TIMEOUT_SECONDS) || TIMEOUT_SECONDS < 0) {
  console.error(`❌ timeoutSeconds inválido: ${process.argv[3]}`);
  process.exit(1);
}

const base = `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/stream/live_inputs/${LIVE_INPUT_ID}`;
const headers = {
  Authorization: `Bearer ${API_TOKEN}`,
  'Content-Type': 'application/json',
};

function fail(msg, extra) {
  console.error(`❌ ${msg}`);
  if (extra) console.error(extra);
  process.exit(1);
}

// 1. Leer la config actual para NO pisar otros campos (requireSignedURLs, etc.).
const getRes = await fetch(base, { headers });
const getBody = await getRes.json().catch(() => ({}));
if (!getRes.ok || !getBody.success) {
  fail(
    `No se pudo leer el Live Input ${LIVE_INPUT_ID} (HTTP ${getRes.status})`,
    JSON.stringify(getBody.errors || getBody, null, 2),
  );
}

const current = getBody.result;
const currentRecording = current.recording || {};
console.log('📄 Config de grabación actual:', JSON.stringify(currentRecording));

// 2. Mergear: mantenemos lo existente y solo ajustamos mode + timeoutSeconds.
const body = {
  meta: current.meta,
  recording: {
    ...currentRecording,
    mode: 'automatic',
    timeoutSeconds: TIMEOUT_SECONDS,
  },
};

const putRes = await fetch(base, {
  method: 'PUT',
  headers,
  body: JSON.stringify(body),
});
const putBody = await putRes.json().catch(() => ({}));
if (!putRes.ok || !putBody.success) {
  fail(
    `Falló la actualización (HTTP ${putRes.status})`,
    JSON.stringify(putBody.errors || putBody, null, 2),
  );
}

console.log('\n✅ Live Input actualizado.');
console.log(
  '🎬 Nueva config de grabación:',
  JSON.stringify(putBody.result.recording, null, 2),
);
console.log(
  `\nDesde ahora, las desconexiones de hasta ${TIMEOUT_SECONDS}s NO fragmentan la grabación.`,
);
console.log(
  `Nota: la grabación se finaliza ~${TIMEOUT_SECONDS}s después de que cortás el stream (es el tradeoff del timeout).`,
);
