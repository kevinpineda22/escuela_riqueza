// Logo oficial con lettering blanco: para fondos oscuros.
export const BRAND_LOGO =
  "https://imagedelivery.net/HGkLNfdVjFNAti8ZHHgxtQ/18dc9190-6625-4b89-8f1e-3f221e96b500/public";

// La misma marca con lettering negro ("LOGO ESCUELA-01.png"): la que va en claro.
export const BRAND_LOGO_LIGHT =
  "https://imagedelivery.net/HGkLNfdVjFNAti8ZHHgxtQ/34057238-d679-4d4e-b56c-cb8da11c9300/public";

// Copias conocidas del logo oficial de lettering blanco: la constante del código
// y la que se subió desde Ajustes (platform_settings.logo_url, mismo archivo con
// otro ID de Cloudflare). Todas tienen a BRAND_LOGO_LIGHT como variante clara.
// Un logo que no esté acá se trata como personalizado: en claro va sobre placa.
export const OFFICIAL_LOGO_URLS: ReadonlySet<string> = new Set([
  BRAND_LOGO,
  "https://imagedelivery.net/HGkLNfdVjFNAti8ZHHgxtQ/100af153-8d64-4940-e737-691570dbb200/public",
]);
