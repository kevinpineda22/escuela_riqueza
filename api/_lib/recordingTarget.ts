/**
 * Selección de la sala a la que se vincula una grabación nueva (webhook `video.ready`).
 * Lógica pura, sin I/O, para poder testearla.
 */

// Las salas suelen arrancar OBS antes de su `starts_at` programado: una grabación creada
// hasta este margen ANTES del horario programado todavía pertenece a esa sala.
export const EARLY_START_TOLERANCE_MS = 60 * 60 * 1000;

export interface RecordingCandidateRoom {
  id: string;
  status: string;
  starts_at: string;
  archived_at: string | null;
  recording_stream_uid: string | null;
}

/** Milisegundos de creación de la grabación, o null si el payload no trae una fecha válida. */
export function parseRecordingCreatedMs(created: unknown): number | null {
  if (typeof created !== 'string') return null;
  const ms = Date.parse(created);
  return Number.isFinite(ms) ? ms : null;
}

/**
 * Elige la sala destino: sin archivar, sin grabación vinculada, en curso o finalizada,
 * con `starts_at - tolerancia <= creación de la grabación`; entre ellas, la más reciente
 * por `starts_at`. Nunca devuelve una sala archivada ni una claramente anterior/futura.
 */
export function pickRecordingTarget(
  rooms: RecordingCandidateRoom[],
  recordingCreatedMs: number,
): RecordingCandidateRoom | null {
  const eligible = rooms
    .filter((room) => {
      if (room.archived_at) return false;
      if (room.recording_stream_uid) return false;
      if (room.status !== 'ended' && room.status !== 'live') return false;
      const startsMs = Date.parse(room.starts_at);
      if (!Number.isFinite(startsMs)) return false;
      return recordingCreatedMs >= startsMs - EARLY_START_TOLERANCE_MS;
    })
    .sort((a, b) => Date.parse(b.starts_at) - Date.parse(a.starts_at));
  return eligible[0] ?? null;
}
