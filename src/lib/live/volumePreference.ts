/**
 * Volumen del vivo, recordado entre clases (como YouTube). Solo el NIVEL: el
 * silencio no se recuerda, porque la clase siempre intenta arrancar con sonido.
 * El almacenamiento puede fallar (modo privado, datos bloqueados): sin él, el
 * volumen arranca al máximo, como antes.
 */
const STORAGE_KEY = "live-volume";
const DEFAULT_VOLUME = 1;
/** Por debajo de esto no se guarda: arrancar "casi mudo" se siente como un error. */
const MIN_REMEMBERED = 0.05;

export function readLiveVolume(): number {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const value = raw == null ? NaN : Number(raw);
    return Number.isFinite(value) && value >= MIN_REMEMBERED && value <= 1 ? value : DEFAULT_VOLUME;
  } catch {
    return DEFAULT_VOLUME;
  }
}

export function saveLiveVolume(volume: number): void {
  if (!Number.isFinite(volume) || volume < MIN_REMEMBERED || volume > 1) return;
  try {
    localStorage.setItem(STORAGE_KEY, String(volume));
  } catch { /* sin almacenamiento: no se recuerda, nada más */ }
}
