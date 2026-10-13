import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
  DEFAULT_THEME_PREFERENCE,
  PREFERENCES_STORAGE_KEY,
  parseThemePreference,
  type ThemePreference,
} from "@/lib/theme";

export type LiveLatencyMode = "smooth" | "low" | "dvr";

interface PreferencesState {
  animationsEnabled: boolean;
  toggleAnimations: () => void;
  setAnimationsEnabled: (enabled: boolean) => void;
  // Modo de clase del player de lives. "dvr" (default, "Clase completa"):
  // ventana DVR de Cloudflare con timeline, retroceso y retomar posición; en
  // producción dio 0 stalls en 50 min (2026-10-10). "smooth" ("Clase normal ·
  // Fluidez"): 3 segmentos del filo, siempre en el directo. "low": LL-HLS,
  // ~3 s del filo, requiere red estable.
  // El default solo alcanza a quien no tiene un valor guardado: `merge`
  // conserva cualquier modo persistido. Un "smooth" guardado no se distingue
  // de uno heredado del default anterior, así que no se migra a escondidas.
  liveLatencyMode: LiveLatencyMode;
  setLiveLatencyMode: (mode: LiveLatencyMode) => void;
  // Apariencia local del navegador. "system" es una preferencia, no un tercer
  // tema: se resuelve a claro/oscuro en src/lib/theme.ts.
  themePreference: ThemePreference;
  setThemePreference: (preference: ThemePreference) => void;
}

export const DEFAULT_LIVE_LATENCY_MODE: LiveLatencyMode = "dvr";

const LIVE_LATENCY_MODES: readonly LiveLatencyMode[] = ["smooth", "low", "dvr"];

export const usePreferencesStore = create<PreferencesState>()(
  persist(
    (set) => ({
      animationsEnabled: true,
      toggleAnimations: () =>
        set((state) => ({ animationsEnabled: !state.animationsEnabled })),
      setAnimationsEnabled: (enabled) => set({ animationsEnabled: enabled }),
      liveLatencyMode: DEFAULT_LIVE_LATENCY_MODE,
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
          // Un valor dañado o desconocido cae al default en vez de llegar al player.
          liveLatencyMode: LIVE_LATENCY_MODES.includes(stored.liveLatencyMode as LiveLatencyMode)
            ? (stored.liveLatencyMode as LiveLatencyMode)
            : current.liveLatencyMode,
        };
      },
    }
  )
);
