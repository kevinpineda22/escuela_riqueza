import { describe, it, expect, vi, beforeEach } from 'vitest';
import { flushLessonProgress, isLessonCompleted, resumePoint, saveUserProgress, fetchUserProgress, fetchAllUserProgress } from './progress';
import { supabase } from '@/lib/supabase';

const upsert = vi.fn().mockResolvedValue({ error: null });

vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: { getUser: vi.fn() },
    from: vi.fn(),
  },
}));

describe('isLessonCompleted', () => {
  it('marks a lesson completed from 90% of its duration', () => {
    expect(isLessonCompleted(89, 100)).toBe(false);
    expect(isLessonCompleted(90, 100)).toBe(true);
    expect(isLessonCompleted(100, 100)).toBe(true);
  });

  it('never completes a lesson of unknown duration', () => {
    expect(isLessonCompleted(500, 0)).toBe(false);
  });
});

describe('resumePoint', () => {
  it('keeps the second when the lesson is left mid-way', () => {
    expect(resumePoint(137, 400)).toBe(137);
    expect(resumePoint(398, 400)).toBe(398);
  });

  // Una lección vista entera no tiene "dónde retomar": guardar el último segundo
  // haría que el modal ofreciera continuar en el final del video.
  it('collapses to zero when the lesson reached the end', () => {
    expect(resumePoint(400, 400)).toBe(0);
    expect(resumePoint(399.5, 400)).toBe(0);
  });

  it('keeps the second when the duration is unknown', () => {
    expect(resumePoint(137, undefined)).toBe(137);
    expect(resumePoint(137, 0)).toBe(137);
  });
});

describe('flushLessonProgress', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (supabase.auth.getUser as any).mockResolvedValue({ data: { user: { id: 'user-1' } } });
    (supabase.from as any).mockReturnValue({ upsert });
  });

  it('persists the exact second for the lesson', async () => {
    await flushLessonProgress('exact-1', 42.7, 100);

    expect(supabase.from).toHaveBeenCalledWith('user_lesson_progress');
    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: 'user-1',
        lesson_id: 'exact-1',
        progress_seconds: 42,
        is_completed: false,
      }),
      expect.anything()
    );
  });

  it('marks completion when past 90% of the duration', async () => {
    await flushLessonProgress('completed-1', 95, 100);
    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({ progress_seconds: 95, is_completed: true }),
      expect.anything()
    );
  });

  it('stores no resume point once the lesson reached the end', async () => {
    await flushLessonProgress('finished-1', 100, 100);
    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({ progress_seconds: 0, is_completed: true }),
      expect.anything()
    );
  });

  it('honours forceCompleted regardless of duration', async () => {
    await flushLessonProgress('forced-1', 10, 100, true);
    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({ is_completed: true }),
      expect.anything()
    );
  });

  // Los momentos de transición pueden disparar el guardado antes de que el iframe
  // reporte un tiempo válido. Guardar eso pisaría el progreso real con un 0.
  it.each([
    ['no lesson', null, 42],
    ['undefined lesson', undefined, 42],
    ['zero seconds', 'guard-1', 0],
    ['negative seconds', 'guard-2', -5],
    ['NaN seconds', 'guard-3', NaN],
    ['undefined seconds', 'guard-4', undefined],
  ])('writes nothing when there is %s', async (_label, lessonId, seconds) => {
    await flushLessonProgress(lessonId as any, seconds as any, 100);
    expect(upsert).not.toHaveBeenCalled();
  });

  it('still saves when the duration is unknown, without marking completion', async () => {
    await flushLessonProgress('nodur-1', 30, undefined);
    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({ progress_seconds: 30, is_completed: false }),
      expect.anything()
    );
  });
});

// Regresión: repasar una lección terminada la marcaba como incompleta y el progreso
// del módulo bajaba, obligando al alumno a verla entera otra vez.
describe('completion is never undone', () => {
  const maybeSingle = vi.fn();
  const select = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    (supabase.auth.getUser as any).mockResolvedValue({ data: { user: { id: 'user-1' } } });
    (supabase.from as any).mockReturnValue({
      upsert,
      select: select.mockReturnValue({
        eq: () => ({ eq: () => ({ maybeSingle }) }),
      }),
    });
  });

  it('keeps is_completed true when the lesson is replayed from the start', async () => {
    // La lección ya está terminada
    await saveUserProgress('replayed-1', 380, true);
    upsert.mockClear();

    // El alumno la repasa: el cálculo del 90% da false a los 12 segundos
    await saveUserProgress('replayed-1', 12, false);

    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({ lesson_id: 'replayed-1', progress_seconds: 12, is_completed: true }),
      expect.anything()
    );
  });

  it('learns completion from a single fetch, so a reload cannot undo it', async () => {
    maybeSingle.mockResolvedValue({
      data: { lesson_id: 'fetched-1', progress_seconds: 380, is_completed: true },
      error: null,
    });
    await fetchUserProgress('fetched-1');

    await saveUserProgress('fetched-1', 5, false);

    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({ is_completed: true }),
      expect.anything()
    );
  });

  it('learns completion from the dashboard listing', async () => {
    (supabase.from as any).mockReturnValue({
      upsert,
      select: () => Promise.resolve({
        data: [{ lesson_id: 'listed-1', is_completed: true }, { lesson_id: 'listed-2', is_completed: false }],
        error: null,
      }),
    });
    await fetchAllUserProgress();

    (supabase.from as any).mockReturnValue({ upsert });
    await saveUserProgress('listed-1', 3, false);
    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({ lesson_id: 'listed-1', is_completed: true }),
      expect.anything()
    );

    upsert.mockClear();
    await saveUserProgress('listed-2', 3, false);
    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({ lesson_id: 'listed-2', is_completed: false }),
      expect.anything()
    );
  });
});
