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
}

interface ArchiveBody {
  live_id: string;
  stream_video_uid: string;
}

type ArchiveResult =
  | { status: 'archived'; key: string; bytes: number | null; durationSeconds: number | null }
  | { status: 'processing'; percent: number }
  | { status: 'failed'; message: string; httpStatus: number }
  | { status: 'error'; message: string; detail?: string; httpStatus: number };

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

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
  const infoRes = await fetch(`${cfBase}/${streamVideoUid}`, { headers: cfHeaders });
  if (infoRes.ok) {
    const info = (await infoRes.json()) as {
      result?: { duration?: number; status?: { state?: string; errorReasonText?: string } };
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
  }

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
    if (enableRes.ok) {
      const enableData = (await enableRes.json()) as {
        result?: { default?: { status?: string; percentComplete?: number; url?: string } };
      };
      def = enableData.result?.default;
    }
    return { status: 'processing', percent: def?.percentComplete ?? 0 };
  }

  if (def.status !== 'ready' || !def.url) {
    return { status: 'processing', percent: def.percentComplete ?? 0 };
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
            }
          } catch (err) {
            console.error(`[cron] ${live.id} falló:`, err);
          }
        }
      })(),
    );
  },
};
