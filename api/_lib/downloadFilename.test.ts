import { describe, it, expect } from 'vitest';
import { buildRecordingDownloadFilename, slugifyTitle } from './downloadFilename';

describe('slugifyTitle', () => {
  it('quita acentos y símbolos', () => {
    expect(slugifyTitle('¡Cómo ahorrar: la guía "definitiva"!')).toBe('Como-ahorrar-la-guia-definitiva');
  });

  it('limita a 60 caracteres sin dejar guion final', () => {
    const slug = slugifyTitle('a'.repeat(59) + ' bbbbbb');
    expect(slug.length).toBeLessThanOrEqual(60);
    expect(slug.endsWith('-')).toBe(false);
  });

  it('devuelve vacío si no queda nada utilizable', () => {
    expect(slugifyTitle('¿¡?!')).toBe('');
  });
});

describe('buildRecordingDownloadFilename', () => {
  it('combina fecha y título', () => {
    expect(buildRecordingDownloadFilename('Clase de Ahorro', '2026-10-31T15:00:00Z')).toBe(
      'Clase-2026-10-31-Clase-de-Ahorro.mp4',
    );
  });

  it('usa la fecha de Colombia, no la de UTC', () => {
    // 01:00 UTC del 1 nov = 20:00 del 31 oct en Bogotá.
    expect(buildRecordingDownloadFilename('Vivo', '2026-11-01T01:00:00Z')).toBe('Clase-2026-10-31-Vivo.mp4');
  });

  it('tolera título y fecha ausentes o inválidos', () => {
    expect(buildRecordingDownloadFilename('', null)).toBe('Clase.mp4');
    expect(buildRecordingDownloadFilename(null, 'no-fecha')).toBe('Clase.mp4');
  });

  it('nunca incluye caracteres que rompan el header', () => {
    const name = buildRecordingDownloadFilename('a"b\r\nc;d', '2026-10-31T15:00:00Z');
    expect(name).toMatch(/^[A-Za-z0-9.-]+$/);
  });
});
