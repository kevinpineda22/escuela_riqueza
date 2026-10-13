import { describe, it, expect } from 'vitest';
import { buildLiveStatusUrl, buildPendingLivesUrl, buildRecordingKey } from './archive-helpers';

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

  it('mantiene el límite por tick', () => {
    expect(url).toContain('limit=3');
  });
});

describe('buildLiveStatusUrl', () => {
  it('escapa el id de la sala', () => {
    expect(buildLiveStatusUrl('https://x.supabase.co', 'a b')).toContain('id=eq.a%20b');
  });
});
