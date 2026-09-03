import { describe, it, expect, vi, beforeEach } from 'vitest';
import { flushLessonProgress, isLessonCompleted } from './progress';
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

describe('flushLessonProgress', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (supabase.auth.getUser as any).mockResolvedValue({ data: { user: { id: 'user-1' } } });
    (supabase.from as any).mockReturnValue({ upsert });
  });

  it('persists the exact second for the lesson', async () => {
    await flushLessonProgress('lesson-1', 42.7, 100);

    expect(supabase.from).toHaveBeenCalledWith('user_lesson_progress');
    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: 'user-1',
        lesson_id: 'lesson-1',
        progress_seconds: 42,
        is_completed: false,
      }),
      expect.anything()
    );
  });

  it('marks completion when past 90% of the duration', async () => {
    await flushLessonProgress('lesson-1', 95, 100);
    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({ is_completed: true }),
      expect.anything()
    );
  });

  it('honours forceCompleted regardless of duration', async () => {
    await flushLessonProgress('lesson-1', 10, 100, true);
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
    ['zero seconds', 'lesson-1', 0],
    ['negative seconds', 'lesson-1', -5],
    ['NaN seconds', 'lesson-1', NaN],
    ['undefined seconds', 'lesson-1', undefined],
  ])('writes nothing when there is %s', async (_label, lessonId, seconds) => {
    await flushLessonProgress(lessonId as any, seconds as any, 100);
    expect(upsert).not.toHaveBeenCalled();
  });

  it('still saves when the duration is unknown, without marking completion', async () => {
    await flushLessonProgress('lesson-1', 30, undefined);
    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({ progress_seconds: 30, is_completed: false }),
      expect.anything()
    );
  });
});
