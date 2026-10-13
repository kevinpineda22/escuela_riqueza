import { afterEach, describe, expect, it } from "vitest";
import { DEFAULT_LIVE_LATENCY_MODE, usePreferencesStore } from "@/stores/preferences.store";
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
      liveLatencyMode: DEFAULT_LIVE_LATENCY_MODE,
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
      liveLatencyMode: DEFAULT_LIVE_LATENCY_MODE,
      themePreference: "system",
    });
  });

  it("cambiar el tema no toca las animaciones", () => {
    store().setAnimationsEnabled(false);
    store().setThemePreference("light");

    expect(store().animationsEnabled).toBe(false);
  });
});

describe("preferencias: modo de clase del player", () => {
  afterEach(() => {
    localStorage.clear();
    usePreferencesStore.setState({ liveLatencyMode: DEFAULT_LIVE_LATENCY_MODE });
  });

  it("un store nuevo, sin nada guardado, arranca en Clase completa (dvr)", async () => {
    expect(usePreferencesStore.getInitialState().liveLatencyMode).toBe("dvr");

    localStorage.clear();
    usePreferencesStore.setState(usePreferencesStore.getInitialState());
    await usePreferencesStore.persist.rehydrate();

    expect(store().liveLatencyMode).toBe("dvr");
  });

  it("un modo guardado inválido cae al default", async () => {
    for (const invalid of ["foo", null]) {
      await rehydrateFrom({ liveLatencyMode: invalid });
      expect(store().liveLatencyMode).toBe("dvr");
    }
  });

  it("un registro sin modo guardado usa el default", async () => {
    await rehydrateFrom({ animationsEnabled: false });
    expect(store().liveLatencyMode).toBe("dvr");
  });

  it("un modo guardado válido se respeta, incluido smooth", async () => {
    await rehydrateFrom({ liveLatencyMode: "smooth" });
    expect(store().liveLatencyMode).toBe("smooth");

    await rehydrateFrom({ liveLatencyMode: "low" });
    expect(store().liveLatencyMode).toBe("low");
  });
});
