import { describe, it, expect } from 'vitest';
import { sortReadyRecordings, type StreamVideo } from './recording';

// Caso real del 2026-09-05: el vivo arrancó 14:18 UTC y duró 3h25m; OBS se reconectó
// a las 17:47 y grabó 15 min más. Elegir "la más reciente" vinculaba los 15 min.
const vivoReal: StreamVideo = {
  uid: 'vivo-real',
  created: '2026-09-05T14:18:00Z',
  duration: 12309,
  status: { state: 'ready' },
};
const reconexion: StreamVideo = {
  uid: 'reconexion',
  created: '2026-09-05T17:47:00Z',
  duration: 942,
  status: { state: 'ready' },
};

describe('sortReadyRecordings', () => {
  it('pone primero el vivo real aunque la reconexión sea más reciente', () => {
    const [first] = sortReadyRecordings([reconexion, vivoReal]);
    expect(first.uid).toBe('vivo-real');
  });

  it('devuelve todas las grabaciones listas, de mayor a menor duración', () => {
    const result = sortReadyRecordings([reconexion, vivoReal]);
    expect(result.map(v => v.uid)).toEqual(['vivo-real', 'reconexion']);
  });

  it('descarta la transmisión en curso y las que siguen procesando', () => {
    const enVivo: StreamVideo = { uid: 'en-vivo', duration: 99999, status: { state: 'live-inprogress' } };
    const procesando: StreamVideo = { uid: 'procesando', duration: 88888, status: { state: 'inprogress' } };

    const result = sortReadyRecordings([enVivo, procesando, vivoReal, reconexion]);

    expect(result.map(v => v.uid)).toEqual(['vivo-real', 'reconexion']);
  });

  it('trata una duración ausente como cero en vez de romper el orden', () => {
    const sinDuracion: StreamVideo = { uid: 'sin-duracion', status: { state: 'ready' } };
    const result = sortReadyRecordings([sinDuracion, reconexion]);
    expect(result.map(v => v.uid)).toEqual(['reconexion', 'sin-duracion']);
  });

  it('devuelve lista vacía cuando no hay ninguna lista', () => {
    expect(sortReadyRecordings([])).toEqual([]);
    expect(sortReadyRecordings([{ uid: 'x', status: { state: 'inprogress' } }])).toEqual([]);
  });
});

// Caso real del 2026-09-12: el Live Input todavía tenía el vivo del 29 de agosto (4h10m,
// sin archivar) y "la más larga" a secas lo vinculó al vivo del 12 de septiembre.
describe('sortReadyRecordings con la fecha del vivo', () => {
  const vivoDeAgosto: StreamVideo = {
    uid: 'agosto-4h10',
    created: '2026-08-29T14:12:00Z',
    duration: 15028,
    status: { state: 'ready' },
  };
  const vivoDelDia: StreamVideo = {
    uid: 'sept-12-3h50',
    created: '2026-09-12T14:05:00Z',
    duration: 13800,
    status: { state: 'ready' },
  };
  const reconexionDelDia: StreamVideo = {
    uid: 'sept-12-reconexion',
    created: '2026-09-12T18:01:00Z',
    duration: 600,
    status: { state: 'ready' },
  };
  const startsAt = '2026-09-12T14:02:00Z';

  it('sugiere el vivo del día aunque uno de otra fecha sea más largo', () => {
    const [first] = sortReadyRecordings([vivoDeAgosto, reconexionDelDia, vivoDelDia], startsAt);
    expect(first.uid).toBe('sept-12-3h50');
  });

  it('dentro del día sigue prefiriendo la más larga sobre una reconexión', () => {
    const result = sortReadyRecordings([reconexionDelDia, vivoDelDia], startsAt);
    expect(result.map(v => v.uid)).toEqual(['sept-12-3h50', 'sept-12-reconexion']);
  });

  it('deja las grabaciones de otros días al final, no las oculta', () => {
    const result = sortReadyRecordings([vivoDeAgosto, reconexionDelDia, vivoDelDia], startsAt);
    expect(result.map(v => v.uid)).toEqual(['sept-12-3h50', 'sept-12-reconexion', 'agosto-4h10']);
  });

  it('acepta un vivo que arrancó un poco antes de lo programado', () => {
    const temprano: StreamVideo = { uid: 'temprano', created: '2026-09-12T12:30:00Z', duration: 9000, status: { state: 'ready' } };
    const [first] = sortReadyRecordings([vivoDeAgosto, temprano], startsAt);
    expect(first.uid).toBe('temprano');
  });

  it('sin fecha, cae al orden por duración', () => {
    const [first] = sortReadyRecordings([vivoDelDia, vivoDeAgosto]);
    expect(first.uid).toBe('agosto-4h10');
  });
});
