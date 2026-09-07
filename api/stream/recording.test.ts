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
