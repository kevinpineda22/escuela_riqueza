/**
 * Lleva `position` a un punto realmente reproducible de `seekable`. La ventana
 * puede tener huecos (intervalos discontinuos): clampar solo contra el primer
 * inicio y el último final dejaba caer el seek dentro de un hueco. Si la
 * posición cae en un hueco, va al borde más cercano de un intervalo real.
 */
export function clampToSeekable(seekable: TimeRanges, position: number): number | null {
  if (!seekable.length) return null;
  let best: number | null = null;
  let bestDistance = Infinity;
  for (let i = 0; i < seekable.length; i++) {
    const start = seekable.start(i);
    const end = seekable.end(i);
    if (position >= start && position <= end) return position;
    const candidate = position < start ? start : end;
    const distance = Math.abs(candidate - position);
    if (distance < bestDistance) {
      bestDistance = distance;
      best = candidate;
    }
  }
  return best;
}

/** Tiempo exacto: "0:42", "12:08", "1:02:15". El atraso no se redondea a minutos. */
export function formatClock(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const mm = String(m).padStart(2, "0");
  const ss = String(s).padStart(2, "0");
  return h > 0 ? `${h}:${mm}:${ss}` : `${m}:${ss}`;
}

/** Tiempo para lectores de pantalla: "1 minuto 35 segundos". */
export function spokenClock(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const parts: string[] = [];
  if (h) parts.push(`${h} ${h === 1 ? "hora" : "horas"}`);
  if (m) parts.push(`${m} ${m === 1 ? "minuto" : "minutos"}`);
  if (s || !parts.length) parts.push(`${s} ${s === 1 ? "segundo" : "segundos"}`);
  return parts.join(" ");
}
