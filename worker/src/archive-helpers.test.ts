import { describe, it, expect } from 'vitest';
import {
  buildLiveStatusUrl,
  buildPendingLivesUrl,
  buildRecordingKey,
  buildRegisterUrl,
  decideExistingObject,
  parseContentLength,
} from './archive-helpers';

describe('buildRecordingKey', () => {
  it('es única por video de Stream dentro de la misma sala', () => {
    const a = buildRecordingKey('live-1', 'video-a');
    const b = buildRecordingKey('live-1', 'video-b');
    expect(a).toBe('recordings/live-1/video-a.mp4');
    expect(a).not.toBe(b);
  });

  it('no coincide con la forma antigua por sala (recordings/<liveId>.mp4)', () => {
    expect(buildRecordingKey('live-1', 'video-a')).not.toBe('recordings/live-1.mp4');
  });
});

describe('buildPendingLivesUrl', () => {
  const url = buildPendingLivesUrl('https://x.supabase.co');

  it('solo pide salas finalizadas, sin archivar y con grabación vinculada', () => {
    expect(url).toContain('status=eq.ended');
    expect(url).toContain('archived_at=is.null');
    expect(url).toContain('recording_stream_uid=not.is.null');
  });

  it('ordena de forma determinista', () => {
    expect(url).toContain('order=starts_at.asc');
  });

  it('mantiene el límite por tick', () => {
    expect(url).toContain('limit=3');
  });
});

describe('buildLiveStatusUrl', () => {
  it('escapa el id de la sala', () => {
    expect(buildLiveStatusUrl('https://x.supabase.co', 'a b')).toContain('id=eq.a%20b');
  });
});

describe('buildRegisterUrl', () => {
  it('condiciona el PATCH al uid del video archivado', () => {
    const u = buildRegisterUrl('https://x.supabase.co', 'live-1', 'abc123');
    expect(u).toContain('id=eq.live-1');
    expect(u).toContain('&recording_stream_uid=eq.abc123');
  });
});

describe('decideExistingObject', () => {
  it('retoma si el tamaño coincide con el MP4 esperado', () => {
    expect(decideExistingObject(1000, 1000)).toBe('resume');
  });
  it('rechaza si el tamaño difiere', () => {
    expect(decideExistingObject(900, 1000)).toBe('refuse');
  });
  it('rechaza si el tamaño esperado es desconocido', () => {
    expect(decideExistingObject(1000, null)).toBe('refuse');
    expect(decideExistingObject(0, 0)).toBe('refuse');
  });
});

describe('parseContentLength', () => {
  it('parsea enteros positivos y descarta el resto', () => {
    expect(parseContentLength('1234')).toBe(1234);
    expect(parseContentLength(null)).toBeNull();
    expect(parseContentLength('abc')).toBeNull();
    expect(parseContentLength('0')).toBeNull();
  });
});
