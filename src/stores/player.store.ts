import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface PodcastTrack {
  id: string | number;
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
  /** La pista llegó al final. Efímero: no se persiste. */
  hasEnded: boolean;
  playTrack: (track: PodcastTrack, startTime?: number) => void;
  setIsPlaying: (playing: boolean) => void;
  setHasEnded: (ended: boolean) => void;
  togglePodcastMode: () => void;
  setVolume: (volume: number) => void;
  setPlaybackProgress: (videoId: string, time: number) => void;
  setLastKnownTime: (time: number) => void;
  setLastVideoId: (videoId: string | null) => void;
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
      hasEnded: false,
      playTrack: (track, startTime = 0) => set({ track, isPlaying: true, isPodcastMode: true, lastKnownTime: startTime, lastVideoId: track.videoId, hasEnded: false }),
      // Reanudar limpia el estado de "completada": el usuario está escuchando de nuevo.
      setIsPlaying: (isPlaying) => set(isPlaying ? { isPlaying, hasEnded: false } : { isPlaying }),
      setHasEnded: (hasEnded) => set({ hasEnded }),
      togglePodcastMode: () => set((state) => ({ isPodcastMode: !state.isPodcastMode })),
      setVolume: (volume) => set({ volume }),
      setPlaybackProgress: (videoId, time) => set({ lastVideoId: videoId, lastKnownTime: time }),
      setLastKnownTime: (time) => set({ lastKnownTime: time }),
      setLastVideoId: (videoId) => set({ lastVideoId: videoId }),
      closePlayer: () => set({ track: null, isPodcastMode: false, isPlaying: false, hasEnded: false }),
      clearPlayer: () => set({ track: null, isPlaying: false, isPodcastMode: false, hasEnded: false }),
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