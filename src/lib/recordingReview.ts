// Revisión de la grabación antes de archivar (recorte del receso).
// Ver docs/RECORTE_RECESO_DESIGN.md.
//
// `validateTrimRanges` y `keptSegments` son copia de api/_lib/trimRanges.ts: las
// Functions de api/ no importan desde src/ (otro tsconfig y otro bundle). Mantener en
// sync con ese archivo y con el paso "Validate trim ranges" de
// .github/workflows/archive-long-recording.yml. El servidor re-valida siempre: esta
// copia solo sirve para avisar en la pantalla antes de mandar.

export type RecordingReview = "pending" | "keep" | "trimming";

export interface TrimRange {
  start: number;
  end: number;
}

/** Cuánto espera el cron a que el admin revise la grabación antes de archivarla completa. */
export const REVIEW_WINDOW_HOURS = 48;

export const MIN_KEPT_SECONDS = 60;
export const MIN_RANGE_SECONDS = 5;
export const MAX_RANGES = 5;

export type TrimValidation =
  | { ok: true; ranges: TrimRange[] }
  | { ok: false; error: string };

const round = (n: number) => Math.round(n * 1000) / 1000;

export function validateTrimRanges(input: unknown, durationSeconds: number): TrimValidation {
  if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) {
    return { ok: false, error: "No se conoce la duración de la grabación" };
  }
  if (!Array.isArray(input) || input.length === 0) {
    return { ok: false, error: "Marca al menos un tramo para recortar" };
  }
  if (input.length > MAX_RANGES) {
    return { ok: false, error: `Se pueden recortar hasta ${MAX_RANGES} tramos` };
  }

  const ranges: TrimRange[] = [];
  for (const item of input) {
    const start = (item as Partial<TrimRange> | null)?.start;
    const end = (item as Partial<TrimRange> | null)?.end;
    if (typeof start !== "number" || typeof end !== "number" || !Number.isFinite(start) || !Number.isFinite(end)) {
      return { ok: false, error: "Cada tramo necesita un inicio y un fin en segundos" };
    }
    const r = { start: round(start), end: round(end) };
    if (r.start < 0 || r.end > durationSeconds) {
      return { ok: false, error: "El tramo se sale de la grabación" };
    }
    if (r.end - r.start < MIN_RANGE_SECONDS) {
      return { ok: false, error: `Cada tramo tiene que durar al menos ${MIN_RANGE_SECONDS} s` };
    }
    ranges.push(r);
  }

  ranges.sort((a, b) => a.start - b.start);
  for (let i = 1; i < ranges.length; i++) {
    if (ranges[i].start < ranges[i - 1].end) {
      return { ok: false, error: "Los tramos no pueden superponerse" };
    }
  }

  const removed = ranges.reduce((sum, r) => sum + (r.end - r.start), 0);
  if (durationSeconds - removed < MIN_KEPT_SECONDS) {
    return { ok: false, error: "El recorte deja la clase prácticamente vacía" };
  }

  return { ok: true, ranges };
}

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

/** Plazo de revisión que se guarda al finalizar la clase. */
export function reviewDeadlineFrom(now: Date): string {
  return new Date(now.getTime() + REVIEW_WINDOW_HOURS * 3600 * 1000).toISOString();
}

/** Horas enteras que faltan para el plazo (0 si ya venció o no hay plazo). */
export function hoursUntil(deadline: string | null | undefined, now: Date): number {
  if (!deadline) return 0;
  const ms = Date.parse(deadline) - now.getTime();
  if (!Number.isFinite(ms) || ms <= 0) return 0;
  return Math.ceil(ms / 3_600_000);
}

/** Segundos → "h:mm:ss" (o "m:ss" si dura menos de una hora). */
export function formatTimestamp(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(sec)}` : `${m}:${pad(sec)}`;
}

/**
 * "h:mm:ss", "m:ss" o segundos sueltos → segundos. `null` si no se puede leer.
 * Los minutos y segundos de un campo intermedio no pueden pasar de 59.
 */
export function parseTimestamp(text: string): number | null {
  const trimmed = text.trim();
  if (!/^\d+(:\d{1,2}){0,2}$/.test(trimmed)) return null;
  const parts = trimmed.split(":").map(Number);
  if (parts.slice(1).some((n) => n > 59)) return null;
  return parts.reduce((acc, n) => acc * 60 + n, 0);
}
