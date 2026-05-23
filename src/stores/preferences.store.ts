import { create } from "zustand";
import { persist } from "zustand/middleware";

export type LiveLatencyMode = "smooth" | "low";

interface PreferencesState {
  animationsEnabled: boolean;
  toggleAnimations: () => void;
  setAnimationsEnabled: (enabled: boolean) => void;
  // Modo de latencia del player de lives. "smooth" (default): ~6-10s atrás del
  // edge, buffer 20s, ideal para conexiones residenciales/mobile. "low": ~3-5s
  // atrás del edge, buffer 10s, requiere red estable o aparecen latigazos.
  liveLatencyMode: LiveLatencyMode;
  setLiveLatencyMode: (mode: LiveLatencyMode) => void;
}

export const usePreferencesStore = create<PreferencesState>()(
  persist(
    (set) => ({
      animationsEnabled: true,
      toggleAnimations: () =>
        set((state) => ({ animationsEnabled: !state.animationsEnabled })),
      setAnimationsEnabled: (enabled) => set({ animationsEnabled: enabled }),
      liveLatencyMode: "smooth",
      setLiveLatencyMode: (mode) => set({ liveLatencyMode: mode }),
    }),
    {
      name: "escuela-riqueza-preferences",
      partialize: (state) => ({
        animationsEnabled: state.animationsEnabled,
        liveLatencyMode: state.liveLatencyMode,
      }),
    }
  )
);
