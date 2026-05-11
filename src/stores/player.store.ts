import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface PodcastTrack {
  id: number;
  title: string;
  moduleTitle: string;
  videoId: string;
  duration?: string;
}

interface PlayerStore {
  track: PodcastTrack | null;
  isPlaying: boolean;
  isPodcastMode: boolean;
  volume: number;
  lastKnownTime: number;
  lastVideoId: string | null;
  playTrack: (track: PodcastTrack, startTime?: number) => void;
  setIsPlaying: (playing: boolean) => void;
  togglePodcastMode: () => void;
  setVolume: (volume: number) => void;
  setPlaybackProgress: (videoId: string, time: number) => void;
  closePlayer: () => void;
  clearPlayer: () => void; // Use when auth changes to force hide
}

export const usePlayerStore = create<PlayerStore>()(
  persist(
    (set) => ({
      track: null,
      isPlaying: false,
      isPodcastMode: false,
      volume: 1,
      lastKnownTime: 0,
      lastVideoId: null,
      playTrack: (track, startTime = 0) => set({ track, isPlaying: true, isPodcastMode: true, lastKnownTime: startTime, lastVideoId: track.videoId }),
      setIsPlaying: (isPlaying) => set({ isPlaying }),
      togglePodcastMode: () => set((state) => ({ isPodcastMode: !state.isPodcastMode })),
      setVolume: (volume) => set({ volume }),
      setPlaybackProgress: (videoId, time) => set({ lastVideoId: videoId, lastKnownTime: time }),
      closePlayer: () => set({ track: null, isPodcastMode: false, isPlaying: false }),
      clearPlayer: () => set({ track: null, isPlaying: false, isPodcastMode: false }),
    }),
    {
      name: 'escuela-riqueza-player',
      partialize: (state) => ({ 
        track: state.track, 
        isPodcastMode: state.isPodcastMode, 
        volume: state.volume,
        lastKnownTime: state.lastKnownTime,
        lastVideoId: state.lastVideoId
      }), // No persistimos isPlaying para no violar las políticas de autoplay del navegador al recargar
    }
  )
);