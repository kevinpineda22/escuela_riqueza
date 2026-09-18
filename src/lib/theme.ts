// Resolución del tema visual (claro/oscuro).
//
// La MISMA política vive en el script inline de index.html, que corre antes del
// primer pintado y no puede importar este módulo. `theme.test.ts` ejecuta ese
// script contra la misma tabla de casos: una regla cambiada aquí se cambia allá.

export type ThemePreference = "dark" | "light" | "system";
export type EffectiveTheme = "dark" | "light";

export const DEFAULT_THEME_PREFERENCE: ThemePreference = "dark";

// Clave del persist de Zustand en preferences.store.ts.
export const PREFERENCES_STORAGE_KEY = "escuela-riqueza-preferences";

export const SYSTEM_LIGHT_QUERY = "(prefers-color-scheme: light)";

// Color de la barra del navegador; espejo de --surface-page en index.css.
export const THEME_COLOR: Record<EffectiveTheme, string> = {
  dark: "#0a0a0a",
  light: "#f8f6f1",
};

export function parseThemePreference(value: unknown): ThemePreference {
  return value === "dark" || value === "light" || value === "system"
    ? value
    : DEFAULT_THEME_PREFERENCE;
}

// Lee la preferencia del JSON que persiste Zustand ({ state, version }).
// Registro viejo sin tema, JSON roto o valor desconocido => oscuro.
export function readStoredThemePreference(raw: string | null): ThemePreference {
  if (!raw) return DEFAULT_THEME_PREFERENCE;
  try {
    const parsed: unknown = JSON.parse(raw);
    const state =
      parsed && typeof parsed === "object"
        ? (parsed as { state?: { themePreference?: unknown } }).state
        : undefined;
    return parseThemePreference(state?.themePreference);
  } catch {
    return DEFAULT_THEME_PREFERENCE;
  }
}

// Interruptor de reversión: <html data-theme-lock="dark"> fija el oscuro sin
// tocar la preferencia guardada de nadie.
export function isThemeLocked(root: HTMLElement = document.documentElement): boolean {
  return root.dataset.themeLock === "dark";
}

export function resolveTheme(
  preference: ThemePreference,
  systemPrefersLight: boolean,
  locked = false
): EffectiveTheme {
  if (locked) return "dark";
  if (preference === "system") return systemPrefersLight ? "light" : "dark";
  return preference;
}

export function applyTheme(
  theme: EffectiveTheme,
  root: HTMLElement = document.documentElement
): void {
  if (root.dataset.theme !== theme) root.dataset.theme = theme;
  root.style.colorScheme = theme;
  const meta = root.ownerDocument.querySelector('meta[name="theme-color"]');
  meta?.setAttribute("content", THEME_COLOR[theme]);
}

// El selector se publica recién cuando TODAS las rutas activas estén adaptadas
// (fase 6 de docs/MODO_CLARO_ESPECIFICACION.md). Hasta entonces solo existe en
// desarrollo: una pantalla clara a medias no se le muestra a nadie.
export const APPEARANCE_SELECTOR_ENABLED = import.meta.env.DEV;
