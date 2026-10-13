import { describe, it, expect } from "vitest";
import { clampToSeekable, formatClock, spokenClock } from "./playerTime";

const ranges = (...r: Array<[number, number]>) =>
  ({ length: r.length, start: (i: number) => r[i][0], end: (i: number) => r[i][1] }) as unknown as TimeRanges;

describe("clampToSeekable", () => {
  it("sin ventana no hay a dónde ir", () => {
    expect(clampToSeekable(ranges(), 10)).toBeNull();
  });

  it("dentro de un intervalo queda igual", () => {
    expect(clampToSeekable(ranges([0, 40], [60, 100]), 70)).toBe(70);
  });

  it("en un hueco va al borde real más cercano", () => {
    expect(clampToSeekable(ranges([0, 40], [60, 100]), 45)).toBe(40);
    expect(clampToSeekable(ranges([0, 40], [60, 100]), 58)).toBe(60);
  });

  it("fuera de la ventana va al extremo", () => {
    expect(clampToSeekable(ranges([10, 100]), 2)).toBe(10);
    expect(clampToSeekable(ranges([10, 100]), 130)).toBe(100);
  });
});

describe("formatClock", () => {
  it("no redondea el atraso a minutos", () => {
    expect(formatClock(95)).toBe("1:35");
    expect(formatClock(728)).toBe("12:08");
    expect(formatClock(3735)).toBe("1:02:15");
    expect(formatClock(-3)).toBe("0:00");
  });
});

describe("spokenClock", () => {
  it("se lee completo y en singular cuando corresponde", () => {
    expect(spokenClock(95)).toBe("1 minuto 35 segundos");
    expect(spokenClock(3601)).toBe("1 hora 1 segundo");
    expect(spokenClock(0)).toBe("0 segundos");
  });
});
