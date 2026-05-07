import { useRef } from "react";
import { motion, useScroll, useTransform } from "motion/react";
import { useIsDesktop } from "@/hooks/useMediaQuery";

interface AnimatedStatProps {
  value: string;
  label: string;
}

const AnimatedStat = ({ value, label }: AnimatedStatProps) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-100px" }}
      transition={{ duration: 0.6, ease: "easeOut" }}
      className="flex flex-col items-center text-center"
    >
      <div className="text-5xl md:text-7xl font-extrabold text-gold drop-shadow-[0_0_15px_rgba(204,164,59,0.35)]">
        {value}
      </div>
      <div className="text-textMuted uppercase tracking-widest text-xs md:text-sm font-semibold mt-3 max-w-[180px]">
        {label}
      </div>
    </motion.div>
  );
};

/**
 * Acto 2 — El Despertar.
 *
 * Frame 1: pregunta gigante (visible al entrar al sticky).
 * Frame 2: respuesta "Es momento de cambiar".
 * Frame 3: stats animados.
 *
 * Cada frame se cross-fade con scrollYProgress. El frame 1 arranca en opacity 1 para que
 * el usuario vea contenido al entrar a la sección.
 */
const DesktopAwakening = () => {
  const containerRef = useRef<HTMLDivElement>(null);

  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start start", "end end"],
  });

  // Frame 1 visible al entrar (opacity 1) y se desvanece al 35%.
  const qOpacity = useTransform(scrollYProgress, [0, 0.25, 0.4], [1, 1, 0]);
  const qScale = useTransform(scrollYProgress, [0, 0.4], [1, 1.08]);

  // Frame 2 entra al 35%, se va al 70%.
  const aOpacity = useTransform(scrollYProgress, [0.35, 0.5, 0.7], [0, 1, 0]);
  const aScale = useTransform(scrollYProgress, [0.35, 0.5, 0.7], [0.95, 1, 1.05]);

  // Frame 3 entra al 65%.
  const statsOpacity = useTransform(scrollYProgress, [0.65, 0.85], [0, 1]);
  const statsY = useTransform(scrollYProgress, [0.65, 0.85], [40, 0]);

  return (
    <section ref={containerRef} className="relative h-[220vh] w-full bg-darker">
      <div className="sticky top-0 h-screen w-full flex items-center justify-center overflow-hidden px-6">
        <motion.div
          style={{ opacity: qOpacity, scale: qScale }}
          className="absolute inset-0 flex items-center justify-center text-center px-4 will-change-transform"
        >
          <h2 className="text-5xl md:text-7xl lg:text-8xl font-bold text-white/55 leading-[1.05] tracking-tight max-w-5xl text-balance">
            ¿Cuántas oportunidades dejaste pasar?
          </h2>
        </motion.div>

        <motion.div
          style={{ opacity: aOpacity, scale: aScale }}
          className="absolute inset-0 flex items-center justify-center text-center px-4 will-change-transform"
        >
          <h2 className="text-6xl md:text-8xl lg:text-9xl font-extrabold leading-[1.05] tracking-tight">
            <span className="text-transparent bg-clip-text bg-gradient-to-b from-white to-white/60">
              Es momento de
            </span>{" "}
            <span className="text-gold italic drop-shadow-[0_0_30px_rgba(204,164,59,0.5)]">cambiar.</span>
          </h2>
        </motion.div>

        <motion.div
          style={{ opacity: statsOpacity, y: statsY }}
          className="absolute inset-0 flex items-center justify-center will-change-transform"
        >
          <div className="grid grid-cols-3 gap-8 md:gap-24 w-full max-w-5xl">
            <AnimatedStat value="15.000+" label="Alumnos transformados" />
            <AnimatedStat value="120 h" label="Horas de contenido" />
            <AnimatedStat value="6" label="Inteligencias críticas" />
          </div>
        </motion.div>
      </div>
    </section>
  );
};

const MobileAwakening = () => {
  return (
    <section className="relative z-10 flex flex-col items-center text-center px-6 py-24 w-full bg-darker overflow-hidden">
      <motion.h2
        initial={{ opacity: 0, y: 30 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-50px" }}
        transition={{ duration: 0.8 }}
        className="text-4xl sm:text-5xl font-bold text-white/55 leading-tight mb-24 text-balance"
      >
        ¿Cuántas oportunidades dejaste pasar?
      </motion.h2>

      <motion.h2
        initial={{ opacity: 0, scale: 0.92 }}
        whileInView={{ opacity: 1, scale: 1 }}
        viewport={{ once: true, margin: "-50px" }}
        transition={{ duration: 0.8 }}
        className="text-5xl sm:text-6xl font-extrabold leading-tight mb-24 text-balance"
      >
        <span className="text-transparent bg-clip-text bg-gradient-to-b from-white to-white/60">
          Es momento de
        </span>{" "}
        <span className="text-gold italic">cambiar.</span>
      </motion.h2>

      <div className="grid grid-cols-1 gap-12 w-full max-w-sm">
        <AnimatedStat value="15.000+" label="Alumnos transformados" />
        <AnimatedStat value="120 h" label="Horas de contenido" />
        <AnimatedStat value="6" label="Inteligencias críticas" />
      </div>
    </section>
  );
};

export const AwakeningAct = () => {
  const isDesktop = useIsDesktop();
  return isDesktop ? <DesktopAwakening /> : <MobileAwakening />;
};
