import { useEffect, useLayoutEffect } from "react";
import { useEffectiveTheme } from "@/hooks/useTheme";
import { usePreferencesStore } from "@/stores/preferences.store";
import { PREFERENCES_STORAGE_KEY, applyTheme } from "@/lib/theme";

// Refleja el tema efectivo en <html>. No envuelve nada ni renderiza nada: el
// cambio de tema son variables CSS y atributos, nunca un remontaje.
const ThemeSync = () => {
  const theme = useEffectiveTheme();

  useLayoutEffect(() => {
    applyTheme(theme);
  }, [theme]);

  // Otra pestaña cambió las preferencias: se releen del storage. Rehidratar
  // vuelve a escribir el mismo valor, que no dispara un nuevo evento (sin loops).
  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key !== null && event.key !== PREFERENCES_STORAGE_KEY) return;
      void usePreferencesStore.persist.rehydrate();
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  return null;
};

export default ThemeSync;
