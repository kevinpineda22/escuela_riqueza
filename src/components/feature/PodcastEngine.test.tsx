import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from 'vitest';
import { render, act } from '@testing-library/react';
import PodcastEngine from './PodcastEngine';
import { usePlayerStore } from '@/stores/player.store';
import { flushLessonProgress } from '@/lib/api/stream/progress';

vi.mock('@/stores/player.store', () => ({
  usePlayerStore: vi.fn(),
}));

vi.mock('@/lib/api/stream/progress', () => ({
  saveUserProgress: vi.fn().mockResolvedValue(undefined),
  flushLessonProgress: vi.fn().mockResolvedValue(undefined),
}));

// Handlers del <Stream> capturados para poder dispararlos como lo haría el iframe.
let streamHandlers: Record<string, () => void> = {};
const engineEl = { currentTime: 0, duration: 600, play: vi.fn().mockResolvedValue(undefined), pause: vi.fn(), volume: 1, paused: false };

vi.mock('@cloudflare/stream-react', () => ({
  Stream: ({ streamRef, onCanPlay, onTimeUpdate, onPlay, onPause, onEnded }: any) => {
    if (streamRef) streamRef.current = engineEl;
    streamHandlers = { onCanPlay, onTimeUpdate, onPlay, onPause, onEnded };
    return <div data-testid="podcast-stream" />;
  },
}));

// jsdom no implementa la reproducción de medios; el engine usa un <audio> silencioso
// para quedarse con el MediaSession del sistema operativo.
beforeAll(() => {
  vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined);
  vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {});
});

const track = { id: 'lesson-1', videoId: 'video-1', title: 'Lección 1', moduleTitle: 'Módulo 1' };

function mockStore(overrides: Record<string, unknown> = {}) {
  (usePlayerStore as any).mockReturnValue({
    track,
    isPlaying: true,
    isPodcastMode: true,
    volume: 1,
    lastKnownTime: 0,
    lastVideoId: null,
    setIsPlaying: vi.fn(),
    setPlaybackProgress: vi.fn(),
    ...overrides,
  });
}

describe('PodcastEngine progress', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    streamHandlers = {};
    engineEl.currentTime = 0;
    engineEl.duration = 600;
  });

  afterEach(() => {
    Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
  });

  it('resumes at the stored minute when the lesson matches', () => {
    mockStore({ lastKnownTime: 143, lastVideoId: 'video-1' });
    render(<PodcastEngine />);

    act(() => { streamHandlers.onCanPlay?.(); });

    expect(engineEl.currentTime).toBe(143);
  });

  it('does not seek when the stored minute belongs to another lesson', () => {
    mockStore({ lastKnownTime: 143, lastVideoId: 'another-video' });
    render(<PodcastEngine />);

    act(() => { streamHandlers.onCanPlay?.(); });

    expect(engineEl.currentTime).toBe(0);
  });

  it('saves the exact minute when the tab is hidden', () => {
    mockStore({ lastKnownTime: 0, lastVideoId: 'video-1' });
    render(<PodcastEngine />);

    engineEl.currentTime = 321;
    Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
    act(() => { document.dispatchEvent(new Event('visibilitychange')); });

    expect(flushLessonProgress).toHaveBeenCalledWith('lesson-1', 321, 600, false);
  });

  it('does not save while the tab is still visible', () => {
    mockStore();
    render(<PodcastEngine />);

    engineEl.currentTime = 321;
    act(() => { document.dispatchEvent(new Event('visibilitychange')); });

    expect(flushLessonProgress).not.toHaveBeenCalled();
  });

  it('saves the exact minute when the page is being unloaded', () => {
    mockStore();
    render(<PodcastEngine />);

    engineEl.currentTime = 99;
    act(() => { window.dispatchEvent(new Event('pagehide')); });

    expect(flushLessonProgress).toHaveBeenCalledWith('lesson-1', 99, 600, false);
  });
});
