import { Link } from "react-router-dom";
import type { ReactElement } from "react";
import { Shield, Scale, Mail, ArrowUpRight, Sparkles } from "lucide-react";
import AnimationToggle from "@/components/feature/AnimationToggle";
import { usePlatformSettings } from "@/hooks/usePlatformSettings";

const LOGO_FALLBACK =
  "https://imagedelivery.net/HGkLNfdVjFNAti8ZHHgxtQ/18dc9190-6625-4b89-8f1e-3f221e96b500/public";

// Defaults usados mientras platform_settings carga o si una columna queda vacía.
const FALLBACK = {
  platform_name: "Escuela de la Riqueza",
  support_email: "escueladelariquezaweb@gmail.com",
  footer_tagline: "El conocimiento es la moneda definitiva.",
  instagram_url: "https://www.instagram.com/escueladelariqueza/",
  youtube_url: "https://www.youtube.com/@EscuelaDeLaRiqueza",
  facebook_url: "https://web.facebook.com/EscuelaDeLaRiqueza/",
  tiktok_url: null as string | null,
  whatsapp_number: "+573122975931",
};

// SVG inline para redes sociales (lucide-react de esta versión no los incluye)
const IgIcon = ({ size = 16 }: { size?: number }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
    <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
    <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
  </svg>
);

const YtIcon = ({ size = 16 }: { size?: number }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M22.54 6.42a2.78 2.78 0 0 0-1.94-2C18.88 4 12 4 12 4s-6.88 0-8.6.46a2.78 2.78 0 0 0-1.94 2A29 29 0 0 0 1 11.75a29 29 0 0 0 .46 5.33A2.78 2.78 0 0 0 3.4 19c1.72.46 8.6.46 8.6.46s6.88 0 8.6-.46a2.78 2.78 0 0 0 1.94-2 29 29 0 0 0 .46-5.25 29 29 0 0 0-.46-5.33z" />
    <polygon points="9.75 15.02 15.5 11.75 9.75 8.48 9.75 15.02" />
  </svg>
);

const FbIcon = ({ size = 16 }: { size?: number }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" />
  </svg>
);

const WaIcon = ({ size = 16 }: { size?: number }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
  </svg>
);

const TkIcon = ({ size = 16 }: { size?: number }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
    <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5.8 20.1a6.34 6.34 0 0 0 10.86-4.43V8.74a8.31 8.31 0 0 0 4.83 1.55V6.84a4.85 4.85 0 0 1-1.9-.15z" />
  </svg>
);

interface FooterColumn {
  title: string;
  links: { label: string; href: string; external?: boolean; icon?: typeof Mail }[];
}

// Convierte un número de WhatsApp (con o sin +) en URL wa.me
const toWaHref = (raw: string) => {
  const digits = raw.replace(/[^\d]/g, "");
  return `https://wa.me/${digits}`;
};

const Footer = () => {
  const year = new Date().getFullYear();
  const { data } = usePlatformSettings();

  const s = {
    platform_name: data?.platform_name || FALLBACK.platform_name,
    support_email: data?.support_email || FALLBACK.support_email,
    footer_tagline: data?.footer_tagline || FALLBACK.footer_tagline,
    instagram_url: data?.instagram_url ?? FALLBACK.instagram_url,
    youtube_url: data?.youtube_url ?? FALLBACK.youtube_url,
    facebook_url: data?.facebook_url ?? FALLBACK.facebook_url,
    tiktok_url: data?.tiktok_url ?? FALLBACK.tiktok_url,
    whatsapp_number: data?.whatsapp_number ?? FALLBACK.whatsapp_number,
    logo_url: data?.logo_url || LOGO_FALLBACK,
  };

  const columns: FooterColumn[] = [
    {
      title: "Plataforma",
      links: [
        { label: "Nuestra historia", href: "/historia" },
        { label: "Tu camino", href: "/#camino" },
        { label: "Planes y precios", href: "/planes#planes" },
      ],
    },
    {
      title: "Ayuda",
      links: [
        { label: "Soporte técnico", href: "/dashboard" },
        { label: "Preguntas frecuentes", href: "/planes#faq" },
        { label: "Contacto", href: `mailto:${s.support_email}`, icon: Mail, external: true },
      ],
    },
    {
      title: "Legal",
      links: [
        { label: "Términos de servicio", href: "/terminos", icon: Scale },
        { label: "Política de privacidad", href: "/privacidad", icon: Shield },
      ],
    },
  ];

  const socials: { label: string; href: string; Icon: (p: { size?: number }) => ReactElement }[] = [];
  if (s.instagram_url) socials.push({ label: "Instagram", href: s.instagram_url, Icon: IgIcon });
  if (s.youtube_url) socials.push({ label: "YouTube", href: s.youtube_url, Icon: YtIcon });
  if (s.facebook_url) socials.push({ label: "Facebook", href: s.facebook_url, Icon: FbIcon });
  if (s.tiktok_url) socials.push({ label: "TikTok", href: s.tiktok_url, Icon: TkIcon });
  if (s.whatsapp_number)
    socials.push({ label: "WhatsApp", href: toWaHref(s.whatsapp_number), Icon: WaIcon });

  // Separa el tagline en "antes" + "frase destacada" + "."
  // Heurística simple: si contiene "moneda definitiva" lo resaltamos; sino mostramos plano.
  const renderTagline = () => {
    const t = s.footer_tagline;
    const accent = "moneda definitiva";
    const idx = t.toLowerCase().indexOf(accent);
    if (idx === -1) {
      return <span>{t}</span>;
    }
    const before = t.slice(0, idx);
    const match = t.slice(idx, idx + accent.length);
    const after = t.slice(idx + accent.length);
    return (
      <>
        {before}
        <span className="text-transparent bg-clip-text bg-gradient-to-r from-gold via-amber-100 to-goldHover italic">
          {match}
        </span>
        {after}
      </>
    );
  };

  return (
    <footer className="relative bg-darker border-t border-white/5 mt-16 sm:mt-24 overflow-hidden">
      {/* Línea dorada superior decorativa */}
      <div
        aria-hidden
        className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-gold/40 to-transparent"
      />
      {/* Glow ambiental — solo desktop */}
      <div
        aria-hidden
        className="hidden md:block absolute -top-40 left-1/2 -translate-x-1/2 w-[640px] h-[200px] bg-[radial-gradient(ellipse_at_center,rgba(204,164,59,0.12),transparent_70%)] pointer-events-none"
      />

      {/* Tagline cinemático */}
      <div className="relative max-w-7xl mx-auto px-5 sm:px-6 pt-12 sm:pt-16 pb-8 sm:pb-10 text-center">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-gold/5 border border-gold/20 mb-5">
          <Sparkles size={12} className="text-gold" />
          <span className="text-[10px] uppercase tracking-[0.3em] font-bold text-gold/80">
            {s.platform_name}
          </span>
        </div>
        <p className="text-lg sm:text-2xl md:text-3xl font-extrabold text-white tracking-tight leading-tight max-w-2xl mx-auto text-balance">
          {renderTagline()}
        </p>
      </div>

      {/* Separador sutil */}
      <div className="relative max-w-7xl mx-auto px-5 sm:px-6">
        <div className="h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
      </div>

      {/* Contenido principal — 4 columnas */}
      <div className="relative max-w-7xl mx-auto px-5 sm:px-6 py-10 sm:py-14 grid grid-cols-2 md:grid-cols-12 gap-x-6 gap-y-10">
        {/* Brand (mobile: full width, md: 5/12) */}
        <div className="col-span-2 md:col-span-5">
          <Link to="/" className="inline-block mb-4 group">
            <img
              src={s.logo_url}
              alt={s.platform_name}
              className="h-12 sm:h-14 w-auto object-contain opacity-90 group-hover:opacity-100 transition-opacity drop-shadow-[0_0_18px_rgba(204,164,59,0.25)]"
            />
          </Link>
          <p className="text-textMuted text-sm leading-relaxed max-w-sm">
            Una escuela de rediseño cerebral para emprendedores. Aprende, practica y transforma —
            de la mano de Iván Mazo.
          </p>

          {/* Sociales */}
          {socials.length > 0 && (
            <div className="mt-6 flex items-center gap-2 flex-wrap">
              {socials.map(({ label, href, Icon }) => (
                <a
                  key={label}
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={label}
                  className="w-10 h-10 rounded-full bg-white/[0.04] border border-white/10 hover:border-gold/40 hover:bg-gold/10 text-white/60 hover:text-gold flex items-center justify-center transition-all hover:-translate-y-0.5"
                >
                  <Icon size={16} />
                </a>
              ))}
            </div>
          )}
        </div>

        {/* Columnas */}
        {columns.map((col) => (
          <div key={col.title} className="md:col-span-2 lg:col-span-2">
            <h4 className="text-white font-semibold mb-4 text-sm tracking-wide flex items-center gap-2">
              {col.title}
              <span className="flex-1 h-px bg-gradient-to-r from-gold/30 to-transparent" />
            </h4>
            <ul className="space-y-2.5 text-sm">
              {col.links.map((link) => {
                const Icon = link.icon;
                const isHashOrPath = link.href.startsWith("/") && !link.href.startsWith("/#");
                return (
                  <li key={link.label}>
                    {link.external ? (
                      <a
                        href={link.href}
                        className="text-textMuted hover:text-gold transition-colors inline-flex items-center gap-1.5 group"
                      >
                        {Icon && <Icon size={13} className="opacity-70 group-hover:opacity-100" />}
                        <span className="border-b border-transparent group-hover:border-gold/40 transition-colors">
                          {link.label}
                        </span>
                        <ArrowUpRight size={12} className="opacity-0 group-hover:opacity-60 transition-opacity" />
                      </a>
                    ) : isHashOrPath ? (
                      <Link
                        to={link.href}
                        className="text-textMuted hover:text-gold transition-colors inline-flex items-center gap-1.5 group"
                      >
                        {Icon && <Icon size={13} className="opacity-70 group-hover:opacity-100" />}
                        <span className="border-b border-transparent group-hover:border-gold/40 transition-colors">
                          {link.label}
                        </span>
                      </Link>
                    ) : (
                      <a
                        href={link.href}
                        className="text-textMuted hover:text-gold transition-colors inline-flex items-center gap-1.5 group"
                      >
                        {Icon && <Icon size={13} className="opacity-70 group-hover:opacity-100" />}
                        <span className="border-b border-transparent group-hover:border-gold/40 transition-colors">
                          {link.label}
                        </span>
                      </a>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        ))}

        {/* Filler en lg para alinear */}
        <div className="hidden lg:block lg:col-span-1" />
      </div>

      {/* Barra inferior */}
      <div className="relative border-t border-white/5">
        <div className="max-w-7xl mx-auto px-5 sm:px-6 py-5 flex flex-col-reverse sm:flex-row items-center justify-between gap-4 text-xs text-textMuted">
          <span className="text-center sm:text-left">
            © {year} {s.platform_name} · Todos los derechos reservados.
          </span>
          <div className="flex items-center gap-4">
            <AnimationToggle variant="labeled" />
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
