import { useEffectiveTheme } from "@/hooks/useTheme";
import { BRAND_LOGO_LIGHT, OFFICIAL_LOGO_URLS } from "@/lib/brand";

// Logo según el tema. Solo el logo oficial tiene variante clara: uno distinto
// cargado desde Ajustes no la tiene, y en claro necesita la placa oscura (needsPlate)
// para que su lettering blanco no desaparezca sobre marfil.
export function useThemedLogo(src: string) {
  const theme = useEffectiveTheme();
  const hasLightVariant = OFFICIAL_LOGO_URLS.has(src);

  return {
    src: theme === "light" && hasLightVariant ? BRAND_LOGO_LIGHT : src,
    needsPlate: !hasLightVariant,
  };
}
