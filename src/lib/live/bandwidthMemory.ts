/**
 * Velocidad de internet medida en el vivo anterior. Sin ella, hls.js no sabe
 * nada al arrancar y hace una "prueba": baja el primer pedazo en la calidad más
 * baja (los primeros segundos se ven en ~360p, borroso). Con ella, arranca
 * directo en la calidad que esa conexión ya demostró aguantar.
 *
 * Se guarda POR TIPO de conexión cuando el navegador lo dice (Chrome en
 * Android: wifi o datos), para no arrancar en 1080p con el 4G por haber medido
 * el wifi de la casa. Donde no lo dice (iPhone), una sola medición, de hace
 * menos de 3 días. Si la medición se pasa, el reproductor baja de calidad en
 * los primeros segundos, como haría igual con cualquier traba.
 */
const STORAGE_KEY = "live-bandwidth";
const MAX_AGE_MS = 3 * 24 * 60 * 60 * 1000;
/** Fuera de este rango, la medición es ruido (un pedazo cacheado, un corte). */
const MIN_BPS = 300_000;
const MAX_BPS = 50_000_000;

type Entry = { bps: number; at: number };

function connectionType(): string {
  try {
    const connection = (navigator as Navigator & { connection?: { type?: string } }).connection;
    return connection?.type || "default";
  } catch {
    return "default";
  }
}

function readAll(): Record<string, Entry> {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
    return parsed && typeof parsed === "object" ? (parsed as Record<string, Entry>) : {};
  } catch {
    return {};
  }
}

/** Bits por segundo medidos con esta conexión, o null si no hay una medición confiable. */
export function readBandwidthEstimate(now = Date.now()): number | null {
  const entry = readAll()[connectionType()];
  if (!entry || typeof entry.bps !== "number" || typeof entry.at !== "number") return null;
  if (now - entry.at > MAX_AGE_MS || entry.at > now) return null;
  if (!(entry.bps >= MIN_BPS && entry.bps <= MAX_BPS)) return null;
  return entry.bps;
}

export function saveBandwidthEstimate(bps: number, now = Date.now()): void {
  if (!Number.isFinite(bps) || bps < MIN_BPS || bps > MAX_BPS) return;
  try {
    const all = readAll();
    all[connectionType()] = { bps: Math.round(bps), at: now };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
  } catch { /* sin almacenamiento: el próximo vivo hace la prueba, como antes */ }
}
