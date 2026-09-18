import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
  DEFAULT_THEME_PREFERENCE,
  PREFERENCES_STORAGE_KEY,
  parseThemePreference,
  type ThemePreference,
} from "@/lib/theme";

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
  // Apariencia local del navegador. "system" es una preferencia, no un tercer
  // tema: se resuelve a claro/oscuro en src/lib/theme.ts.
  themePreference: ThemePreference;
  setThemePreference: (preference: ThemePreference) => void;
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
      themePreference: DEFAULT_THEME_PREFERENCE,
      setThemePreference: (preference) =>
        set({ themePreference: parseThemePreference(preference) }),
    }),
    {
      name: PREFERENCES_STORAGE_KEY,
      partialize: (state) => ({
        animationsEnabled: state.animationsEnabled,
        liveLatencyMode: state.liveLatencyMode,
        themePreference: state.themePreference,
      }),
      // Registros anteriores al tema no traen themePreference; uno dañado puede
      // traer cualquier cosa. Ambos caen a oscuro sin perder el resto.
      merge: (persisted, current) => {
        const stored = (persisted ?? {}) as Partial<PreferencesState>;
        return {
          ...current,
          ...stored,
          themePreference: parseThemePreference(stored.themePreference),
        };
      },
    }
  )
);
