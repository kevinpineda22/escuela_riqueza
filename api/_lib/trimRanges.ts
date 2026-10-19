// Tramos a QUITAR de una grabación antes de archivarla (recorte del receso).
// Ver docs/RECORTE_RECESO_DESIGN.md.
//
// Las mismas reglas las re-valida en jq el paso "Validate trim ranges" de
// .github/workflows/archive-long-recording.yml: si se cambia una, cambiar la otra.

export interface TrimRange {
  start: number;
  end: number;
}

// Lo que queda después de cortar. Menos que esto es casi seguro un error al marcar.
export const MIN_KEPT_SECONDS = 60;
// Un tramo más corto que esto no vale el reprocesado (y con keyframes cada 2 s el
// corte real ni se notaría).
export const MIN_RANGE_SECONDS = 5;
// La UI de v1 manda un solo tramo; el backend acepta algunos más.
export const MAX_RANGES = 5;

export type TrimValidation =
  | { ok: true; ranges: TrimRange[] }
  | { ok: false; error: string };

const round = (n: number) => Math.round(n * 1000) / 1000;

/**
 * Valida los tramos contra la duración REAL de la grabación y los devuelve
 * ordenados y redondeados al milisegundo.
 */
export function validateTrimRanges(input: unknown, durationSeconds: number): TrimValidation {
  if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) {
    return { ok: false, error: 'No se conoce la duración de la grabación' };
  }
  if (!Array.isArray(input) || input.length === 0) {
    return { ok: false, error: 'Marca al menos un tramo para recortar' };
  }
  if (input.length > MAX_RANGES) {
    return { ok: false, error: `Se pueden recortar hasta ${MAX_RANGES} tramos` };
  }

  const ranges: TrimRange[] = [];
  for (const item of input) {
    const start = (item as Partial<TrimRange> | null)?.start;
    const end = (item as Partial<TrimRange> | null)?.end;
    if (typeof start !== 'number' || typeof end !== 'number' || !Number.isFinite(start) || !Number.isFinite(end)) {
      return { ok: false, error: 'Cada tramo necesita un inicio y un fin en segundos' };
    }
    const r = { start: round(start), end: round(end) };
    if (r.start < 0 || r.end > durationSeconds) {
      return { ok: false, error: 'El tramo se sale de la grabación' };
    }
    if (r.end - r.start < MIN_RANGE_SECONDS) {
      return { ok: false, error: `Cada tramo tiene que durar al menos ${MIN_RANGE_SECONDS} s` };
    }
    ranges.push(r);
  }

  ranges.sort((a, b) => a.start - b.start);
  for (let i = 1; i < ranges.length; i++) {
    if (ranges[i].start < ranges[i - 1].end) {
      return { ok: false, error: 'Los tramos no pueden superponerse' };
    }
  }

  const removed = ranges.reduce((sum, r) => sum + (r.end - r.start), 0);
  if (durationSeconds - removed < MIN_KEPT_SECONDS) {
    return { ok: false, error: 'El recorte deja la clase prácticamente vacía' };
  }

  return { ok: true, ranges };
}

/**
 * Tramos que se CONSERVAN (el complemento), en orden. Espera tramos ya validados.
 * Un hueco de menos de 1 s en los bordes se descarta: no vale un segmento propio.
 */
export function keptSegments(ranges: TrimRange[], durationSeconds: number): TrimRange[] {
  const kept: TrimRange[] = [];
  let cursor = 0;
  for (const r of ranges) {
    if (r.start - cursor >= 1) kept.push({ start: cursor, end: r.start });
    cursor = r.end;
  }
  if (durationSeconds - cursor >= 1) kept.push({ start: cursor, end: durationSeconds });
  return kept;
}
