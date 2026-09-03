import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import LessonPlayer from './LessonPlayer';
import { usePlayerStore } from '@/stores/player.store';
import { fetchPlatformSettings } from '@/lib/api/admin/settings';
import { flushLessonProgress } from '@/lib/api/stream/progress';
import { podcastStreamRef } from '@/components/feature/PodcastEngine';

// Tiempo que reporta el <Stream> local simulado; los tests lo ajustan.
const localStreamState = { currentTime: 0, duration: 100 };

// Mock the dependencies
vi.mock('@/stores/player.store', () => ({
  usePlayerStore: vi.fn(),
}));

vi.mock('@cloudflare/stream-react', () => ({
  Stream: ({ onEnded, streamRef, className, onTimeUpdate }: any) => {
    // Provide a way to simulate stream behavior
    if (streamRef) {
      streamRef.current = {
        play: vi.fn(),
        pause: vi.fn(),
        get currentTime() { return localStreamState.currentTime; },
        set currentTime(v: number) { localStreamState.currentTime = v; },
        get duration() { return localStreamState.duration; },
      };
    }
    return (
      <div data-testid="cloudflare-stream" className={className}>
        <button data-testid="stream-ended" onClick={onEnded}>End Stream</button>
        <button data-testid="stream-timeupdate" onClick={onTimeUpdate}>Time Update</button>
      </div>
    );
  },
}));

vi.mock('@/lib/api/stream/progress', () => ({
  fetchUserProgress: vi.fn().mockResolvedValue(null),
  saveUserProgress: vi.fn().mockResolvedValue(true),
  flushLessonProgress: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/components/feature/PodcastEngine', () => ({
  podcastStreamRef: { current: null },
}));

vi.mock('@/lib/api/admin/settings', () => ({
  fetchPlatformSettings: vi.fn(),
}));

describe('LessonPlayer Ad Logic', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (usePlayerStore as any).mockReturnValue({
      playTrack: vi.fn(),
      isPodcastMode: false,
      closePlayer: vi.fn(),
      track: null,
      lastKnownTime: 0,
      setPlaybackProgress: vi.fn(),
    });
    // El componente lee el store con getState() al desmontarse para saber si la
    // lección se estaba escuchando en modo podcast.
    (usePlayerStore as any).getState = vi.fn(() => ({ isPodcastMode: false, track: null }));

    // Default settings
    (fetchPlatformSettings as any).mockResolvedValue({
      free_ad_type: 'both',
      free_ad_frequency_seconds: 120,
      free_ads_per_block: 1,
    });
  });

  it('bypasses ads for premium users', async () => {
    render(
      <LessonPlayer 
        videoSrc="test-video-id" 
        isPremium={true} 
        lesson={{ id: '1', titulo: 'Test', modId: 'm1' }} 
      />
    );

    // Wait for settings to fetch
    await waitFor(() => {
      expect(fetchPlatformSettings).toHaveBeenCalled();
    });

    // Click play (which starts the player)
    const playButton = screen.getByTestId('main-play-button');
    fireEvent.click(playButton);

    // Ensure that it does NOT show an ad
    expect(screen.queryByTestId('ad-overlay')).toBeNull();
    
    // Ensure the main stream is playing
    expect(screen.getByTestId('cloudflare-stream')).toBeTruthy();
  });

  it('shows preroll ad for free users', async () => {
    render(
      <LessonPlayer 
        videoSrc="test-video-id" 
        isPremium={false} 
        lesson={{ id: '1', titulo: 'Test', modId: 'm1' }} 
      />
    );

    await waitFor(() => {
      expect(fetchPlatformSettings).toHaveBeenCalled();
    });

    // Click play
    const playButton = screen.getByTestId('main-play-button');
    fireEvent.click(playButton);

    // Ensure it shows an ad
    expect(screen.getByTestId('ad-overlay')).toBeTruthy();
  });
});

describe('LessonPlayer podcast progress persistence', () => {
  const lesson = { id: 'lesson-1', titulo: 'Test', modId: 'm1' };

  beforeEach(() => {
    vi.clearAllMocks();
    podcastStreamRef.current = null;
    localStreamState.currentTime = 0;
    localStreamState.duration = 100;
    (fetchPlatformSettings as any).mockResolvedValue({
      free_ad_type: 'both',
      free_ad_frequency_seconds: 120,
      free_ads_per_block: 1,
    });
    (usePlayerStore as any).getState = vi.fn(() => ({ isPodcastMode: false, track: null }));
  });

  const renderPlayer = () =>
    render(
      <LessonPlayer videoSrc="test-video-id" isPremium lesson={lesson} moduleTitle="Módulo 1" />
    );

  it('saves the exact minute when switching from video to podcast mode', async () => {
    const playTrack = vi.fn();
    (usePlayerStore as any).mockReturnValue({
      playTrack,
      isPodcastMode: false,
      closePlayer: vi.fn(),
      track: null,
      lastKnownTime: 0,
      setPlaybackProgress: vi.fn(),
    });

    renderPlayer();
    await waitFor(() => expect(fetchPlatformSettings).toHaveBeenCalled());

    // Arrancar el video para que exista el <Stream> local, y posicionarlo
    fireEvent.click(screen.getByTestId('main-play-button'));
    await waitFor(() => expect(screen.getByTestId('cloudflare-stream')).toBeTruthy());
    localStreamState.currentTime = 42;

    fireEvent.click(screen.getByTestId('podcast-toggle'));

    // El minuto viaja al motor de podcast Y queda persistido
    expect(playTrack).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'lesson-1', videoId: 'test-video-id' }),
      42
    );
    expect(flushLessonProgress).toHaveBeenCalledWith('lesson-1', 42, 100);
  });

  it('saves the exact minute when switching back from podcast to video', async () => {
    const closePlayer = vi.fn();
    podcastStreamRef.current = { currentTime: 77, duration: 100, play: vi.fn(), pause: vi.fn() };
    (usePlayerStore as any).mockReturnValue({
      playTrack: vi.fn(),
      isPodcastMode: true,
      closePlayer,
      track: { id: 'lesson-1', videoId: 'test-video-id', title: 'Test', moduleTitle: 'Módulo 1' },
      lastKnownTime: 77,
      setPlaybackProgress: vi.fn(),
    });

    renderPlayer();
    await waitFor(() => expect(fetchPlatformSettings).toHaveBeenCalled());

    fireEvent.click(screen.getByTestId('podcast-toggle'));

    expect(closePlayer).toHaveBeenCalled();
    // Toma el tiempo del engine, no del <Stream> local (que está desmontado)
    expect(flushLessonProgress).toHaveBeenCalledWith('lesson-1', 77, 100);
  });

  it('saves progress from the podcast engine when leaving the lesson while listening', async () => {
    podcastStreamRef.current = { currentTime: 55, duration: 100, play: vi.fn(), pause: vi.fn() };
    (usePlayerStore as any).mockReturnValue({
      playTrack: vi.fn(),
      isPodcastMode: true,
      closePlayer: vi.fn(),
      track: { id: 'lesson-1', videoId: 'test-video-id', title: 'Test', moduleTitle: 'Módulo 1' },
      lastKnownTime: 55,
      setPlaybackProgress: vi.fn(),
    });
    (usePlayerStore as any).getState = vi.fn(() => ({
      isPodcastMode: true,
      track: { id: 'lesson-1', videoId: 'test-video-id' },
    }));

    const { unmount } = renderPlayer();
    await waitFor(() => expect(fetchPlatformSettings).toHaveBeenCalled());

    unmount();

    expect(flushLessonProgress).toHaveBeenCalledWith('lesson-1', 55, 100);
  });
});
