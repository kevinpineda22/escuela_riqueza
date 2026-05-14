import { Link } from "react-router-dom";
import { Shield, Scale, Mail, ArrowUpRight, Sparkles } from "lucide-react";
import AnimationToggle from "@/components/feature/AnimationToggle";

const LOGO_URL =
  "https://imagedelivery.net/HGkLNfdVjFNAti8ZHHgxtQ/18dc9190-6625-4b89-8f1e-3f221e96b500/public";

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

interface FooterColumn {
  title: string;
  links: { label: string; href: string; external?: boolean; icon?: typeof Mail }[];
}

const columns: FooterColumn[] = [
  {
    title: "Plataforma",
    links: [
      { label: "Nuestra historia", href: "/#historia" },
      { label: "Las 6 inteligencias", href: "/#modulos" },
      { label: "Tu camino", href: "/#camino" },
      { label: "Planes y precios", href: "/planes" },
    ],
  },
  {
    title: "Ayuda",
    links: [
      { label: "Soporte técnico", href: "/dashboard" },
      { label: "Preguntas frecuentes", href: "/planes" },
      { label: "Contacto", href: "mailto:soporte@escuelariqueza.com", icon: Mail, external: true },
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

const socials = [
  { label: "Instagram", href: "https://instagram.com/", Icon: IgIcon },
  { label: "YouTube", href: "https://youtube.com/", Icon: YtIcon },
];

const Footer = () => {
  const year = new Date().getFullYear();

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
            Escuela de la Riqueza
          </span>
        </div>
        <p className="text-lg sm:text-2xl md:text-3xl font-extrabold text-white tracking-tight leading-tight max-w-2xl mx-auto text-balance">
          El conocimiento es la{" "}
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-gold via-amber-100 to-goldHover italic">
            moneda definitiva
          </span>
          .
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
              src={LOGO_URL}
              alt="Escuela de la Riqueza"
              className="h-12 sm:h-14 w-auto object-contain opacity-90 group-hover:opacity-100 transition-opacity drop-shadow-[0_0_18px_rgba(204,164,59,0.25)]"
            />
          </Link>
          <p className="text-textMuted text-sm leading-relaxed max-w-sm">
            Una escuela de rediseño cerebral para emprendedores. Aprende, practica y transforma —
            de la mano de Iván Mazo.
          </p>

          {/* Sociales */}
          <div className="mt-6 flex items-center gap-2">
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
            © {year} Escuela de la Riqueza · Todos los derechos reservados.
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
