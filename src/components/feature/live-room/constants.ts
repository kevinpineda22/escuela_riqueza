// Customer code del subdominio "customer-XXX.cloudflarestream.com": arma el
// manifest HLS del en vivo y el iframe de las grabaciones de Stream.
export const CF_CUSTOMER_CODE =
  (import.meta.env.VITE_CLOUDFLARE_STREAM_CUSTOMER_SUBDOMAIN || "").match(/customer-([^.]+)/)?.[1] || "";

export const CF_CUSTOMER_HOST = CF_CUSTOMER_CODE ? `customer-${CF_CUSTOMER_CODE}.cloudflarestream.com` : "";

export const LIVE_LOGO_URL =
  "https://imagedelivery.net/HGkLNfdVjFNAti8ZHHgxtQ/18dc9190-6625-4b89-8f1e-3f221e96b500/public";
