import { create } from 'zustand';

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
  playTrack: (track: PodcastTrack, startTime?: number) => void;
  setIsPlaying: (playing: boolean) => void;
  togglePodcastMode: () => void;
  setVolume: (volume: number) => void;
  setLastKnownTime: (time: number) => void;
  closePlayer: () => void;
}

export const usePlayerStore = create<PlayerStore>((set) => ({
  track: null,
  isPlaying: false,
  isPodcastMode: false,
  volume: 1,
  lastKnownTime: 0,
  playTrack: (track, startTime = 0) => set({ track, isPlaying: true, isPodcastMode: true, lastKnownTime: startTime }),
  setIsPlaying: (isPlaying) => set({ isPlaying }),
  togglePodcastMode: () => set((state) => ({ isPodcastMode: !state.isPodcastMode })),
  setVolume: (volume) => set({ volume }),
  setLastKnownTime: (time) => set({ lastKnownTime: time }),
  closePlayer: () => set({ track: null, isPodcastMode: false, isPlaying: false }),
}));