// Posición guardada de "Clase completa" para retomar donde quedó el alumno.
// La escribe y la lee LiveHLSPlayer; la sala la consulta al entrar para decidir
// si arranca en Clase completa (hay algo que retomar) o en Fluidez.

/** Una posición más vieja que esto ya no se retoma. */
export const SAVED_POSITION_MAX_AGE_MS = 12 * 60 * 60 * 1000;

export function livePositionStorageKey(resumeKey: string): string {
  return `live-position:${resumeKey}`;
}

/** Clave de retomar de una sala: id + inicio programado (otra emisión = otra clave). */
export function liveResumeKey(live: { id: string; starts_at?: string | null }): string {
  return `${live.id}:${live.starts_at}`;
}

/**
 * Olvida la posición guardada de una sala. Se usa al volver al vivo: el alumno
 * ya no está atrasado, así que al reingresar debe entrar al directo y no al
 * punto viejo (el borrado del player solo corre en Clase completa, y "EN VIVO"
 * cambia a Fluidez antes de que ocurra).
 */
export function clearSavedLivePosition(resumeKey: string): void {
  try {
    localStorage.removeItem(livePositionStorageKey(resumeKey));
  } catch { /* localStorage no disponible (modo privado) */ }
}

/** ¿Hay una posición fresca guardada para esta sala? localStorage puede fallar: entonces no. */
export function hasSavedLivePosition(resumeKey: string, now = Date.now()): boolean {
  try {
    const raw = localStorage.getItem(livePositionStorageKey(resumeKey));
    if (!raw) return false;
    const saved = JSON.parse(raw) as { position?: unknown; savedAt?: unknown };
    return (
      typeof saved.position === "number" &&
      Number.isFinite(saved.position) &&
      typeof saved.savedAt === "number" &&
      now - saved.savedAt < SAVED_POSITION_MAX_AGE_MS
    );
  } catch {
    return false;
  }
}
