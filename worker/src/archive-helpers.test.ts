import { describe, it, expect } from 'vitest';
import {
  buildClaimExpiredReviewUrl,
  buildClaimManualArchiveUrl,
  buildLiveStatusUrl,
  buildPendingLivesUrl,
  buildRecordingKey,
  buildRegisterUrl,
  decideExistingObject,
  decideReviewAction,
  parseContentLength,
} from './archive-helpers';

const NOW = new Date('2026-10-19T15:30:00.000Z');

/** Valor decodificado de un parámetro de la URL de PostgREST. */
function param(url: string, name: string): string | null {
  return new URL(url).searchParams.get(name);
}

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

  describe('revisión de la grabación', () => {
    const reviewUrl = buildPendingLivesUrl('https://x.supabase.co', 3, NOW);
    const or = param(reviewUrl, 'or');

    it('trae la revisión para que el cron decida si reclamar', () => {
      expect(param(reviewUrl, 'select')).toBe('id,recording_stream_uid,recording_review');
    });

    it('sigue archivando las salas sin revisión (anteriores a la migración)', () => {
      expect(or).toContain('recording_review.is.null');
    });

    it('archiva las que el admin mandó a archivar completas', () => {
      expect(or).toContain('recording_review.eq.keep');
    });

    it('solo incluye una pending cuando venció su plazo', () => {
      expect(or).toContain(
        'and(recording_review.eq.pending,review_deadline_at.lt."2026-10-19T15:30:00.000Z")',
      );
    });

    it('nunca incluye una sala en recorte', () => {
      expect(or).not.toContain('trimming');
    });

    it('el filtro es un único árbol lógico entre paréntesis', () => {
      expect(or?.startsWith('(')).toBe(true);
      expect(or?.endsWith(')')).toBe(true);
    });

    it('va codificado en la URL (las comas, comillas y : no viajan crudas)', () => {
      const raw = reviewUrl.split('&or=')[1].split('&')[0];
      expect(raw).not.toMatch(/[",:]/);
      expect(raw).toContain('%2C');
      expect(raw).toContain('%22');
    });
  });
});

describe('buildLiveStatusUrl', () => {
  it('escapa el id de la sala', () => {
    expect(buildLiveStatusUrl('https://x.supabase.co', 'a b')).toContain('id=eq.a%20b');
  });

  it('trae la revisión y el video vinculado junto con el estado', () => {
    expect(param(buildLiveStatusUrl('https://x.supabase.co', 'live-1'), 'select')).toBe(
      'status,recording_review,recording_stream_uid',
    );
  });
});

describe('buildClaimExpiredReviewUrl', () => {
  const u = buildClaimExpiredReviewUrl('https://x.supabase.co', 'live-1', NOW);

  it('solo reclama si la sala sigue pending y sin archivar', () => {
    expect(param(u, 'id')).toBe('eq.live-1');
    expect(param(u, 'recording_review')).toBe('eq.pending');
    expect(param(u, 'archived_at')).toBe('is.null');
  });

  it('exige que el plazo haya vencido', () => {
    expect(param(u, 'review_deadline_at')).toBe('lt.2026-10-19T15:30:00.000Z');
  });
});

describe('buildClaimManualArchiveUrl', () => {
  const u = buildClaimManualArchiveUrl('https://x.supabase.co', 'live-1');

  it('reclama una pending sin archivar', () => {
    expect(param(u, 'id')).toBe('eq.live-1');
    expect(param(u, 'recording_review')).toBe('eq.pending');
    expect(param(u, 'archived_at')).toBe('is.null');
  });

  it('no mira el plazo: el admin decidió archivar completa', () => {
    expect(param(u, 'review_deadline_at')).toBeNull();
  });
});

describe('decideReviewAction', () => {
  it('archiva directo las salas sin revisión o en keep', () => {
    expect(decideReviewAction(null)).toBe('archive');
    expect(decideReviewAction(undefined)).toBe('archive');
    expect(decideReviewAction('keep')).toBe('archive');
  });

  it('reclama antes de archivar una pending', () => {
    expect(decideReviewAction('pending')).toBe('claim');
  });

  it('saltea una sala en recorte o con un valor desconocido', () => {
    expect(decideReviewAction('trimming')).toBe('skip');
    expect(decideReviewAction('otra-cosa')).toBe('skip');
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
