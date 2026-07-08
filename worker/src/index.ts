/**
 * Worker de archivado de grabaciones.
 *
 * Copia el MP4 de una grabación de Cloudflare Stream a R2 y borra el video de
 * Stream (corta el cobro recurrente de storage). Ver docs/RECORDINGS_ARCHITECTURE.md.
 *
 * Se dispara vía POST desde api/stream/archive-recording.ts (Vercel), autenticado
 * con un secreto compartido. Es idempotente y de fase única: si el MP4 todavía no
 * está listo, responde `processing` y el admin reintenta.
 *
 * Body: { live_id: string, stream_video_uid: string }
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

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export default {
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

    const cfBase = `https://api.cloudflare.com/client/v4/accounts/${env.CF_ACCOUNT_ID}/stream`;
    const cfHeaders = { Authorization: `Bearer ${env.CF_STREAM_API_TOKEN}` };

    // 1. Estado del MP4. Si nunca se pidió, lo habilitamos y salimos como 'processing'.
    const dlUrl = `${cfBase}/${stream_video_uid}/downloads`;
    let dlRes = await fetch(dlUrl, { headers: cfHeaders });
    if (!dlRes.ok) {
      return json({ error: 'No se pudo consultar el MP4 en Stream' }, 502);
    }
    let dlData = (await dlRes.json()) as { result?: { default?: { status?: string; percentComplete?: number; url?: string } } };
    let def = dlData.result?.default;

    if (!def) {
      // Habilitar generación del MP4.
      const enableRes = await fetch(dlUrl, { method: 'POST', headers: cfHeaders });
      if (enableRes.ok) {
        const enableData = (await enableRes.json()) as { result?: { default?: { status?: string; percentComplete?: number; url?: string } } };
        def = enableData.result?.default;
      }
      return json({ status: 'processing', percent: def?.percentComplete ?? 0 });
    }

    if (def.status !== 'ready' || !def.url) {
      return json({ status: 'processing', percent: def.percentComplete ?? 0 });
    }

    // 2. Descargar el MP4 de Stream y subirlo a R2 (streaming, sin bufferear en memoria).
    const mp4Res = await fetch(def.url, { headers: cfHeaders });
    if (!mp4Res.ok || !mp4Res.body) {
      return json({ error: 'No se pudo descargar el MP4' }, 502);
    }

    const key = `recordings/${live_id}.mp4`;
    const putObject = await env.RECORDINGS.put(key, mp4Res.body, {
      httpMetadata: { contentType: 'video/mp4' },
    });
    const bytes = putObject?.size ?? Number(mp4Res.headers.get('content-length')) ?? null;

    // 3. Duración desde el objeto de Stream.
    let durationSeconds: number | null = null;
    const infoRes = await fetch(`${cfBase}/${stream_video_uid}`, { headers: cfHeaders });
    if (infoRes.ok) {
      const info = (await infoRes.json()) as { result?: { duration?: number } };
      if (typeof info.result?.duration === 'number') {
        durationSeconds = Math.round(info.result.duration);
      }
    }

    // 4. Actualizar Supabase (service role, bypass RLS) vía REST.
    const patchRes = await fetch(
      `${env.SUPABASE_URL}/rest/v1/lives?id=eq.${encodeURIComponent(live_id)}`,
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
      return json({ error: 'Copiado a R2 pero falló actualizar la base', detail }, 500);
    }

    // 5. Recién ahora borramos de Stream (la copia + el registro ya están OK).
    await fetch(`${cfBase}/${stream_video_uid}`, { method: 'DELETE', headers: cfHeaders });

    return json({
      status: 'archived',
      key,
      bytes,
      durationSeconds,
    });
  },
};
