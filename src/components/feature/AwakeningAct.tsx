import { motion } from "motion/react";
import EditableField from "@/components/feature/EditableField";

interface StatCardProps {
  valueKey: string;
  labelKey: string;
  defaultValue: string;
  defaultLabel: string;
  delay: number;
}

const StatCard = ({ valueKey, labelKey, defaultValue, defaultLabel, delay }: StatCardProps) => (
  <motion.div
    initial={{ opacity: 0, y: 30 }}
    whileInView={{ opacity: 1, y: 0 }}
    viewport={{ once: true, margin: "-100px" }}
    transition={{ duration: 0.6, delay, ease: "easeOut" }}
    className="flex flex-col items-center text-center"
  >
    <div className="text-5xl sm:text-6xl md:text-7xl font-extrabold text-gold drop-shadow-[0_0_15px_rgba(204,164,59,0.35)]">
      <EditableField textKey={valueKey} defaultValue={defaultValue} as="span" />
    </div>
    <div className="text-textMuted uppercase tracking-widest text-xs md:text-sm font-semibold mt-3 max-w-[200px]">
      <EditableField textKey={labelKey} defaultValue={defaultLabel} as="span" />
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
          <EditableField textKey="awakening_question" defaultValue="¿Cuántas oportunidades dejaste pasar?" as="span" />
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
            <EditableField textKey="awakening_answer" defaultValue="Es momento de" as="span" className="inline" />
          </span>{" "}
          <span className="text-gold italic drop-shadow-[0_0_30px_rgba(204,164,59,0.5)] pr-3 sm:pr-5 box-decoration-clone">
            <EditableField textKey="awakening_accent" defaultValue="cambiar." as="span" className="inline" />
          </span>
        </motion.h2>
      </section>

      {/* Frame 3 — Los números */}
      <section className="relative min-h-[100svh] flex items-center justify-center px-5 sm:px-6 py-20">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-10 sm:gap-14 md:gap-12 lg:gap-24 w-full max-w-5xl">
          <StatCard valueKey="stat_1_value" labelKey="stat_1_label" defaultValue="15.000+" defaultLabel="Alumnos transformados" delay={0} />
          <StatCard valueKey="stat_2_value" labelKey="stat_2_label" defaultValue="120 h" defaultLabel="Horas de contenido" delay={0.15} />
          <StatCard valueKey="stat_3_value" labelKey="stat_3_label" defaultValue="6" defaultLabel="Inteligencias críticas" delay={0.3} />
        </div>
      </section>
    </div>
  );
};
