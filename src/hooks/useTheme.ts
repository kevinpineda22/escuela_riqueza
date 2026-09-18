import { useCallback, useSyncExternalStore } from "react";
import { usePreferencesStore } from "@/stores/preferences.store";
import {
  SYSTEM_LIGHT_QUERY,
  isThemeLocked,
  resolveTheme,
  type EffectiveTheme,
} from "@/lib/theme";

// Tema efectivo (claro/oscuro). Solo escucha al sistema operativo mientras la
// preferencia es "system"; con una elección explícita no hay listener.
export function useEffectiveTheme(): EffectiveTheme {
  const preference = usePreferencesStore((s) => s.themePreference);
  const followsSystem = preference === "system";

  const subscribe = useCallback(
    (callback: () => void) => {
      if (!followsSystem || typeof window === "undefined") return () => {};
      const mql = window.matchMedia(SYSTEM_LIGHT_QUERY);
      mql.addEventListener("change", callback);
      return () => mql.removeEventListener("change", callback);
    },
    [followsSystem]
  );

  const getSnapshot = (): EffectiveTheme => {
    if (typeof window === "undefined") return "dark";
    const systemPrefersLight =
      followsSystem && window.matchMedia(SYSTEM_LIGHT_QUERY).matches;
    return resolveTheme(preference, systemPrefersLight, isThemeLocked());
  };

  return useSyncExternalStore(subscribe, getSnapshot, () => "dark");
}
