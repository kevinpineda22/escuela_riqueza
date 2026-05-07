import type { ReactNode } from "react";
import { useRef } from "react";
import { motion, useScroll, useTransform } from "motion/react";
import { Brain, Dumbbell, Sparkles } from "lucide-react";

interface Milestone {
  id: number;
  number: string;
  title: string;
  description: string;
  icon: ReactNode;
}

const milestones: Milestone[] = [
  {
    id: 1,
    number: "01",
    title: "Aprende",
    description:
      "Asimila los marcos mentales en clases pre-grabadas de alto valor. Cada lección entrega un concepto claro y aplicable desde el día uno.",
    icon: <Brain className="w-7 h-7" />,
  },
  {
    id: 2,
    number: "02",
    title: "Practica",
    description:
      "Aplica lo aprendido con ejercicios y desafíos semanales. La comunidad y los lives VIP te acompañan en la construcción de hábitos sólidos.",
    icon: <Dumbbell className="w-7 h-7" />,
  },
  {
    id: 3,
    number: "03",
    title: "Transforma",
    description:
      "Resultados medibles en tu economía, decisiones y propósito. Esto no es teoría motivacional — es rediseño real, sostenido en el tiempo.",
    icon: <Sparkles className="w-7 h-7" />,
  },
];

interface MilestoneRowProps {
  milestone: Milestone;
  index: number;
}

const MilestoneRow = ({ milestone, index }: MilestoneRowProps) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 40 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-120px" }}
      transition={{ duration: 0.7, delay: index * 0.08, ease: "easeOut" }}
      className="relative pl-20 md:pl-28"
    >
      <div className="absolute left-6 md:left-10 top-1 -translate-x-1/2 w-12 h-12 md:w-14 md:h-14 rounded-full bg-darker border-2 border-gold flex items-center justify-center text-gold shadow-[0_0_20px_rgba(204,164,59,0.45)] z-10">
        {milestone.icon}
      </div>

      <span className="block text-xs md:text-sm uppercase tracking-[0.2em] text-gold font-bold mb-2">
        Paso {milestone.number}
      </span>
      <h3 className="text-3xl md:text-4xl lg:text-5xl font-extrabold tracking-tight text-white mb-4 leading-tight">
        {milestone.title}
      </h3>
      <p className="text-textMuted leading-relaxed text-base md:text-lg max-w-xl text-pretty">
        {milestone.description}
      </p>
    </motion.div>
  );
};

/**
 * Acto 4 — El Camino.
 *
 * Timeline vertical con línea de progreso scroll-driven (no sticky).
 * La línea se llena de gold conforme la sección pasa por el viewport.
 * Cada hito (3) se revela al entrar al viewport con stagger.
 *
 * Responsive: mismo layout en todos los breakpoints (línea izquierda + texto derecha).
 */
export const PathAct = () => {
  const sectionRef = useRef<HTMLDivElement>(null);

  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ["start end", "end center"],
  });

  const lineHeight = useTransform(scrollYProgress, [0.1, 0.95], ["0%", "100%"]);
  const lineOpacity = useTransform(scrollYProgress, [0, 0.05], [0, 1]);

  return (
    <section
      ref={sectionRef}
      id="camino"
      className="relative max-w-4xl mx-auto px-6 py-24 md:py-32"
      aria-label="El camino"
    >
      <div className="mb-16 md:mb-24 max-w-2xl">
        <motion.h2
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.7 }}
          className="text-4xl md:text-5xl lg:text-6xl font-extrabold tracking-tighter text-white leading-tight mb-4 text-balance"
        >
          Tu camino en{" "}
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-gold via-amber-100 to-goldHover italic pr-5 box-decoration-clone">
            tres pasos
          </span>
          .
        </motion.h2>
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.7, delay: 0.15 }}
          className="text-textMuted text-lg md:text-xl"
        >
          Aprender, practicar, transformar. Sin atajos, sin promesas vacías.
        </motion.p>
      </div>

      <div className="relative">
        <div
          aria-hidden
          className="absolute left-6 md:left-10 top-0 bottom-0 w-0.5 bg-white/8"
        />
        <motion.div
          aria-hidden
          style={{ height: lineHeight, opacity: lineOpacity }}
          className="absolute left-6 md:left-10 top-0 w-0.5 bg-gradient-to-b from-gold via-goldHover to-gold origin-top will-change-[height]"
        />

        <div className="flex flex-col gap-20 md:gap-28">
          {milestones.map((milestone, index) => (
            <MilestoneRow key={milestone.id} milestone={milestone} index={index} />
          ))}
        </div>
      </div>
    </section>
  );
};
