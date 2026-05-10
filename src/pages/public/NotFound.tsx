import { Link } from "react-router-dom";
import { motion } from "motion/react";
import { ArrowLeft, Compass, Home } from "lucide-react";

const LOGO_LIGHT =
  "https://imagedelivery.net/HGkLNfdVjFNAti8ZHHgxtQ/18dc9190-6625-4b89-8f1e-3f221e96b500/public";

const NotFound = () => (
  <div className="min-h-[100dvh] w-full bg-[#050505] flex flex-col items-center justify-center relative overflow-hidden font-sans px-6 py-12 selection:bg-gold/30">
    {/* Fondo cinemático coherente con AuthPage */}
    <div
      aria-hidden
      className="absolute inset-0 bg-[radial-gradient(ellipse_120%_80%_at_50%_0%,#1a1410_0%,#0a0a0a_50%,#050505_100%)] pointer-events-none"
    />
    <motion.div
      aria-hidden
      className="absolute -top-1/3 -left-1/4 w-[80vw] h-[80vw] max-w-[900px] max-h-[900px] rounded-full bg-[radial-gradient(circle_at_center,rgba(204,164,59,0.3)_0%,rgba(204,164,59,0.04)_45%,transparent_70%)] blur-3xl pointer-events-none"
      animate={{ x: [0, 60, -20, 0], y: [0, -40, 20, 0] }}
      transition={{ duration: 22, repeat: Infinity, ease: "easeInOut" }}
    />
    <motion.div
      aria-hidden
      className="absolute -bottom-1/3 -right-1/4 w-[80vw] h-[80vw] max-w-[1000px] max-h-[1000px] rounded-full bg-[radial-gradient(circle_at_center,rgba(225,184,70,0.25)_0%,rgba(225,184,70,0.04)_50%,transparent_75%)] blur-3xl pointer-events-none"
      animate={{ x: [0, -50, 30, 0], y: [0, 30, -40, 0] }}
      transition={{ duration: 26, repeat: Infinity, ease: "easeInOut", delay: 2 }}
    />
    <div
      aria-hidden
      className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff06_1px,transparent_1px),linear-gradient(to_bottom,#ffffff06_1px,transparent_1px)] bg-[size:64px_64px] [mask-image:radial-gradient(ellipse_70%_60%_at_50%_50%,#000_30%,transparent_85%)] pointer-events-none"
    />
    <div
      aria-hidden
      className="absolute inset-0 bg-[repeating-linear-gradient(115deg,transparent_0_120px,rgba(204,164,59,0.04)_120px_121px)] pointer-events-none"
    />

    <motion.div
      className="relative z-10 flex flex-col items-center text-center max-w-2xl"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.7, ease: "easeOut" }}
    >
      <motion.img
        src={LOGO_LIGHT}
        alt="Escuela de la Riqueza"
        className="h-16 sm:h-20 w-auto object-contain drop-shadow-[0_0_22px_rgba(204,164,59,0.4)] mb-10"
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.6 }}
      />

      <motion.div
        className="relative"
        initial={{ opacity: 0, scale: 0.85 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.8, delay: 0.15, ease: "easeOut" }}
      >
        <h1 className="text-[160px] sm:text-[220px] xl:text-[260px] font-extrabold leading-none tracking-tighter bg-gradient-to-br from-gold via-goldHover to-amber-300 bg-clip-text text-transparent drop-shadow-[0_0_40px_rgba(204,164,59,0.3)]">
          404
        </h1>
        <motion.div
          aria-hidden
          className="absolute -inset-4 rounded-full bg-gold/20 blur-[80px] -z-10"
          animate={{ opacity: [0.4, 0.7, 0.4], scale: [0.95, 1.05, 0.95] }}
          transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
        />
      </motion.div>

      <motion.div
        className="flex items-center gap-2 text-gold/80 text-xs uppercase tracking-[0.3em] font-bold mt-2 mb-5"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.4 }}
      >
        <Compass size={14} />
        Página fuera de mapa
      </motion.div>

      <motion.h2
        className="text-2xl sm:text-3xl xl:text-4xl font-extrabold text-white tracking-tight max-w-md"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.5 }}
      >
        Te desviaste del camino
      </motion.h2>

      <motion.p
        className="text-sm sm:text-base text-textMuted leading-relaxed mt-4 max-w-md"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.6 }}
      >
        El recurso que buscas no existe o fue movido. Volvé al inicio y
        retomá tu camino.
      </motion.p>

      <motion.div
        className="mt-8 flex flex-col sm:flex-row items-center gap-3"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.7 }}
      >
        <Link
          to="/"
          className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-gold hover:bg-goldHover text-darker font-bold text-sm transition-all shadow-[0_8px_24px_-8px_rgba(204,164,59,0.6)] hover:shadow-[0_8px_28px_-6px_rgba(204,164,59,0.85)] hover:-translate-y-0.5"
        >
          <Home size={16} /> Volver al inicio
        </Link>
        <button
          type="button"
          onClick={() => window.history.back()}
          className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 text-white/80 hover:text-white font-medium text-sm transition-all"
        >
          <ArrowLeft size={16} /> Atrás
        </button>
      </motion.div>
    </motion.div>
  </div>
);

export default NotFound;
