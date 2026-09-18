import { afterEach, describe, expect, it } from "vitest";
import { usePreferencesStore } from "@/stores/preferences.store";
import { PREFERENCES_STORAGE_KEY } from "@/lib/theme";

const store = () => usePreferencesStore.getState();

const rehydrateFrom = async (state: Record<string, unknown>) => {
  localStorage.setItem(PREFERENCES_STORAGE_KEY, JSON.stringify({ state, version: 0 }));
  await usePreferencesStore.persist.rehydrate();
};

describe("preferencias: tema", () => {
  afterEach(() => {
    localStorage.clear();
    usePreferencesStore.setState({
      animationsEnabled: true,
      liveLatencyMode: "smooth",
      themePreference: "dark",
    });
  });

  it("arranca en oscuro", () => {
    expect(store().themePreference).toBe("dark");
  });

  it("registro viejo sin tema conserva animaciones y latencia, y cae a oscuro", async () => {
    await rehydrateFrom({ animationsEnabled: false, liveLatencyMode: "low" });

    expect(store().animationsEnabled).toBe(false);
    expect(store().liveLatencyMode).toBe("low");
    expect(store().themePreference).toBe("dark");
  });

  it("un tema desconocido guardado cae a oscuro sin perder el resto", async () => {
    await rehydrateFrom({ animationsEnabled: false, themePreference: "sepia" });

    expect(store().themePreference).toBe("dark");
    expect(store().animationsEnabled).toBe(false);
  });

  it("persiste el tema junto a las demás preferencias", () => {
    store().setThemePreference("system");

    const saved = JSON.parse(localStorage.getItem(PREFERENCES_STORAGE_KEY) ?? "{}");
    expect(saved.state).toEqual({
      animationsEnabled: true,
      liveLatencyMode: "smooth",
      themePreference: "system",
    });
  });

  it("cambiar el tema no toca las animaciones", () => {
    store().setAnimationsEnabled(false);
    store().setThemePreference("light");

    expect(store().animationsEnabled).toBe(false);
  });
});
