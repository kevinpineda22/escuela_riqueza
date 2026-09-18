import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useEffectiveTheme } from "@/hooks/useTheme";
import { usePreferencesStore } from "@/stores/preferences.store";

// matchMedia controlable: permite simular que el SO cambia de esquema.
function installSystemScheme(initialLight: boolean) {
  let light = initialLight;
  const listeners = new Set<() => void>();
  const add = vi.fn((_: string, cb: () => void) => listeners.add(cb));
  const remove = vi.fn((_: string, cb: () => void) => listeners.delete(cb));

  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    writable: true,
    value: (query: string) => ({
      get matches() {
        return query === "(prefers-color-scheme: light)" && light;
      },
      media: query,
      addEventListener: add,
      removeEventListener: remove,
    }),
  });

  return {
    add,
    listenerCount: () => listeners.size,
    set(next: boolean) {
      light = next;
      listeners.forEach((cb) => cb());
    },
  };
}

describe("useEffectiveTheme", () => {
  beforeEach(() => {
    usePreferencesStore.setState({ themePreference: "dark" });
  });

  afterEach(() => {
    localStorage.clear();
    delete document.documentElement.dataset.themeLock;
  });

  it("con Sistema sigue al SO en vivo", () => {
    const system = installSystemScheme(false);
    usePreferencesStore.setState({ themePreference: "system" });
    const { result } = renderHook(() => useEffectiveTheme());

    expect(result.current).toBe("dark");
    act(() => system.set(true));
    expect(result.current).toBe("light");
    act(() => system.set(false));
    expect(result.current).toBe("dark");
  });

  it("con una elección explícita ignora al SO y no lo escucha", () => {
    const system = installSystemScheme(true);
    usePreferencesStore.setState({ themePreference: "dark" });
    const { result } = renderHook(() => useEffectiveTheme());

    expect(result.current).toBe("dark");
    expect(system.add).not.toHaveBeenCalled();
    act(() => system.set(false));
    expect(result.current).toBe("dark");
  });

  it("deja de escuchar al SO al pasar de Sistema a una elección explícita", () => {
    const system = installSystemScheme(true);
    usePreferencesStore.setState({ themePreference: "system" });
    const { result, unmount } = renderHook(() => useEffectiveTheme());

    expect(result.current).toBe("light");
    expect(system.listenerCount()).toBe(1);

    act(() => usePreferencesStore.setState({ themePreference: "dark" }));
    expect(result.current).toBe("dark");
    expect(system.listenerCount()).toBe(0);

    unmount();
    expect(system.listenerCount()).toBe(0);
  });

  it("el bloqueo de reversión fija oscuro aunque la preferencia sea claro", () => {
    installSystemScheme(true);
    document.documentElement.dataset.themeLock = "dark";
    usePreferencesStore.setState({ themePreference: "light" });
    const { result } = renderHook(() => useEffectiveTheme());

    expect(result.current).toBe("dark");
  });
});
