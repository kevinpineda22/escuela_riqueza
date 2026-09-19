import { renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { useThemedLogo } from "@/hooks/useThemedLogo";
import { usePreferencesStore } from "@/stores/preferences.store";
import { BRAND_LOGO, BRAND_LOGO_LIGHT, OFFICIAL_LOGO_URLS } from "@/lib/brand";

const CUSTOM_LOGO = "https://imagedelivery.net/otro-hash/otro-id/public";

describe("useThemedLogo", () => {
  afterEach(() => {
    usePreferencesStore.setState({ themePreference: "dark" });
  });

  it("en claro, el logo oficial pasa a la variante de lettering negro sin placa", () => {
    usePreferencesStore.setState({ themePreference: "light" });
    const { result } = renderHook(() => useThemedLogo(BRAND_LOGO));

    expect(result.current).toEqual({ src: BRAND_LOGO_LIGHT, needsPlate: false });
  });

  it("toda copia conocida del logo oficial (p. ej. la subida desde Ajustes) usa la variante clara", () => {
    usePreferencesStore.setState({ themePreference: "light" });
    for (const official of OFFICIAL_LOGO_URLS) {
      const { result } = renderHook(() => useThemedLogo(official));
      expect(result.current).toEqual({ src: BRAND_LOGO_LIGHT, needsPlate: false });
    }
  });

  it("en oscuro, el logo oficial queda igual", () => {
    usePreferencesStore.setState({ themePreference: "dark" });
    const { result } = renderHook(() => useThemedLogo(BRAND_LOGO));

    expect(result.current).toEqual({ src: BRAND_LOGO, needsPlate: false });
  });

  it("un logo personalizado no tiene variante clara: se conserva y pide placa", () => {
    usePreferencesStore.setState({ themePreference: "light" });
    const { result } = renderHook(() => useThemedLogo(CUSTOM_LOGO));

    expect(result.current).toEqual({ src: CUSTOM_LOGO, needsPlate: true });
  });
});
