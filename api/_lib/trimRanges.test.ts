import { describe, it, expect } from 'vitest';
import { keptSegments, validateTrimRanges } from './trimRanges';

// Clase de 4 h con receso de 1:00:00 a 1:35:00.
const DURATION = 4 * 3600;
const RECESO = { start: 3600, end: 5700 };

describe('validateTrimRanges', () => {
  it('acepta un receso dentro de la grabación', () => {
    expect(validateTrimRanges([RECESO], DURATION)).toEqual({ ok: true, ranges: [RECESO] });
  });

  it('ordena los tramos y redondea al milisegundo', () => {
    const r = validateTrimRanges(
      [
        { start: 7000.12345, end: 7100 },
        { start: 100, end: 200 },
      ],
      DURATION,
    );
    expect(r).toEqual({
      ok: true,
      ranges: [
        { start: 100, end: 200 },
        { start: 7000.123, end: 7100 },
      ],
    });
  });

  it('acepta un tramo que llega justo al final', () => {
    expect(validateTrimRanges([{ start: DURATION - 600, end: DURATION }], DURATION).ok).toBe(true);
  });

  it('rechaza una lista vacía o que no es lista', () => {
    expect(validateTrimRanges([], DURATION).ok).toBe(false);
    expect(validateTrimRanges(null, DURATION).ok).toBe(false);
    expect(validateTrimRanges({ start: 1, end: 2 }, DURATION).ok).toBe(false);
  });

  it('rechaza tramos sin números válidos', () => {
    expect(validateTrimRanges([{ start: '3600', end: 5700 }], DURATION).ok).toBe(false);
    expect(validateTrimRanges([{ start: NaN, end: 5700 }], DURATION).ok).toBe(false);
    expect(validateTrimRanges([null], DURATION).ok).toBe(false);
  });

  it('rechaza tramos fuera de la grabación', () => {
    expect(validateTrimRanges([{ start: -1, end: 100 }], DURATION).ok).toBe(false);
    expect(validateTrimRanges([{ start: 100, end: DURATION + 1 }], DURATION).ok).toBe(false);
  });

  it('rechaza un fin antes del inicio y tramos demasiado cortos', () => {
    expect(validateTrimRanges([{ start: 5700, end: 3600 }], DURATION).ok).toBe(false);
    expect(validateTrimRanges([{ start: 3600, end: 3602 }], DURATION).ok).toBe(false);
  });

  it('rechaza tramos superpuestos, aunque lleguen desordenados', () => {
    expect(
      validateTrimRanges(
        [
          { start: 5000, end: 6000 },
          { start: 3600, end: 5700 },
        ],
        DURATION,
      ).ok,
    ).toBe(false);
  });

  it('rechaza un recorte que deja menos de un minuto', () => {
    expect(validateTrimRanges([{ start: 30, end: DURATION }], DURATION).ok).toBe(false);
  });

  it('rechaza más tramos de los permitidos', () => {
    const many = Array.from({ length: 6 }, (_, i) => ({ start: i * 100, end: i * 100 + 10 }));
    expect(validateTrimRanges(many, DURATION).ok).toBe(false);
  });

  it('rechaza si no se conoce la duración', () => {
    expect(validateTrimRanges([RECESO], 0).ok).toBe(false);
    expect(validateTrimRanges([RECESO], NaN).ok).toBe(false);
  });
});

describe('keptSegments', () => {
  it('un receso en el medio deja dos tramos que se unen en un solo video', () => {
    expect(keptSegments([RECESO], DURATION)).toEqual([
      { start: 0, end: 3600 },
      { start: 5700, end: DURATION },
    ]);
  });

  it('un corte al principio o al final deja un solo tramo', () => {
    expect(keptSegments([{ start: 0, end: 600 }], DURATION)).toEqual([{ start: 600, end: DURATION }]);
    expect(keptSegments([{ start: DURATION - 600, end: DURATION }], DURATION)).toEqual([
      { start: 0, end: DURATION - 600 },
    ]);
  });

  it('descarta un borde de menos de 1 s', () => {
    expect(keptSegments([{ start: 0.5, end: 600 }], DURATION)).toEqual([{ start: 600, end: DURATION }]);
  });

  it('con dos tramos deja tres segmentos', () => {
    expect(
      keptSegments(
        [
          { start: 100, end: 200 },
          { start: 1000, end: 2000 },
        ],
        DURATION,
      ),
    ).toEqual([
      { start: 0, end: 100 },
      { start: 200, end: 1000 },
      { start: 2000, end: DURATION },
    ]);
  });
});
