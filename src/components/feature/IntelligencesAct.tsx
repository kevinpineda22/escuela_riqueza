import type { ReactNode } from "react";
import { useRef } from "react";
import { motion, useScroll, useTransform } from "motion/react";
import { Link } from "react-router-dom";
import { BookOpen, Briefcase, Heart, Lightbulb, Map, Target, ArrowRight } from "lucide-react";
import { useIsDesktop } from "@/hooks/useMediaQuery";

interface Intelligence {
  id: number;
  title: string;
  description: string;
  icon: ReactNode;
}

const intelligences: Intelligence[] = [
  {
    id: 1,
    title: "Inteligencia Mental",
    description:
      "Aprende a aprender. Memoria, foco profundo y velocidad de procesamiento — la base de todo el resto.",
    icon: <BookOpen className="w-10 h-10" />,
  },
  {
    id: 2,
    title: "Inteligencia de la Riqueza",
    description:
      "Mentalidad y estrategia para construir riqueza real. Tu relación con el dinero, reescrita desde cero.",
    icon: <Target className="w-10 h-10" />,
  },
  {
    id: 3,
    title: "Inteligencia Emocional",
    description:
      "Domina tus emociones para tomar mejores decisiones bajo presión. La diferencia entre ganar y perder.",
    icon: <Heart className="w-10 h-10" />,
  },
  {
    id: 4,
    title: "Inteligencia Comercial",
    description: "Vender y negociar como un profesional. Cerrar tratos sin sacrificar relaciones ni valores.",
    icon: <Briefcase className="w-10 h-10" />,
  },
  {
    id: 5,
    title: "Inteligencia Estratégica",
    description: "Pensar en sistemas. Planificar a largo plazo. Anticipar movimientos antes que el resto.",
    icon: <Map className="w-10 h-10" />,
  },
  {
    id: 6,
    title: "Inteligencia Espiritual",
    description: "Propósito, disciplina y trascendencia. La inteligencia que da sentido a todas las demás.",
    icon: <Lightbulb className="w-10 h-10" />,
  },
];

interface CardProps {
  intelligence: Intelligence;
  index: number;
  total: number;
}

const IntelligenceCard = ({ intelligence, index, total }: CardProps) => {
  return (
    <Link
      to="/leccion"
      className="group relative shrink-0 w-[80vw] sm:w-[55vw] md:w-[42vw] lg:w-[34vw] xl:w-[28vw] h-[60vh] md:h-[68vh] rounded-3xl bg-gradient-to-br from-white/[0.04] to-white/[0.01] border border-white/[0.08] backdrop-blur-md p-8 md:p-10 flex flex-col justify-between overflow-hidden transition-colors duration-300 hover:border-gold/40"
    >
      <div
        aria-hidden
        className="absolute -top-24 -right-24 w-72 h-72 rounded-full bg-gold/10 blur-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-500"
      />

      <div className="relative z-10 flex flex-col gap-6">
        <div className="flex items-center justify-between text-xs uppercase tracking-widest text-textMuted">
          <span>
            Inteligencia <span className="text-gold font-bold">{String(index + 1).padStart(2, "0")}</span>
          </span>
          <span>{String(total).padStart(2, "0")}</span>
        </div>

        <div className="w-20 h-20 rounded-2xl bg-gold/10 text-gold flex items-center justify-center group-hover:scale-110 group-hover:bg-gold/20 transition-transform">
          {intelligence.icon}
        </div>

        <h3 className="text-3xl md:text-4xl font-extrabold tracking-tight text-white leading-tight text-balance">
          {intelligence.title}
        </h3>

        <p className="text-textMuted leading-relaxed text-base md:text-lg text-pretty">
          {intelligence.description}
        </p>
      </div>

      <div className="relative z-10 flex items-center gap-2 text-sm font-semibold text-gold group-hover:gap-4 transition-all">
        Explorar lecciones <ArrowRight size={18} />
      </div>
    </Link>
  );
};

const IntroHeading = () => (
  <div className="max-w-7xl mx-auto px-6 mb-10 lg:mb-12 w-full">
    <motion.h2
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-100px" }}
      transition={{ duration: 0.7 }}
      className="text-4xl md:text-5xl lg:text-6xl font-extrabold tracking-tighter text-white leading-tight max-w-3xl text-balance"
    >
      Seis inteligencias.{" "}
      <span className="text-transparent bg-clip-text bg-gradient-to-r from-gold via-amber-100 to-goldHover italic pr-5 box-decoration-clone">
        Una transformación.
      </span>
    </motion.h2>
    <motion.p
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-100px" }}
      transition={{ duration: 0.7, delay: 0.15 }}
      className="text-textMuted text-lg mt-4 max-w-xl"
    >
      Cada módulo es una pieza del rediseño. Recórrelas a tu ritmo.
    </motion.p>
  </div>
);

/**
 * Desktop: container 180vh con sticky horizontal track.
 * 80vh sticky → animación + 100vh de salida (compartido con próxima sección).
 *
 * Mobile: grid vertical normal — el sticky horizontal sufre con momentum scroll iOS.
 */
const DesktopIntelligences = () => {
  const sectionRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);

  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ["start start", "end end"],
  });

  const x = useTransform(scrollYProgress, (progress) => {
    if (!trackRef.current) return 0;
    const distance = trackRef.current.scrollWidth - window.innerWidth;
    return -progress * distance;
  });

  return (
    <section
      ref={sectionRef}
      id="modulos"
      className="relative h-[260vh] w-full"
      aria-label="Las seis inteligencias"
    >
      <div className="sticky top-0 h-screen w-full flex flex-col justify-center overflow-hidden">
        <IntroHeading />
        <motion.div
          ref={trackRef}
          style={{ x }}
          className="flex gap-6 lg:gap-8 pl-6 md:pl-10 lg:pl-[6vw] pr-[20vw] will-change-transform"
        >
          {intelligences.map((intelligence, index) => (
            <IntelligenceCard
              key={intelligence.id}
              intelligence={intelligence}
              index={index}
              total={intelligences.length}
            />
          ))}
        </motion.div>
      </div>
    </section>
  );
};

const MobileIntelligences = () => {
  return (
    <section id="modulos" className="relative z-10 max-w-3xl mx-auto px-6 py-20 w-full">
      <IntroHeading />
      <div className="flex flex-col gap-5 px-0">
        {intelligences.map((intelligence, index) => (
          <motion.div
            key={intelligence.id}
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-50px" }}
            transition={{ duration: 0.6, delay: index * 0.05 }}
            className="w-full"
          >
            <IntelligenceCard intelligence={intelligence} index={index} total={intelligences.length} />
          </motion.div>
        ))}
      </div>
    </section>
  );
};

export const IntelligencesAct = () => {
  const isDesktop = useIsDesktop();
  return isDesktop ? <DesktopIntelligences /> : <MobileIntelligences />;
};
