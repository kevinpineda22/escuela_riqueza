import { describe, expect, it, vi } from "vitest";
import {
  coarseStep,
  detectBreak,
  findBreakRun,
  frameStats,
  mapWithConcurrency,
  type FrameSample,
} from "./breakDetection";

const LOGO = Array.from({ length: 32 }, (_, i) => (i === 13 || i === 14 ? 120 : 6));

/** Clase: luminosidad media y una firma que cambia con el tiempo (Iván se mueve). */
function classFrame(time: number, luma = 80): FrameSample {
  const sig = Array.from({ length: 32 }, (_, i) => luma + ((time / 10 + i * 7) % 23) - 11);
  return { time, luma, sig };
}

function logoFrame(time: number): FrameSample {
  return { time, luma: LOGO.reduce((a, b) => a + b, 0) / 32, sig: LOGO };
}

/** Grabación sintética: receso entre `from` y `to` (inclusive). */
function recording(from: number, to: number) {
  return vi.fn(async (t: number) => (t >= from && t <= to ? logoFrame(t) : classFrame(t)));
}

describe("frameStats", () => {
  it("promedia la luminosidad de los píxeles RGBA", () => {
    const { luma, sig } = frameStats([255, 255, 255, 255, 0, 0, 0, 255]);
    expect(sig).toHaveLength(2);
    expect(Math.round(luma)).toBe(128);
  });
});

describe("coarseStep", () => {
  it("toma ~120 muestras con un paso entre 30 s y 2 min", () => {
    expect(coarseStep(4 * 3600)).toBe(120);
    expect(coarseStep(600)).toBe(30);
    expect(coarseStep(2 * 3600)).toBe(60);
  });
});

describe("findBreakRun", () => {
  it("encuentra el tramo oscuro y quieto", () => {
    const samples = [0, 120, 240, 360, 480, 600, 720].map((t) => (t >= 240 && t <= 600 ? logoFrame(t) : classFrame(t)));
    expect(findBreakRun(samples)).toEqual({ first: 2, last: 5 });
  });

  it("ignora una clase oscura que se mueve", () => {
    const samples = [0, 120, 240, 360, 480, 600].map((t) => classFrame(t, 20));
    expect(findBreakRun(samples)).toBeNull();
  });

  it("ignora un fundido a negro corto", () => {
    const samples = [0, 120, 240, 360].map((t) => (t === 120 || t === 240 ? logoFrame(t) : classFrame(t)));
    expect(findBreakRun(samples)).toBeNull();
  });
});

describe("detectBreak", () => {
  it("ubica el receso al segundo de 10 s, sin cortar clase", async () => {
    const range = await detectBreak(4 * 3600, recording(6300, 8280));
    expect(range).toEqual({ start: 6300, end: 8280 });
  });

  it("con un receso que no cae en la grilla, los bordes quedan DENTRO del receso", async () => {
    const range = await detectBreak(4 * 3600, recording(6305, 8283));
    expect(range).toEqual({ start: 6310, end: 8280 });
  });

  it("si el logo sigue hasta el final (OBS no se detuvo), corta hasta el final", async () => {
    const range = await detectBreak(2274.182999, recording(1500, 99999));
    // Un segundo antes del final: la validación redondea y el servidor mide distinto.
    expect(range).toEqual({ start: 1500, end: 2273 });
  });

  it("sin receso devuelve null", async () => {
    expect(await detectBreak(4 * 3600, recording(-1, -1))).toBeNull();
  });

  it("tolera miniaturas que no cargan", async () => {
    const base = recording(6300, 8280);
    const flaky = vi.fn(async (t: number) => (t % 600 === 0 ? null : base(t)));
    const range = await detectBreak(4 * 3600, flaky);
    expect(range?.start).toBe(6300);
    expect(range?.end).toBe(8280);
  });

  it("reporta el progreso hasta 1", async () => {
    const onProgress = vi.fn();
    await detectBreak(3600, recording(1200, 2400), { onProgress });
    expect(onProgress).toHaveBeenLastCalledWith(1);
  });
});

describe("mapWithConcurrency", () => {
  it("respeta el límite y el orden", async () => {
    let inFlight = 0;
    let peak = 0;
    const out = await mapWithConcurrency([1, 2, 3, 4, 5, 6], 2, async (n) => {
      inFlight++;
      peak = Math.max(peak, inFlight);
      await new Promise((r) => setTimeout(r, 1));
      inFlight--;
      return n * 10;
    });
    expect(out).toEqual([10, 20, 30, 40, 50, 60]);
    expect(peak).toBe(2);
  });
});
