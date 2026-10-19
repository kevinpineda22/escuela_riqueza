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
 *
 * Revisión de la grabación (docs/RECORTE_RECESO_DESIGN.md): una sala en `pending`
 * espera hasta `review_deadline_at`, y una en `trimming` es de la GitHub Action. Las
 * salas con `recording_review` NULL (anteriores a la migración) se archivan como
 * siempre. Una `pending` vencida viene en la lista, pero hay que reclamarla con
 * `buildClaimExpiredReviewUrl` antes de archivarla.
 */
export function buildPendingLivesUrl(supabaseUrl: string, limit = 3, now = new Date()): string {
  // Entre comillas: el ISO trae `.` y `:`, reservados en los filtros lógicos de PostgREST.
  const reviewFilter =
    `(recording_review.is.null,recording_review.eq.keep,` +
    `and(recording_review.eq.pending,review_deadline_at.lt."${now.toISOString()}"))`;
  return (
    `${supabaseUrl}/rest/v1/lives` +
    `?select=id,recording_stream_uid,recording_review` +
    `&recording_stream_uid=not.is.null` +
    `&archived_at=is.null` +
    `&status=eq.ended` +
    `&or=${encodeURIComponent(reviewFilter)}` +
    // Orden determinista: sin él, filas atascadas podrían ocupar siempre el mismo
    // lote de `limit` y dejar sin procesar al resto.
    `&order=starts_at.asc` +
    `&limit=${limit}`
  );
}

/** URL REST de Supabase para leer el estado de una sala puntual. */
export function buildLiveStatusUrl(supabaseUrl: string, liveId: string): string {
  return `${supabaseUrl}/rest/v1/lives?select=status,recording_review,recording_stream_uid&id=eq.${encodeURIComponent(liveId)}&limit=1`;
}

/**
 * PATCH que reclama una sala `pending` cuyo plazo de revisión venció, pasándola a
 * `keep` (archivar completa). Es condicional a que siga `pending`, sin archivar y
 * vencida: si el admin pidió el recorte en el mismo instante, uno solo de los dos
 * afecta la fila y el otro la saltea. Debe afectar exactamente una fila para
 * seguir con el archivado.
 */
export function buildClaimExpiredReviewUrl(supabaseUrl: string, liveId: string, now = new Date()): string {
  return (
    `${supabaseUrl}/rest/v1/lives?id=eq.${encodeURIComponent(liveId)}` +
    `&recording_review=eq.pending` +
    `&archived_at=is.null` +
    `&review_deadline_at=lt.${encodeURIComponent(now.toISOString())}`
  );
}

/**
 * PATCH que reclama una sala `pending` para archivarla completa desde el botón
 * manual "Archivar en R2". Equivale a "Archivar sin recortar": no mira el plazo,
 * pero sí que la sala siga `pending` y sin archivar.
 */
export function buildClaimManualArchiveUrl(supabaseUrl: string, liveId: string): string {
  return (
    `${supabaseUrl}/rest/v1/lives?id=eq.${encodeURIComponent(liveId)}` +
    `&recording_review=eq.pending` +
    `&archived_at=is.null`
  );
}

export type RecordingReview = 'pending' | 'keep' | 'trimming' | null;

/**
 * Qué hacer con una sala según su revisión antes de archivarla:
 *  - `archive`: NULL o `keep`, se archiva directo.
 *  - `claim`:   `pending`, hay que reclamarla (pending→keep) antes de archivar.
 *  - `skip`:    `trimming` (es de la Action) o un valor desconocido. Ante la duda
 *               no se archiva: archivar borra de Stream.
 */
export function decideReviewAction(review: string | null | undefined): 'archive' | 'claim' | 'skip' {
  if (review === null || review === undefined || review === 'keep') return 'archive';
  if (review === 'pending') return 'claim';
  return 'skip';
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
