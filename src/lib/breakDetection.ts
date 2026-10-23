// Detección automática del receso en una grabación, a partir de miniaturas de
// Cloudflare Stream. El receso es una pantalla con el logo: oscura y QUIETA.
//
// Calibrado con el vivo del 17-10 (fcc4d6fb…), un cuadro cada 30 s a 8×4 px:
//   clase (Iván hablando):  luminosidad 41–110, cambio entre cuadros 4–18
//   pantalla con el logo:   luminosidad 9–10,   cambio entre cuadros 0–1
// Ningún tramo de clase cumple las dos condiciones a la vez, ni el más oscuro.
//
// Criterio conservador: los bordes se ubican sobre cuadros que SÍ son receso.
// Puede quedar algún segundo de logo, pero nunca se corta clase.

import type { TrimRange } from "@/lib/recordingReview";

export interface FrameSample {
  time: number;
  /** Luminosidad media 0–255. */
  luma: number;
  /** Firma en grises (8×4) para comparar cuadros entre sí. */
  sig: number[];
}

/** Lado de la firma: 8×4 = 32 valores. */
export const SIGNATURE_WIDTH = 8;
export const SIGNATURE_HEIGHT = 4;

export const BREAK_MAX_LUMA = 25;
export const BREAK_MAX_DIFF = 3;
/** Distancia mínima entre el primer y el último cuadro de receso para tomarlo en serio. */
export const MIN_BREAK_SPAN_SECONDS = 240;
/** Paso fino para afinar cada borde. */
export const REFINE_STEP_SECONDS = 10;

/** Luminosidad y firma a partir de los píxeles RGBA de un canvas de 8×4. */
export function frameStats(rgba: ArrayLike<number>): { luma: number; sig: number[] } {
  const sig: number[] = [];
  for (let i = 0; i + 3 < rgba.length; i += 4) {
    sig.push(0.299 * rgba[i] + 0.587 * rgba[i + 1] + 0.114 * rgba[i + 2]);
  }
  const luma = sig.length ? sig.reduce((a, b) => a + b, 0) / sig.length : 0;
  return { luma, sig };
}

export function signatureDiff(a: number[], b: number[]): number {
  const n = Math.min(a.length, b.length);
  if (n === 0) return Infinity;
  let sum = 0;
  for (let i = 0; i < n; i++) sum += Math.abs(a[i] - b[i]);
  return sum / n;
}

/** Paso entre muestras gruesas: ~120 muestras por grabación, entre 30 s y 2 min. */
export function coarseStep(durationSeconds: number): number {
  return Math.min(120, Math.max(30, Math.round(durationSeconds / 120)));
}

export function sampleTimes(from: number, to: number, step: number): number[] {
  const times: number[] = [];
  for (let t = Math.max(0, from); t <= to; t += step) times.push(Math.round(t));
  return times;
}

/**
 * Tramo de receso más largo entre muestras ordenadas: cuadros oscuros que no
 * cambian respecto de un vecino. `null` si no hay ninguno suficientemente largo.
 */
export function findBreakRun(samples: FrameSample[]): { first: number; last: number } | null {
  const isBreak = samples.map((s, i) => {
    if (s.luma > BREAK_MAX_LUMA) return false;
    const prev = samples[i - 1];
    const next = samples[i + 1];
    const stillPrev = prev ? signatureDiff(s.sig, prev.sig) <= BREAK_MAX_DIFF : false;
    const stillNext = next ? signatureDiff(s.sig, next.sig) <= BREAK_MAX_DIFF : false;
    return stillPrev || stillNext;
  });

  let best: { first: number; last: number } | null = null;
  let i = 0;
  while (i < samples.length) {
    if (!isBreak[i]) {
      i++;
      continue;
    }
    let j = i;
    while (j + 1 < samples.length && isBreak[j + 1]) j++;
    const span = samples[j].time - samples[i].time;
    if (span >= MIN_BREAK_SPAN_SECONDS && (!best || span > samples[best.last].time - samples[best.first].time)) {
      best = { first: i, last: j };
    }
    i = j + 1;
  }
  return best;
}

/** ¿Este cuadro es la misma pantalla de receso que `ref`? */
export function matchesBreak(sample: FrameSample, ref: FrameSample): boolean {
  return sample.luma <= BREAK_MAX_LUMA && signatureDiff(sample.sig, ref.sig) <= BREAK_MAX_DIFF * 2;
}

/**
 * Último segundo que se puede marcar. La duración del reproductor y la del
 * servidor (API de Cloudflare) difieren en fracciones de segundo, y la validación
 * redondea a milésimas: cortar justo en `duration` (2274.182999 → 2274.183) daba
 * "El tramo se sale de la grabación". Un segundo de margen nunca se rechaza; a lo
 * sumo queda un segundo de logo al final.
 */
export function lastMarkableSecond(durationSeconds: number): number {
  return Math.max(0, Math.floor(durationSeconds) - 1);
}

export type FrameLoader = (time: number) => Promise<FrameSample | null>;

/** Ejecuta `fn` sobre `items` con a lo sumo `limit` en vuelo. Conserva el orden. */
export async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const out = new Array<R>(items.length);
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const index = next++;
      out[index] = await fn(items[index]);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return out;
}

const loaded = (samples: (FrameSample | null)[]) => samples.filter((s): s is FrameSample => s !== null);

/**
 * Busca el receso: muestras gruesas en toda la grabación y, si aparece un tramo,
 * afina cada borde cada 10 s. `onProgress` va de 0 a 1.
 */
export async function detectBreak(
  durationSeconds: number,
  loadFrame: FrameLoader,
  { concurrency = 10, onProgress }: { concurrency?: number; onProgress?: (p: number) => void } = {},
): Promise<TrimRange | null> {
  const step = coarseStep(durationSeconds);
  const coarseTimes = sampleTimes(0, durationSeconds - 1, step);
  let done = 0;
  const total = coarseTimes.length + 2 * Math.ceil(step / REFINE_STEP_SECONDS);
  const tracked = async (t: number) => {
    const s = await loadFrame(t).catch(() => null);
    done++;
    onProgress?.(Math.min(1, done / total));
    return s;
  };

  const coarse = loaded(await mapWithConcurrency(coarseTimes, concurrency, tracked));
  const run = findBreakRun(coarse);
  if (!run) {
    onProgress?.(1);
    return null;
  }

  const first = coarse[run.first];
  const last = coarse[run.last];
  const ref = coarse[Math.floor((run.first + run.last) / 2)];

  // Entre la última muestra de clase y la primera de receso (y al revés al final).
  const beforeTime = run.first > 0 ? coarse[run.first - 1].time : null;
  const afterTime = run.last < coarse.length - 1 ? coarse[run.last + 1].time : null;
  const [fineStart, fineEnd] = await Promise.all([
    beforeTime === null
      ? Promise.resolve([] as FrameSample[])
      : mapWithConcurrency(sampleTimes(beforeTime + REFINE_STEP_SECONDS, first.time, REFINE_STEP_SECONDS), concurrency, tracked).then(loaded),
    afterTime === null
      ? Promise.resolve([] as FrameSample[])
      : mapWithConcurrency(sampleTimes(last.time, afterTime - REFINE_STEP_SECONDS, REFINE_STEP_SECONDS), concurrency, tracked).then(loaded),
  ]);
  onProgress?.(1);

  // Inicio: primer cuadro desde el cual todo lo que sigue es receso.
  let start = beforeTime === null ? 0 : first.time;
  for (let i = fineStart.length - 1; i >= 0 && matchesBreak(fineStart[i], ref); i--) start = fineStart[i].time;

  // Fin: último cuadro de receso antes de que vuelva la clase. Si el receso llega
  // hasta el final de la grabación, se corta hasta el final.
  let end = afterTime === null ? lastMarkableSecond(durationSeconds) : last.time;
  if (afterTime !== null) {
    for (let i = 0; i < fineEnd.length && matchesBreak(fineEnd[i], ref); i++) end = fineEnd[i].time;
  }

  return { start, end };
}
