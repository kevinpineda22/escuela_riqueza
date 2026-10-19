import { describe, it, expect } from "vitest";
import {
  formatTimestamp,
  hoursUntil,
  keptSegments,
  parseTimestamp,
  reviewDeadlineFrom,
  validateTrimRanges,
} from "./recordingReview";

const DURATION = 4 * 3600;

describe("validateTrimRanges (copia de api/_lib/trimRanges.ts)", () => {
  it("acepta un receso dentro de la grabación", () => {
    expect(validateTrimRanges([{ start: 3600, end: 5700 }], DURATION).ok).toBe(true);
  });

  it("rechaza tramos superpuestos, fuera de rango o demasiado cortos", () => {
    expect(validateTrimRanges([{ start: 100, end: 300 }, { start: 200, end: 400 }], DURATION).ok).toBe(false);
    expect(validateTrimRanges([{ start: 100, end: DURATION + 1 }], DURATION).ok).toBe(false);
    expect(validateTrimRanges([{ start: 100, end: 102 }], DURATION).ok).toBe(false);
  });

  it("deja dos tramos para unir cuando el receso está en el medio", () => {
    expect(keptSegments([{ start: 3600, end: 5700 }], DURATION)).toEqual([
      { start: 0, end: 3600 },
      { start: 5700, end: DURATION },
    ]);
  });
});

describe("reviewDeadlineFrom / hoursUntil", () => {
  const now = new Date("2026-10-17T20:00:00.000Z");

  it("da 48 h de plazo desde que se finaliza", () => {
    expect(reviewDeadlineFrom(now)).toBe("2026-10-19T20:00:00.000Z");
  });

  it("cuenta las horas que faltan, redondeando para arriba", () => {
    expect(hoursUntil("2026-10-19T20:00:00.000Z", now)).toBe(48);
    expect(hoursUntil("2026-10-17T20:30:00.000Z", now)).toBe(1);
  });

  it("da 0 si el plazo venció o no hay plazo", () => {
    expect(hoursUntil("2026-10-17T19:00:00.000Z", now)).toBe(0);
    expect(hoursUntil(null, now)).toBe(0);
    expect(hoursUntil("no-es-fecha", now)).toBe(0);
  });
});

describe("formatTimestamp / parseTimestamp", () => {
  it("formatea con horas solo si hacen falta", () => {
    expect(formatTimestamp(3725)).toBe("1:02:05");
    expect(formatTimestamp(65)).toBe("1:05");
    expect(formatTimestamp(-3)).toBe("0:00");
  });

  it("lee h:mm:ss, m:ss y segundos sueltos", () => {
    expect(parseTimestamp("1:02:05")).toBe(3725);
    expect(parseTimestamp(" 1:05 ")).toBe(65);
    expect(parseTimestamp("90")).toBe(90);
  });

  it("rechaza lo que no es un tiempo", () => {
    expect(parseTimestamp("")).toBeNull();
    expect(parseTimestamp("1:75")).toBeNull();
    expect(parseTimestamp("1:2:3:4")).toBeNull();
    expect(parseTimestamp("abc")).toBeNull();
    expect(parseTimestamp("-5")).toBeNull();
  });

  it("ida y vuelta da el mismo segundo", () => {
    expect(parseTimestamp(formatTimestamp(9876))).toBe(9876);
  });
});
