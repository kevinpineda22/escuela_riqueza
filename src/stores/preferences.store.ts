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
  // Modo de clase del player de lives. "smooth" (default, "Clase normal ·
  // Fluidez"): 3 segmentos del filo, playlist de tamaño fijo (~5 KB), HLS
  // estándar: el más estable para clases de 3-4 h. "dvr" ("Clase completa"):
  // ventana DVR con timeline y retroceso, pero su playlist crece con la clase
  // (~180 KB a las 3 h 40, medido 2026-09-23) y Cloudflare advierte
  // degradación pasadas 3 h y un tope de 7.200 segmentos (4 h con keyframe de
  // 2 s). "low": LL-HLS, ~3 s del filo, requiere red estable.
  // El default solo alcanza a quien no tiene un valor guardado: `merge`
  // conserva cualquier modo persistido. La migración a versión 1 lleva a todos
  // a "smooth" una vez (2026-10-16): el modo se persistía aunque el alumno
  // nunca lo hubiera elegido (bastaba cambiar el tema), así que un valor
  // guardado anterior no expresa una elección.
  liveLatencyMode: LiveLatencyMode;
  setLiveLatencyMode: (mode: LiveLatencyMode) => void;
  // Apariencia local del navegador. "system" es una preferencia, no un tercer
  // tema: se resuelve a claro/oscuro en src/lib/theme.ts.
  themePreference: ThemePreference;
  setThemePreference: (preference: ThemePreference) => void;
}

export const DEFAULT_LIVE_LATENCY_MODE: LiveLatencyMode = "smooth";

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
      // v1 (2026-10-16): todos pasan una vez al modo más estable (ver arriba).
      version: 1,
      migrate: (persisted, version) => {
        // Puede venir incompleto o dañado: `merge` completa y valida cada campo después.
        const stored = (persisted ?? {}) as Pick<PreferencesState, "animationsEnabled" | "liveLatencyMode" | "themePreference">;
        return version < 1 ? { ...stored, liveLatencyMode: DEFAULT_LIVE_LATENCY_MODE } : stored;
      },
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
