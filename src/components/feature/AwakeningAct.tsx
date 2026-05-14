import { motion } from "motion/react";

interface StatCardProps {
  value: string;
  label: string;
  delay: number;
}

const StatCard = ({ value, label, delay }: StatCardProps) => (
  <motion.div
    initial={{ opacity: 0, y: 30 }}
    whileInView={{ opacity: 1, y: 0 }}
    viewport={{ once: true, margin: "-100px" }}
    transition={{ duration: 0.6, delay, ease: "easeOut" }}
    className="flex flex-col items-center text-center"
  >
    <div className="text-5xl sm:text-6xl md:text-7xl font-extrabold text-gold drop-shadow-[0_0_15px_rgba(204,164,59,0.35)]">
      {value}
    </div>
    <div className="text-textMuted uppercase tracking-widest text-xs md:text-sm font-semibold mt-3 max-w-[200px]">
      {label}
    </div>
  </motion.div>
);

/**
 * Acto 2 — El Despertar.
 *
 * Tres "frames" como sub-secciones min-h-screen. Cada uno se revela al entrar al viewport.
 * Sin sticky pinning — evita huecos oscuros entre actos.
 */
export const AwakeningAct = () => {
  return (
    <div aria-label="El despertar">
      {/* Frame 1 — La pregunta */}
      <section className="relative min-h-[100svh] flex items-center justify-center px-5 sm:px-6 py-20 overflow-hidden">
        <motion.h2
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.9, ease: "easeOut" }}
          className="text-3xl sm:text-5xl md:text-7xl lg:text-8xl font-bold text-white/55 leading-[1.15] tracking-tight max-w-5xl text-center text-balance"
        >
          ¿Cuántas oportunidades dejaste pasar?
        </motion.h2>
      </section>

      {/* Frame 2 — La respuesta */}
      <section className="relative min-h-[100svh] flex items-center justify-center px-5 sm:px-6 py-20 overflow-hidden">
        <motion.h2
          initial={{ opacity: 0, scale: 0.92 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.9, ease: "easeOut" }}
          className="text-4xl sm:text-6xl md:text-8xl lg:text-9xl font-extrabold leading-[1.2] tracking-tight max-w-5xl text-center text-balance pb-3"
        >
          <span className="text-transparent bg-clip-text bg-gradient-to-b from-white to-white/60">
            Es momento de
          </span>{" "}
          <span className="text-gold italic drop-shadow-[0_0_30px_rgba(204,164,59,0.5)] pr-3 sm:pr-5 box-decoration-clone">
            cambiar.
          </span>
        </motion.h2>
      </section>

      {/* Frame 3 — Los números */}
      <section className="relative min-h-[100svh] flex items-center justify-center px-5 sm:px-6 py-20">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-10 sm:gap-14 md:gap-12 lg:gap-24 w-full max-w-5xl">
          <StatCard value="15.000+" label="Alumnos transformados" delay={0} />
          <StatCard value="120 h" label="Horas de contenido" delay={0.15} />
          <StatCard value="6" label="Inteligencias críticas" delay={0.3} />
        </div>
      </section>
    </div>
  );
};
