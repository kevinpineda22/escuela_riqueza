import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  PREFERENCES_STORAGE_KEY,
  THEME_COLOR,
  applyTheme,
  readStoredThemePreference,
  resolveTheme,
  type EffectiveTheme,
} from "@/lib/theme";
import indexHtml from "../../index.html?raw";

const persisted = (state: Record<string, unknown>) =>
  JSON.stringify({ state, version: 0 });

// Tabla compartida: el script de index.html y theme.ts deben coincidir en todo.
const cases: Array<{
  name: string;
  raw: string | null;
  systemLight: boolean;
  locked?: boolean;
  expected: EffectiveTheme;
}> = [
  { name: "sin registro", raw: null, systemLight: true, expected: "dark" },
  { name: "registro viejo sin tema", raw: persisted({ animationsEnabled: false }), systemLight: true, expected: "dark" },
  { name: "oscuro explícito", raw: persisted({ themePreference: "dark" }), systemLight: true, expected: "dark" },
  { name: "claro explícito", raw: persisted({ themePreference: "light" }), systemLight: false, expected: "light" },
  { name: "sistema claro", raw: persisted({ themePreference: "system" }), systemLight: true, expected: "light" },
  { name: "sistema oscuro", raw: persisted({ themePreference: "system" }), systemLight: false, expected: "dark" },
  { name: "valor desconocido", raw: persisted({ themePreference: "sepia" }), systemLight: true, expected: "dark" },
  { name: "JSON inválido", raw: "{no-json", systemLight: true, expected: "dark" },
  { name: "JSON que no es objeto", raw: "42", systemLight: true, expected: "dark" },
  { name: "bloqueo de reversión", raw: persisted({ themePreference: "light" }), systemLight: true, locked: true, expected: "dark" },
];

const inlineScript = (() => {
  const match = indexHtml.match(/<script id="theme-init">([\s\S]*?)<\/script>/);
  if (!match) throw new Error("No se encontró <script id=\"theme-init\"> en index.html");
  return match[1];
})();

const mockSystem = (light: boolean) =>
  vi.spyOn(window, "matchMedia").mockImplementation(
    (query: string) =>
      ({
        matches: query === "(prefers-color-scheme: light)" ? light : false,
        media: query,
        addEventListener: () => {},
        removeEventListener: () => {},
      }) as unknown as MediaQueryList
  );

describe("resolución del tema", () => {
  let meta: HTMLMetaElement;

  beforeEach(() => {
    // jsdom no implementa matchMedia; se define para poder espiarlo.
    if (!window.matchMedia) {
      Object.defineProperty(window, "matchMedia", { configurable: true, writable: true, value: () => ({}) });
    }
    meta = document.createElement("meta");
    meta.name = "theme-color";
    document.head.appendChild(meta);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    meta.remove();
    localStorage.clear();
    const root = document.documentElement;
    delete root.dataset.theme;
    delete root.dataset.themeLock;
    root.style.colorScheme = "";
  });

  it.each(cases)("theme.ts: $name → $expected", ({ raw, systemLight, locked, expected }) => {
    expect(resolveTheme(readStoredThemePreference(raw), systemLight, locked)).toBe(expected);
  });

  it.each(cases)("index.html: $name → $expected", ({ raw, systemLight, locked, expected }) => {
    if (raw !== null) localStorage.setItem(PREFERENCES_STORAGE_KEY, raw);
    if (locked) document.documentElement.dataset.themeLock = "dark";
    mockSystem(systemLight);

    new Function(inlineScript)();

    const root = document.documentElement;
    expect(root.dataset.theme).toBe(expected);
    expect(root.style.colorScheme).toBe(expected);
    expect(meta.content).toBe(THEME_COLOR[expected]);
  });

  it("index.html: storage inaccesible cae a oscuro sin lanzar", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new DOMException("bloqueado", "SecurityError");
    });
    mockSystem(true);

    expect(() => new Function(inlineScript)()).not.toThrow();
    expect(document.documentElement.dataset.theme).toBe("dark");
  });

  it("applyTheme escribe atributo, color-scheme y theme-color", () => {
    applyTheme("light");
    const root = document.documentElement;
    expect(root.dataset.theme).toBe("light");
    expect(root.style.colorScheme).toBe("light");
    expect(meta.content).toBe(THEME_COLOR.light);
  });
});
