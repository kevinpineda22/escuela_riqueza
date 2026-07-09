import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Link } from "react-router-dom";
import { motion } from "motion/react";
import { ArrowRight, LayoutDashboard } from "lucide-react";
import { useAuthStore } from "@/stores/auth.store";
import { usePlatformSettings } from "@/hooks/usePlatformSettings";
import AnimationToggle from "@/components/feature/AnimationToggle";
import { cn } from "@/lib/utils";

const LOGO_FALLBACK =
  "https://imagedelivery.net/HGkLNfdVjFNAti8ZHHgxtQ/18dc9190-6625-4b89-8f1e-3f221e96b500/public";

/**
 * Header exclusivo de la landing. No es una barra separada: flota transparente
 * sobre el hero (se integra con la aurora) y al scrollear se condensa en una
 * píldora glass. Las demás rutas siguen usando el Header compartido.
 *
 * El fondo glass vive en una capa aparte que se funde por OPACIDAD (no se
 * togglea el borde sobre el contenedor). Así se evita el flash de contorno
 * blanco al volver al top.
 */
const LandingHeader = () => {
  const { user } = useAuthStore();
  const { data: settings } = usePlatformSettings();
  const [scrolled, setScrolled] = useState(false);

  const platformName = settings?.platform_name || "Escuela de la Riqueza";
  const logoUrl = settings?.logo_url || LOGO_FALLBACK;

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return createPortal(
    <>
      {/* Scrim de disolución: al scrollear, funde el contenido que pasa por
          detrás del header para que no se monte texto sobre texto. Al tope está
          invisible, así la aurora del hero queda limpia al cargar. Sin borde
          inferior (funde a transparente) para que se lea como desvanecimiento,
          no como una barra. */}
      <div
        aria-hidden
        className={cn(
          "fixed inset-x-0 top-0 z-40 h-32 md:h-40 bg-gradient-to-b from-darker via-darker/80 to-transparent pointer-events-none transition-opacity duration-500",
          scrolled ? "opacity-100" : "opacity-0"
        )}
      />
      <motion.header
        initial={{ opacity: 0, y: -24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: "easeOut" }}
        className="fixed inset-x-0 top-0 z-50 flex justify-center px-4 py-3 sm:px-6 md:py-4"
      >
      <div className="relative w-full max-w-7xl flex items-center justify-between gap-2 sm:gap-3 px-2 sm:px-4 h-16 sm:h-20 md:h-24">
        {/* Brand */}
        <Link
          to="/"
          className="relative flex items-center shrink-0 group"
          aria-label={`${platformName} — Inicio`}
        >
          <img
            src={logoUrl}
            alt={platformName}
            className="h-12 sm:h-14 md:h-20 w-auto object-contain drop-shadow-[0_0_18px_rgba(204,164,59,0.35)] group-hover:scale-105 transition-transform duration-300"
          />
        </Link>

        {/* Actions */}
        <div className="relative flex items-center gap-1.5 sm:gap-3 md:gap-4">
          <AnimationToggle />

          {user ? (
            <Link
              to="/dashboard?tab=modulos"
              className="group relative inline-flex items-center gap-2 overflow-hidden rounded-full bg-gradient-to-r from-goldHover to-gold px-4 sm:px-6 py-2 sm:py-2.5 text-xs sm:text-sm font-bold text-darker shadow-[0_10px_34px_-10px_rgba(204,164,59,0.7)] transition-all hover:-translate-y-0.5 hover:shadow-[0_14px_44px_-10px_rgba(204,164,59,0.9)]"
            >
              <span
                aria-hidden
                className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/40 to-transparent transition-transform duration-700 group-hover:translate-x-full"
              />
              <LayoutDashboard size={16} className="relative" />
              <span className="relative whitespace-nowrap hidden sm:inline">Mis módulos</span>
            </Link>
          ) : (
            <Link
              to="/login"
              className="group relative inline-flex items-center gap-1.5 sm:gap-2 overflow-hidden rounded-full bg-gradient-to-r from-goldHover to-gold px-4 sm:px-7 py-2 sm:py-2.5 text-xs sm:text-sm font-bold text-darker shadow-[0_10px_34px_-10px_rgba(204,164,59,0.7)] transition-all hover:-translate-y-0.5 hover:shadow-[0_14px_44px_-10px_rgba(204,164,59,0.9)]"
            >
              <span
                aria-hidden
                className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/40 to-transparent transition-transform duration-700 group-hover:translate-x-full"
              />
              <span className="relative whitespace-nowrap">Iniciar sesión</span>
              <ArrowRight size={16} className="relative transition-transform group-hover:translate-x-0.5" />
            </Link>
          )}
        </div>
      </div>
      </motion.header>
    </>,
    document.body,
  );
};

export default LandingHeader;
