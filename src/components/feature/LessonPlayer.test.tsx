import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import LessonPlayer from './LessonPlayer';
import { usePlayerStore } from '@/stores/player.store';
import { fetchPlatformSettings } from '@/lib/api/admin/settings';

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
        currentTime: 0,
        duration: 100,
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

    // Ensure that it does NOT show an ad (Ad has text "Publicidad de Aliado")
    expect(screen.queryByText(/Publicidad de Aliado/i)).toBeNull();
    
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
    expect(screen.getByText(/Publicidad de Aliado/i)).toBeTruthy();
  });
});
