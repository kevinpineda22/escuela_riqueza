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

describe('GlobalPodcastPlayer close', () => {
  const setPlaybackProgress = vi.fn();
  const closePlayer = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    podcastStreamRef.current = null;
    (usePlayerStore as any).mockReturnValue({
      track,
      isPlaying: true,
      isPodcastMode: true,
      volume: 1,
      setIsPlaying: vi.fn(),
      setVolume: vi.fn(),
      setPlaybackProgress,
      closePlayer,
    });
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
