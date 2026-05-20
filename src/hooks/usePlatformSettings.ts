import { useQuery } from "@tanstack/react-query";
import { fetchPlatformSettings, type PlatformSettings } from "@/lib/api/admin/settings";

/**
 * Hook público para leer ajustes globales de la plataforma.
 * La tabla `platform_settings` tiene RLS de SELECT público, así que se puede
 * llamar desde cualquier componente (autenticado o no).
 *
 * Cache 5 min, no refetch en focus. Cuando admin guarda cambios, invalida
 * manualmente con `queryClient.invalidateQueries({ queryKey: ["platform-settings"] })`.
 */
export function usePlatformSettings() {
  return useQuery<PlatformSettings>({
    queryKey: ["platform-settings"],
    queryFn: fetchPlatformSettings,
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    retry: 1,
  });
}

const CURRENCY_SYMBOLS: Record<PlatformSettings["currency"], string> = {
  USD: "$",
  EUR: "€",
  COP: "$",
  MXN: "$",
};

const CURRENCY_LOCALES: Record<PlatformSettings["currency"], string> = {
  USD: "en-US",
  EUR: "es-ES",
  COP: "es-CO",
  MXN: "es-MX",
};

/**
 * Formatea un monto según la moneda configurada. Devuelve por ejemplo
 * `$19` (USD), `$72.000` (COP), `19 €` (EUR). No incluye el `/mes`.
 */
export function formatPrice(
  amount: number,
  currency: PlatformSettings["currency"] = "USD",
  options: { withCode?: boolean; decimals?: number } = {}
): string {
  const { withCode = false, decimals } = options;
  const locale = CURRENCY_LOCALES[currency] ?? "en-US";
  const symbol = CURRENCY_SYMBOLS[currency] ?? "$";
  const formatted = new Intl.NumberFormat(locale, {
    minimumFractionDigits: decimals ?? 0,
    maximumFractionDigits: decimals ?? 0,
  }).format(amount);
  const base = `${symbol}${formatted}`;
  return withCode ? `${base} ${currency}` : base;
}
