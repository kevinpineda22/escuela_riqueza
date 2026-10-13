import { describe, it, expect } from 'vitest';
import {
  EARLY_START_TOLERANCE_MS,
  parseRecordingCreatedMs,
  pickRecordingTarget,
  type RecordingCandidateRoom,
} from './recordingTarget';

function room(overrides: Partial<RecordingCandidateRoom> & { id: string }): RecordingCandidateRoom {
  return {
    status: 'ended',
    starts_at: '2026-10-10T14:00:00Z',
    archived_at: null,
    recording_stream_uid: null,
    ...overrides,
  };
}

const created = Date.parse('2026-10-10T15:20:00Z');

describe('pickRecordingTarget', () => {
  it('ignora salas ya archivadas (caso: grabación de prueba vs. clase del 2026-10-03)', () => {
    const archived = room({ id: 'vieja', starts_at: '2026-10-03T14:00:00Z', archived_at: '2026-10-03T20:00:00Z' });
    expect(pickRecordingTarget([archived], created)).toBeNull();
  });

  it('elige la sala más reciente que ya había arrancado', () => {
    const older = room({ id: 'older', starts_at: '2026-10-03T14:00:00Z' });
    const current = room({ id: 'current', status: 'live' });
    expect(pickRecordingTarget([older, current], created)?.id).toBe('current');
  });

  it('no vincula a una sala futura (grabación creada antes de su inicio menos la tolerancia)', () => {
    const future = room({ id: 'future', status: 'live', starts_at: '2026-10-10T18:00:00Z' });
    expect(pickRecordingTarget([future], created)).toBeNull();
  });

  it('acepta una sala iniciada antes del horario programado, dentro de la tolerancia', () => {
    const early = room({ id: 'early', status: 'live', starts_at: '2026-10-10T15:20:00Z' });
    const createdEarly = Date.parse('2026-10-10T15:20:00Z') - EARLY_START_TOLERANCE_MS + 1000;
    expect(pickRecordingTarget([early], createdEarly)?.id).toBe('early');
    expect(pickRecordingTarget([early], createdEarly - 2000)).toBeNull();
  });

  it('no sobrescribe una grabación ya vinculada', () => {
    const linked = room({ id: 'linked', recording_stream_uid: 'parte-1' });
    expect(pickRecordingTarget([linked], created)).toBeNull();
  });

  it('descarta salas programadas', () => {
    const scheduled = room({ id: 'scheduled', status: 'scheduled' });
    expect(pickRecordingTarget([scheduled], created)).toBeNull();
  });

  it('con una sala archivada reciente y una vigente, elige la vigente', () => {
    const archivedNewer = room({ id: 'archivada', starts_at: '2026-10-10T14:30:00Z', archived_at: '2026-10-10T16:00:00Z' });
    const active = room({ id: 'vigente', status: 'live', starts_at: '2026-10-10T14:00:00Z' });
    expect(pickRecordingTarget([archivedNewer, active], created)?.id).toBe('vigente');
  });
});

describe('parseRecordingCreatedMs', () => {
  it('parsea fechas ISO y rechaza valores inválidos', () => {
    expect(parseRecordingCreatedMs('2026-10-10T15:20:00Z')).toBe(created);
    expect(parseRecordingCreatedMs('no-es-fecha')).toBeNull();
    expect(parseRecordingCreatedMs(undefined)).toBeNull();
  });
});
