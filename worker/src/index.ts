/**
 * Worker de archivado de grabaciones.
 *
 * Copia el MP4 de una grabación de Cloudflare Stream a R2 y borra el video de
 * Stream (corta el cobro recurrente de storage). Ver docs/RECORDINGS_ARCHITECTURE.md.
 *
 * Dos disparadores, misma lógica (`archiveOne`):
 *   - `fetch`     → POST manual desde api/stream/archive-recording.ts (botón admin),
 *                   autenticado con secreto compartido.
 *   - `scheduled` → Cron Trigger: cada tick busca en `lives` las grabaciones con
 *                   recording_stream_uid cargado y sin archivar, y las procesa.
 *
 * Es idempotente y de fase única: si el MP4 todavía no está listo, responde
 * `processing` y se reintenta (el admin a mano, o el cron en el próximo tick).
 * Si Stream marcó el video como `error` (codificación fallida), responde `failed`
 * y el cron lo descarta para no reintentar infinitamente y no tapar el batch.
 *
 * Body (fetch): { live_id: string, stream_video_uid: string }
 */

export interface Env {
  RECORDINGS: R2Bucket;
  CF_ACCOUNT_ID: string;
  CF_STREAM_API_TOKEN: string;
  SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  ARCHIVE_SHARED_SECRET: string;
  // Token fine-grained con `contents: write` sobre el repo, para disparar el workflow
  // de archivado largo (grabaciones > 4 h). Opcional: sin él, esas quedan en Stream.
  GITHUB_TOKEN?: string;
}

// Repo donde vive .github/workflows/archive-long-recording.yml
const GITHUB_REPO = 'kevinpineda22/escuela_riqueza';
const LONG_ARCHIVE_EVENT = 'archive-long-recording';

interface ArchiveBody {
  live_id: string;
  stream_video_uid: string;
}

type ArchiveResult =
  | { status: 'archived'; key: string; bytes: number | null; durationSeconds: number | null }
  | { status: 'processing'; percent: number }
  // El video está sano y se reproduce, pero Stream no puede generar su MP4 (p. ej.
  // supera la duración máxima). Se queda en Stream: NO se desvincula.
  | { status: 'unarchivable'; message: string }
  | { status: 'failed'; message: string; httpStatus: number }
  | { status: 'error'; message: string; detail?: string; httpStatus: number };

// Código de la API de Stream: "Video Duration Too Long" al pedir el MP4.
const CF_DURATION_TOO_LONG = 10047;

/**
 * Dispara el workflow de GitHub Actions que archiva grabaciones de más de 4 h
 * (ffmpeg remuxa el HLS a MP4 y lo sube a R2). Devuelve true si GitHub aceptó el
 * evento; false si no hay token o GitHub rechazó.
 */
async function dispatchLongArchive(liveId: string, videoUid: string, env: Env): Promise<boolean> {
  if (!env.GITHUB_TOKEN) {
    console.warn('[archive] GITHUB_TOKEN no configurado: la grabación larga queda en Stream');
    return false;
  }
  const res = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/dispatches`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.GITHUB_TOKEN}`,
      Accept: 'application/vnd.github+json',
      'Content-Type': 'application/json',
      'User-Agent': 'escuela-archive-recording',
    },
    body: JSON.stringify({
      event_type: LONG_ARCHIVE_EVENT,
      client_payload: { live_id: liveId, video_uid: videoUid },
    }),
  });
  // GitHub responde 204 sin body cuando acepta el dispatch.
  if (res.status !== 204) {
    console.error(`[archive] GitHub rechazó el dispatch (${res.status}): ${await res.text()}`);
    return false;
  }
  console.log(`[archive] workflow de archivado largo disparado para ${liveId}`);
  return true;
}

/** Primer error de una respuesta de la API de Cloudflare, con su código. */
function extractCfError(body: string): { code: number | null; message: string } | null {
  try {
    const parsed = JSON.parse(body) as { errors?: { code?: number; message?: string }[] };
    const first = parsed.errors?.[0];
    if (!first?.message) return null;
    return { code: first.code ?? null, message: first.message };
  } catch {
    const text = body.slice(0, 200);
    return text ? { code: null, message: text } : null;
  }
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

// Si el MP4 no llegó a generarse pasadas estas horas desde que se creó el video,
// lo damos por muerto aunque Stream no lo marque en 'error' (hay grabaciones que
// quedan pegadas en 0% sin errorear). Margen amplio para no matar un VOD legítimo
// de un vivo largo que todavía se está generando.
const STALE_HOURS = 12;

/**
 * Archiva una grabación: habilita/espera el MP4, lo copia a R2, registra en la
 * base y borra el video de Stream. Idempotente: si ya se archivó (o el MP4 no
 * está listo) no rompe, solo devuelve el estado correspondiente.
 *
 * Si el video está en estado `error` en Stream, devuelve `failed`: la codificación
 * falló y no hay MP4 que generar, así que reintentar es inútil.
 */
async function archiveOne(
  liveId: string,
  streamVideoUid: string,
  env: Env,
): Promise<ArchiveResult> {
  const cfBase = `https://api.cloudflare.com/client/v4/accounts/${env.CF_ACCOUNT_ID}/stream`;
  const cfHeaders = { Authorization: `Bearer ${env.CF_STREAM_API_TOKEN}` };

  // 0. Estado del video en Stream. Si está en 'error', la codificación falló y es
  //    PERMANENTE: no hay MP4 que generar. Cortamos como 'failed' para no reintentar
  //    para siempre (y así no tapar el batch del cron). De paso leemos la duración.
  let durationSeconds: number | null = null;
  // Antigüedad del VIDEO. Por sí sola NO significa que el MP4 esté muerto: una
  // grabación de la semana pasada puede archivarse hoy sin problema. Solo se usa
  // combinada con "el MP4 ya estaba pedido y no avanzó ni un 1%".
  let isOldVideo = false;
  const infoRes = await fetch(`${cfBase}/${streamVideoUid}`, { headers: cfHeaders });
  if (infoRes.ok) {
    const info = (await infoRes.json()) as {
      result?: {
        duration?: number;
        created?: string;
        status?: { state?: string; errorReasonText?: string };
      };
    };
    if (info.result?.status?.state === 'error') {
      return {
        status: 'failed',
        message: info.result.status.errorReasonText || 'La grabación falló al codificar en Stream',
        httpStatus: 422,
      };
    }
    if (typeof info.result?.duration === 'number') {
      durationSeconds = Math.round(info.result.duration);
    }
    if (info.result?.created) {
      const ageMs = Date.now() - Date.parse(info.result.created);
      isOldVideo = Number.isFinite(ageMs) && ageMs > STALE_HOURS * 3600 * 1000;
    }
  }

  // MP4 pedido hace rato que nunca arrancó → muerto silencioso. Lo descartamos para
  // que el cron no lo reintente para siempre y tape el batch.
  const staleResult: ArchiveResult = {
    status: 'failed',
    message: `El MP4 quedó sin generarse tras ${STALE_HOURS}h; se descarta`,
    httpStatus: 422,
  };

  // 1. Estado del MP4. Si nunca se pidió, lo habilitamos y salimos como 'processing'.
  const dlUrl = `${cfBase}/${streamVideoUid}/downloads`;
  const dlRes = await fetch(dlUrl, { headers: cfHeaders });
  if (!dlRes.ok) {
    return { status: 'error', message: 'No se pudo consultar el MP4 en Stream', httpStatus: 502 };
  }
  const dlData = (await dlRes.json()) as {
    result?: { default?: { status?: string; percentComplete?: number; url?: string } };
  };
  let def = dlData.result?.default;

  if (!def) {
    // Habilitar generación del MP4.
    const enableRes = await fetch(dlUrl, { method: 'POST', headers: cfHeaders });
    if (!enableRes.ok) {
      // Antes este error se tragaba en silencio y se respondía "processing 0%" para
      // siempre: cada pasada volvía a pedir el MP4, volvía a fallar, y el guard de
      // staleness nunca se evaluaba (incidente del 2026-09-11, vivo de 4h10m con 0%
      // durante 4 días). Cloudflare explica el motivo en el body: hay que mostrarlo.
      const detail = await enableRes.text();
      const cfError = extractCfError(detail);
      const reason = cfError
        ? `${cfError.message}${cfError.code ? ` (código ${cfError.code})` : ''}`
        : `HTTP ${enableRes.status}`;
      console.error(`[archive] Stream rechazó habilitar el MP4 de ${streamVideoUid}: ${reason}`);

      // Vivo más largo de lo que Stream convierte a MP4 (~4 h). El video está sano y
      // se reproduce por iframe; para moverlo a R2 hace falta el carril largo: un
      // workflow de GitHub Actions con ffmpeg. Acá solo se dispara; el workflow es el
      // que escribe en R2 y en la base. En cualquier caso NO se desvincula.
      if (cfError?.code === CF_DURATION_TOO_LONG) {
        const dispatched = await dispatchLongArchive(liveId, streamVideoUid, env);
        return {
          status: 'unarchivable',
          message: dispatched
            ? 'Este vivo supera las 4 h. Se está archivando en segundo plano por el carril largo; puede tardar un rato.'
            : 'Este vivo supera la duración máxima que Cloudflare convierte a MP4. Se queda en Stream.',
        };
      }
      return {
        status: 'failed',
        message: `Stream no puede generar el MP4: ${reason}`,
        httpStatus: 422,
      };
    }
    const enableData = (await enableRes.json()) as {
      result?: { default?: { status?: string; percentComplete?: number; url?: string } };
    };
    def = enableData.result?.default;
    console.log(`[archive] MP4 habilitado para ${streamVideoUid}: ${def?.status ?? 'sin estado'} ${def?.percentComplete ?? 0}%`);
    // El MP4 se acaba de pedir EN ESTA MISMA PASADA: siempre hay que darle tiempo.
    // Descartarlo acá por la edad del video hacía imposible archivar cualquier
    // grabación de más de STALE_HOURS (incidente del 2026-09-07).
    return { status: 'processing', percent: def?.percentComplete ?? 0 };
  }

  console.log(`[archive] MP4 de ${streamVideoUid}: ${def.status ?? 'sin estado'} ${def.percentComplete ?? 0}%`);

  if (def.status !== 'ready' || !def.url) {
    // El pedido ya existía de una pasada anterior. Solo lo damos por muerto si el
    // video es viejo Y la codificación nunca avanzó: mientras haya progreso, espera.
    const percent = def.percentComplete ?? 0;
    if (isOldVideo && percent <= 0) return staleResult;
    return { status: 'processing', percent };
  }

  // 2. Descargar el MP4 de Stream y subirlo a R2 (streaming, sin bufferear en memoria).
  const mp4Res = await fetch(def.url, { headers: cfHeaders });
  if (!mp4Res.ok || !mp4Res.body) {
    return { status: 'error', message: 'No se pudo descargar el MP4', httpStatus: 502 };
  }

  const key = `recordings/${liveId}.mp4`;
  const putObject = await env.RECORDINGS.put(key, mp4Res.body, {
    httpMetadata: { contentType: 'video/mp4' },
  });
  const bytes = putObject?.size ?? Number(mp4Res.headers.get('content-length')) ?? null;

  // 3. Actualizar Supabase (service role, bypass RLS) vía REST.
  const patchRes = await fetch(
    `${env.SUPABASE_URL}/rest/v1/lives?id=eq.${encodeURIComponent(liveId)}`,
    {
      method: 'PATCH',
      headers: {
        apikey: env.SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal',
      },
      body: JSON.stringify({
        recording_r2_key: key,
        recording_storage: 'r2',
        recording_bytes: bytes,
        recording_duration_seconds: durationSeconds,
        recording_stream_uid: null,
        archived_at: new Date().toISOString(),
      }),
    },
  );
  if (!patchRes.ok) {
    // La copia a R2 ya está hecha; NO borramos de Stream si no pudimos
    // registrar el cambio, para no perder la referencia.
    const detail = await patchRes.text();
    return {
      status: 'error',
      message: 'Copiado a R2 pero falló actualizar la base',
      detail,
      httpStatus: 500,
    };
  }

  // 4. Recién ahora borramos de Stream (la copia + el registro ya están OK).
  await fetch(`${cfBase}/${streamVideoUid}`, { method: 'DELETE', headers: cfHeaders });

  return { status: 'archived', key, bytes, durationSeconds };
}

/**
 * Marca una grabación como no-archivable: limpia recording_stream_uid para que
 * deje de aparecer en el barrido del cron. Se usa cuando Stream reporta el video
 * en 'error' (codificación fallida): no hay MP4 posible, reintentar es inútil.
 */
/**
 * Marca una grabación como "se queda en Stream": el video es válido y reproducible
 * pero no se puede convertir a MP4 (supera la duración máxima de Stream). Se pone
 * `archived_at` para que el cron deje de reintentarla, con `recording_storage` en
 * 'stream' y `recording_stream_uid` intacto para que el replay siga funcionando.
 * Esa combinación (`archived_at` cargado + storage 'stream') es la que la UI lee
 * como "procesada, se queda en Stream".
 */
async function markKeptInStream(liveId: string, env: Env): Promise<void> {
  await fetch(`${env.SUPABASE_URL}/rest/v1/lives?id=eq.${encodeURIComponent(liveId)}`, {
    method: 'PATCH',
    headers: {
      apikey: env.SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    },
    body: JSON.stringify({ recording_storage: 'stream', archived_at: new Date().toISOString() }),
  });
}

async function markFailed(liveId: string, env: Env): Promise<void> {
  await fetch(`${env.SUPABASE_URL}/rest/v1/lives?id=eq.${encodeURIComponent(liveId)}`, {
    method: 'PATCH',
    headers: {
      apikey: env.SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    },
    body: JSON.stringify({ recording_stream_uid: null }),
  });
}

/**
 * Grabaciones listas para archivar: tienen recording_stream_uid (la grabación
 * quedó en Stream) y todavía no se archivaron (archived_at null). El archivado
 * exitoso pone recording_stream_uid en null, así que dejan de aparecer solas.
 */
async function fetchPendingLives(
  env: Env,
): Promise<{ id: string; recording_stream_uid: string }[]> {
  const url =
    `${env.SUPABASE_URL}/rest/v1/lives` +
    `?select=id,recording_stream_uid` +
    `&recording_stream_uid=not.is.null` +
    `&archived_at=is.null` +
    // Límite bajo a propósito: cada grabación de ~3 h pesa varios GB. Procesar de a
    // pocas por tick evita reventar los límites de duración del Worker; el backlog
    // se limpia en ticks sucesivos.
    `&limit=3`;

  const res = await fetch(url, {
    headers: {
      apikey: env.SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
    },
  });
  if (!res.ok) {
    console.error('[cron] no se pudo consultar grabaciones pendientes:', res.status);
    return [];
  }
  return (await res.json()) as { id: string; recording_stream_uid: string }[];
}

export default {
  // Disparador manual (botón "Archivar en R2" del admin).
  async fetch(req: Request, env: Env): Promise<Response> {
    if (req.method !== 'POST') {
      return json({ error: 'Method Not Allowed' }, 405);
    }

    // Auth: secreto compartido con la Vercel Function.
    if (req.headers.get('X-Archive-Secret') !== env.ARCHIVE_SHARED_SECRET) {
      return json({ error: 'No autorizado' }, 401);
    }

    let body: ArchiveBody;
    try {
      body = (await req.json()) as ArchiveBody;
    } catch {
      return json({ error: 'Body inválido' }, 400);
    }
    const { live_id, stream_video_uid } = body;
    if (!live_id || !stream_video_uid) {
      return json({ error: 'Falta live_id o stream_video_uid' }, 400);
    }

    const result = await archiveOne(live_id, stream_video_uid, env);

    if (result.status === 'error') {
      return json({ error: result.message, detail: result.detail }, result.httpStatus);
    }
    if (result.status === 'failed') {
      return json({ error: result.message }, result.httpStatus);
    }
    if (result.status === 'unarchivable') {
      // También desde el botón manual: dejar constancia para que el cron no insista.
      await markKeptInStream(live_id, env);
    }
    return json(result);
  },

  // Disparador automático (Cron Trigger). Archiva todo lo pendiente; el MP4 que
  // aún no esté listo queda en 'processing' y se reintenta en el próximo tick.
  // Los videos con codificación fallida ('failed') se descartan para que no
  // reintenten para siempre ni tapen el batch.
  async scheduled(_event: ScheduledController, env: Env, ctx: ExecutionContext): Promise<void> {
    ctx.waitUntil(
      (async () => {
        const pending = await fetchPendingLives(env);
        if (pending.length === 0) return;

        console.log(`[cron] ${pending.length} grabación(es) pendiente(s) de archivar`);
        for (const live of pending) {
          try {
            const result = await archiveOne(live.id, live.recording_stream_uid, env);
            const label =
              result.status === 'processing' ? `processing ${result.percent}%` : result.status;
            console.log(`[cron] ${live.id}: ${label}`);

            if (result.status === 'failed') {
              console.warn(`[cron] ${live.id}: descartada (${result.message})`);
              await markFailed(live.id, env);
            } else if (result.status === 'unarchivable') {
              console.warn(`[cron] ${live.id}: se queda en Stream (${result.message})`);
              await markKeptInStream(live.id, env);
            }
          } catch (err) {
            console.error(`[cron] ${live.id} falló:`, err);
          }
        }
      })(),
    );
  },
};
