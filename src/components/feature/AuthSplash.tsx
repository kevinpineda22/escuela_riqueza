import { motion } from "motion/react";

const LOGO_LIGHT =
  "https://imagedelivery.net/HGkLNfdVjFNAti8ZHHgxtQ/18dc9190-6625-4b89-8f1e-3f221e96b500/public";

interface AuthSplashProps {
  message?: string;
}

const AuthSplash = ({ message = "Preparando tu experiencia..." }: AuthSplashProps) => (
  <div
    role="status"
    aria-live="polite"
    aria-busy="true"
    className="fixed inset-0 z-[9999] bg-[#050505] flex flex-col items-center justify-center overflow-hidden font-sans"
  >
    {/* Glow ambiental dorado */}
    <motion.div
      aria-hidden
      style={{ position: "absolute" }}
      className="-top-1/3 left-1/2 -translate-x-1/2 w-[700px] h-[700px] rounded-full bg-[radial-gradient(circle_at_center,rgba(204,164,59,0.35),transparent_60%)] blur-3xl"
      animate={{ scale: [1, 1.12, 1], opacity: [0.45, 0.7, 0.45] }}
      transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
    />
    <div
      aria-hidden
      className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff05_1px,transparent_1px),linear-gradient(to_bottom,#ffffff05_1px,transparent_1px)] bg-[size:64px_64px] [mask-image:radial-gradient(ellipse_60%_60%_at_50%_50%,#000_30%,transparent_85%)]"
    />

    <div className="relative z-10 flex flex-col items-center gap-10">
      {/* Logo con halo pulsando */}
      <div className="relative">
        <motion.div
          aria-hidden
          className="absolute inset-0 rounded-full bg-gold/30 blur-2xl scale-150"
          animate={{ opacity: [0.3, 0.6, 0.3], scale: [1.4, 1.7, 1.4] }}
          transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.img
          src={LOGO_LIGHT}
          alt="Escuela de la Riqueza"
          className="relative h-24 sm:h-28 w-auto object-contain drop-shadow-[0_0_30px_rgba(204,164,59,0.5)]"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
        />
      </div>

      {/* Anillo de carga elegante */}
      <div className="relative w-12 h-12">
        <motion.span
          aria-hidden
          className="absolute inset-0 rounded-full border-2 border-gold/15"
        />
        <motion.span
          aria-hidden
          className="absolute inset-0 rounded-full border-2 border-transparent border-t-gold"
          animate={{ rotate: 360 }}
          transition={{ duration: 1.1, repeat: Infinity, ease: "linear" }}
        />
      </div>

      <motion.p
        className="text-sm font-medium text-textMuted tracking-wide"
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.2 }}
      >
        {message}
      </motion.p>
    </div>

    <span className="sr-only">Cargando, por favor espera.</span>
  </div>
);

export default AuthSplash;
