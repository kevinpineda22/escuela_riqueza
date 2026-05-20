import { Link } from "react-router-dom";
import { motion } from "motion/react";
import { Wrench, ArrowRight, Sparkles, ShieldCheck } from "lucide-react";
import { usePlatformSettings } from "@/hooks/usePlatformSettings";
import { useAuthStore } from "@/stores/auth.store";

const LOGO_FALLBACK =
  "https://imagedelivery.net/HGkLNfdVjFNAti8ZHHgxtQ/18dc9190-6625-4b89-8f1e-3f221e96b500/public";

const DEFAULT_MESSAGE =
  "Estamos realizando mejoras en la plataforma. Volvemos en un ratito con todo más afinado.";

const MaintenancePage = () => {
  const { data } = usePlatformSettings();
  const { user } = useAuthStore();
  const platformName = data?.platform_name || "Escuela de la Riqueza";
  const message = data?.maintenance_message || DEFAULT_MESSAGE;
  const supportEmail = data?.support_email || null;
  const logoUrl = data?.logo_url || LOGO_FALLBACK;
  const isAdmin = user?.role === "admin";

  return (
    <div className="min-h-[100dvh] w-full bg-[#050505] flex flex-col items-center justify-center relative overflow-hidden font-sans px-5 sm:px-6 py-12 selection:bg-gold/30">
      <div
        aria-hidden
        className="absolute inset-0 bg-[radial-gradient(ellipse_120%_80%_at_50%_0%,#1a1410_0%,#0a0a0a_50%,#050505_100%)] pointer-events-none"
      />
      <motion.div
        aria-hidden
        className="hidden md:block absolute -top-1/3 -left-1/4 w-[80vw] h-[80vw] max-w-[900px] max-h-[900px] rounded-full bg-[radial-gradient(circle_at_center,rgba(204,164,59,0.22)_0%,rgba(204,164,59,0.03)_45%,transparent_70%)] blur-3xl pointer-events-none"
        animate={{ x: [0, 60, -20, 0], y: [0, -40, 20, 0] }}
        transition={{ duration: 22, repeat: Infinity, ease: "easeInOut" }}
      />

      <motion.div
        className="relative z-10 flex flex-col items-center text-center max-w-lg w-full"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, ease: "easeOut" }}
      >
        <Link to="/" className="mb-8 sm:mb-10">
          <img
            src={logoUrl}
            alt={platformName}
            className="h-14 sm:h-16 w-auto object-contain drop-shadow-[0_0_22px_rgba(204,164,59,0.4)]"
          />
        </Link>

        <div className="relative mb-6">
          <div
            aria-hidden
            className="absolute inset-0 rounded-full bg-gold/25 blur-2xl scale-150"
          />
          <motion.div
            initial={{ rotate: 0 }}
            animate={{ rotate: [0, 12, -12, 0] }}
            transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
            className="relative w-20 h-20 rounded-full bg-gradient-to-br from-gold/25 to-amber-500/10 border border-gold/40 flex items-center justify-center shadow-[0_0_30px_rgba(204,164,59,0.35)]"
          >
            <Wrench className="text-gold" size={34} strokeWidth={1.8} />
          </motion.div>
        </div>

        <div className="flex flex-col gap-3">
          <span className="inline-flex items-center justify-center gap-2 mx-auto px-3 py-1 rounded-full bg-gold/10 border border-gold/30 text-[10px] uppercase tracking-[0.3em] font-bold text-gold/90">
            <Sparkles size={12} /> Modo mantenimiento
          </span>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            Estamos puliendo {platformName}
          </h1>
          <p className="text-sm sm:text-base text-textMuted leading-relaxed max-w-md mx-auto">
            {message}
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-center gap-3 mt-8 w-full sm:w-auto">
          {isAdmin ? (
            <Link
              to="/admin/settings"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 rounded-full bg-gold hover:bg-goldHover text-darker font-bold text-sm transition-all shadow-[0_8px_24px_-8px_rgba(204,164,59,0.6)] hover:shadow-[0_8px_28px_-6px_rgba(204,164,59,0.85)] hover:-translate-y-0.5"
            >
              <ShieldCheck size={16} /> Ir al panel admin
            </Link>
          ) : (
            <a
              href={supportEmail ? `mailto:${supportEmail}` : "/"}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 rounded-full bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 text-white/80 hover:text-white font-medium text-sm transition-all"
            >
              {supportEmail ? "Contactar soporte" : "Volver al inicio"}
              <ArrowRight size={14} />
            </a>
          )}
        </div>

        {isAdmin && (
          <p className="mt-6 text-[11px] text-white/40 max-w-sm mx-auto">
            Estás viendo esta página como administrador. Desactivá el modo mantenimiento en
            <span className="text-gold/80"> Configuración → Operativa</span> para reabrir la plataforma.
          </p>
        )}
      </motion.div>
    </div>
  );
};

export default MaintenancePage;
