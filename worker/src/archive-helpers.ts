/**
 * Helpers puros del archivado (sin dependencias de Workers) para poder testearlos
 * con vitest desde la raíz del repo.
 */

/**
 * Clave del objeto en R2: única POR VIDEO de Stream, no por sala. Una sala puede
 * terminar con varias grabaciones (OBS se detiene y arranca) y una clave por sala
 * hacía que la segunda pisara a la primera, cuya única copia estaba en R2.
 *
 * IMPORTANTE: debe ser idéntica a la que usa .github/workflows/archive-long-recording.yml
 * (paso "Upload to R2"). Si se cambia acá, cambiarla allá.
 * Las filas viejas conservan su `recording_r2_key` (`recordings/<liveId>.mp4`) porque
 * api/stream/recording-url.ts lee la clave desde la base y no la reconstruye.
 */
export function buildRecordingKey(liveId: string, streamVideoUid: string): string {
  return `recordings/${liveId}/${streamVideoUid}.mp4`;
}

/**
 * URL REST de Supabase con las salas pendientes de archivar. Solo salas FINALIZADAS
 * (`status=ended`): archivar un video de Stream durante el vivo lo borra de Stream
 * mientras la clase sigue transmitiendo (incidente 2026-10-10).
 *
 * No hay una columna `ended_at` en `lives`, así que no se aplica un período de gracia
 * posterior al fin: el admin decide cuándo finalizar y el webhook vincula las partes
 * tardías solo mientras la sala siga sin `archived_at`.
 */
export function buildPendingLivesUrl(supabaseUrl: string, limit = 3): string {
  return (
    `${supabaseUrl}/rest/v1/lives` +
    `?select=id,recording_stream_uid` +
    `&recording_stream_uid=not.is.null` +
    `&archived_at=is.null` +
    `&status=eq.ended` +
    // Orden determinista: sin él, filas atascadas podrían ocupar siempre el mismo
    // lote de `limit` y dejar sin procesar al resto.
    `&order=starts_at.asc` +
    `&limit=${limit}`
  );
}

/** URL REST de Supabase para leer el estado de una sala puntual. */
export function buildLiveStatusUrl(supabaseUrl: string, liveId: string): string {
  return `${supabaseUrl}/rest/v1/lives?select=status&id=eq.${encodeURIComponent(liveId)}&limit=1`;
}

/**
 * URL REST de Supabase para registrar el archivado. Es condicional a que la sala
 * siga apuntando a ESTE video de Stream: si el uid cambió (otra parte vinculada, o
 * ya archivada por otro camino) el PATCH no afecta filas y no se debe borrar nada.
 */
export function buildRegisterUrl(supabaseUrl: string, liveId: string, streamVideoUid: string): string {
  return (
    `${supabaseUrl}/rest/v1/lives?id=eq.${encodeURIComponent(liveId)}` +
    `&recording_stream_uid=eq.${encodeURIComponent(streamVideoUid)}`
  );
}

/**
 * Qué hacer cuando la clave destino ya existe en R2 para ESTE video.
 *  - `resume`: el tamaño coincide con el MP4 esperado, la copia anterior terminó y
 *    solo faltó registrar/borrar de Stream: se continúa sin volver a subir.
 *  - `refuse`: tamaño distinto o desconocido; puede ser otra cosa o una copia
 *    truncada. No se sobrescribe ni se borra nada.
 */
export function decideExistingObject(
  existingSize: number,
  expectedSize: number | null,
): 'resume' | 'refuse' {
  if (expectedSize === null || !Number.isFinite(expectedSize) || expectedSize <= 0) return 'refuse';
  return existingSize === expectedSize ? 'resume' : 'refuse';
}

/** Interpreta un header content-length; null si falta o no es un entero positivo. */
export function parseContentLength(value: string | null): number | null {
  if (!value) return null;
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : null;
}
