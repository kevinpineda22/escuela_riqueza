import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import GlobalPodcastPlayer from './GlobalPodcastPlayer';
import { usePlayerStore } from '@/stores/player.store';
import { flushLessonProgress } from '@/lib/api/stream/progress';
import { podcastStreamRef } from '@/components/feature/PodcastEngine';

vi.mock('@/stores/player.store', () => ({
  usePlayerStore: vi.fn(),
}));

vi.mock('@/components/feature/PodcastEngine', () => ({
  podcastStreamRef: { current: null },
}));

vi.mock('@/lib/api/stream/progress', () => ({
  flushLessonProgress: vi.fn().mockResolvedValue(undefined),
}));

const track = {
  id: 'lesson-1',
  videoId: 'video-1',
  title: 'Lección 1',
  moduleTitle: 'Módulo 1',
};

const setPlaybackProgress = vi.fn();
const closePlayer = vi.fn();
const setIsPlaying = vi.fn();

function mockStore(overrides: Record<string, unknown> = {}) {
  (usePlayerStore as any).mockReturnValue({
    track,
    isPlaying: true,
    isPodcastMode: true,
    hasEnded: false,
    volume: 1,
    setIsPlaying,
    setVolume: vi.fn(),
    setPlaybackProgress,
    closePlayer,
    ...overrides,
  });
}

describe('GlobalPodcastPlayer close', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    podcastStreamRef.current = null;
    mockStore();
  });

  it('persists the exact minute before closing the player', () => {
    podcastStreamRef.current = { currentTime: 128, duration: 600, play: vi.fn(), pause: vi.fn() };

    render(<GlobalPodcastPlayer />);
    fireEvent.click(screen.getAllByLabelText('Cerrar reproductor')[0]);

    expect(setPlaybackProgress).toHaveBeenCalledWith('video-1', 128);
    expect(flushLessonProgress).toHaveBeenCalledWith('lesson-1', 128, 600);
    expect(closePlayer).toHaveBeenCalled();
  });

  it('still closes when the engine has no stream yet', () => {
    render(<GlobalPodcastPlayer />);
    fireEvent.click(screen.getAllByLabelText('Cerrar reproductor')[0]);

    expect(flushLessonProgress).not.toHaveBeenCalled();
    expect(closePlayer).toHaveBeenCalled();
  });
});

describe('GlobalPodcastPlayer completed state', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    podcastStreamRef.current = { currentTime: 600, duration: 600, play: vi.fn().mockResolvedValue(undefined), pause: vi.fn() };
  });

  it('announces the lesson as completed instead of the module name', () => {
    mockStore({ hasEnded: true, isPlaying: false });
    render(<GlobalPodcastPlayer />);

    expect(screen.getByText('Lección completada')).toBeTruthy();
    expect(screen.queryByText('Módulo 1')).toBeNull();
  });

  it('offers to listen again once completed', () => {
    mockStore({ hasEnded: true, isPlaying: false });
    render(<GlobalPodcastPlayer />);

    expect(screen.getByLabelText('Escuchar de nuevo')).toBeTruthy();
    expect(screen.queryByLabelText('Reproducir')).toBeNull();
  });

  it('restarts from the beginning when listening again', () => {
    mockStore({ hasEnded: true, isPlaying: false });
    render(<GlobalPodcastPlayer />);

    fireEvent.click(screen.getByLabelText('Escuchar de nuevo'));

    expect(podcastStreamRef.current.currentTime).toBe(0);
    expect(podcastStreamRef.current.play).toHaveBeenCalled();
    expect(setIsPlaying).toHaveBeenCalledWith(true);
  });

  it('keeps the normal controls while the lesson is still playing', () => {
    mockStore({ hasEnded: false, isPlaying: true });
    render(<GlobalPodcastPlayer />);

    expect(screen.queryByText('Lección completada')).toBeNull();
    expect(screen.getByLabelText('Pausar')).toBeTruthy();
  });
});
