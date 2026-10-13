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
    `&limit=${limit}`
  );
}

/** URL REST de Supabase para leer el estado de una sala puntual. */
export function buildLiveStatusUrl(supabaseUrl: string, liveId: string): string {
  return `${supabaseUrl}/rest/v1/lives?select=status&id=eq.${encodeURIComponent(liveId)}&limit=1`;
}
