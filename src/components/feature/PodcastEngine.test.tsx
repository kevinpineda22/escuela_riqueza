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
    hasEnded: false,
    setIsPlaying: vi.fn(),
    setHasEnded: vi.fn(),
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

describe('PodcastEngine end of lesson', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    streamHandlers = {};
    engineEl.currentTime = 0;
    engineEl.duration = 600;
    engineEl.paused = false;
    engineEl.play.mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('flags the track as ended and stops playback', () => {
    const setIsPlaying = vi.fn();
    const setHasEnded = vi.fn();
    mockStore({ setIsPlaying, setHasEnded });
    render(<PodcastEngine />);

    engineEl.currentTime = 600;
    act(() => { streamHandlers.onEnded?.(); });

    expect(setIsPlaying).toHaveBeenCalledWith(false);
    expect(setHasEnded).toHaveBeenCalledWith(true);
  });

  // Regresión: el watchdog revivía la pista terminada, y play() sobre una pista
  // que llegó al final arranca de cero — la lección se repetía sola.
  it('does not let the watchdog restart the lesson after it ended', () => {
    mockStore();
    render(<PodcastEngine />);

    act(() => { streamHandlers.onEnded?.(); });
    engineEl.play.mockClear();
    engineEl.paused = true;

    act(() => { vi.advanceTimersByTime(5000); });

    expect(engineEl.play).not.toHaveBeenCalled();
  });

  // Regresión del orden REAL de eventos: el navegador dispara `pause` ANTES que
  // `ended`. handlePause programa un play() a 200ms cuando endedRef todavía es false;
  // si no se revalida dentro del timeout, la lección se reinicia sola al completarse.
  it('does not resume when pause arrives before ended', () => {
    mockStore();
    render(<PodcastEngine />);

    engineEl.currentTime = engineEl.duration; // llegó al final
    act(() => { streamHandlers.onPause?.() });   // pause primero…
    act(() => { streamHandlers.onEnded?.() });   // …y ended después
    engineEl.play.mockClear();

    act(() => { vi.advanceTimersByTime(1000); }); // el timeout de handlePause vence acá

    expect(engineEl.play).not.toHaveBeenCalled();
  });

  it('does not resume from a pause fired after ended either', () => {
    mockStore();
    render(<PodcastEngine />);

    act(() => { streamHandlers.onEnded?.(); });
    engineEl.play.mockClear();

    act(() => { streamHandlers.onPause?.(); });
    act(() => { vi.advanceTimersByTime(1000); });

    expect(engineEl.play).not.toHaveBeenCalled();
  });

  // Una pausa normal a mitad de lección SÍ debe reanudarse (el iframe suspendido).
  it('still resumes a mid-lesson pause', () => {
    mockStore();
    render(<PodcastEngine />);

    engineEl.currentTime = 120; // lejos del final
    engineEl.play.mockClear();

    act(() => { streamHandlers.onPause?.(); });
    act(() => { vi.advanceTimersByTime(1000); });

    expect(engineEl.play).toHaveBeenCalled();
  });

  it('plays again once the user explicitly resumes', () => {
    mockStore({ isPlaying: true });
    const { rerender } = render(<PodcastEngine />);

    act(() => { streamHandlers.onEnded?.(); });

    // handleEnded llama setIsPlaying(false); reflejamos ese estado en el store
    mockStore({ isPlaying: false });
    rerender(<PodcastEngine />);
    engineEl.play.mockClear();
    engineEl.paused = true;

    // El usuario pulsa reproducir
    mockStore({ isPlaying: true });
    rerender(<PodcastEngine />);
    act(() => { vi.advanceTimersByTime(2000); });

    expect(engineEl.play).toHaveBeenCalled();
  });
});
