import { create } from "zustand";
import { persist } from "zustand/middleware";

interface PreferencesState {
  animationsEnabled: boolean;
  toggleAnimations: () => void;
  setAnimationsEnabled: (enabled: boolean) => void;
}

export const usePreferencesStore = create<PreferencesState>()(
  persist(
    (set) => ({
      animationsEnabled: true,
      toggleAnimations: () =>
        set((state) => ({ animationsEnabled: !state.animationsEnabled })),
      setAnimationsEnabled: (enabled) => set({ animationsEnabled: enabled }),
    }),
    {
      name: "escuela-riqueza-preferences",
      partialize: (state) => ({ animationsEnabled: state.animationsEnabled }),
    }
  )
);
