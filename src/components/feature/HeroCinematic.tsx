import { useRef } from "react";
import { motion, useScroll, useTransform } from "motion/react";
import { ChevronRight } from "lucide-react";
import { useIsDesktop } from "@/hooks/useMediaQuery";

const IVAN_IMAGE = "https://imagedelivery.net/HGkLNfdVjFNAti8ZHHgxtQ/0f50233e-863f-4032-5ccf-e57fa0254f00/public";

/**
 * Acto 1 — Apertura cinematic.
 *
 * Reglas que aplica:
 * - Frame 1 (estado en reposo) SIEMPRE visible al cargar — animación de entrada al mount,
 *   no driven by scroll. Si el usuario nunca scrollea, sigue viendo un hero completo.
 * - Scroll progress evoluciona el frame: ilumina la palabra clave, revela el subtítulo,
 *   muestra el CTA y aleja la imagen al fondo.
 */
const DesktopHero = () => {
  const containerRef = useRef<HTMLDivElement>(null);

  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start start", "end end"],
  });

  // Iluminación progresiva del "rediseño cerebral" (de blanco a gold con glow).
  const goldColor = useTransform(
    scrollYProgress,
    [0, 0.35],
    ["rgba(255,255,255,0.95)", "rgba(204,164,59,1)"]
  );
  const goldShadow = useTransform(
    scrollYProgress,
    [0, 0.35],
    ["0 0 0px rgba(204,164,59,0)", "0 0 40px rgba(204,164,59,0.55)"]
  );

  // Subtítulo aparece a partir del 25% de scroll.
  const subtitleOpacity = useTransform(scrollYProgress, [0.2, 0.5], [0, 1]);
  const subtitleY = useTransform(scrollYProgress, [0.2, 0.5], [24, 0]);

  // CTA aparece al 55% de scroll.
  const ctaOpacity = useTransform(scrollYProgress, [0.5, 0.75], [0, 1]);
  const ctaY = useTransform(scrollYProgress, [0.5, 0.75], [20, 0]);

  // Iván se aleja al fondo en el último tercio.
  const ivanScale = useTransform(scrollYProgress, [0.7, 1], [1, 0.88]);
  const ivanFilter = useTransform(
    scrollYProgress,
    [0.7, 1],
    ["brightness(1) blur(0px)", "brightness(0.55) blur(4px)"]
  );

  return (
    <section ref={containerRef} id="historia" className="relative h-[220vh] w-full">
      <div className="sticky top-0 h-screen w-full overflow-hidden">
        <div className="relative h-full max-w-7xl mx-auto px-6 flex flex-row items-center">
          {/* Texto */}
          <div className="relative z-20 w-full md:w-[60%] flex flex-col items-start text-left">
            <motion.h1
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.9, ease: "easeOut" }}
              className="text-4xl md:text-6xl lg:text-7xl font-extrabold tracking-tighter mb-8 text-white leading-[1.05] drop-shadow-2xl"
            >
              <span className="block">Una escuela de</span>
              <motion.span
                style={{ color: goldColor, textShadow: goldShadow }}
                className="italic inline-block"
              >
                rediseño cerebral
              </motion.span>
            </motion.h1>

            <motion.p
              style={{ opacity: subtitleOpacity, y: subtitleY }}
              className="text-2xl md:text-3xl lg:text-4xl mb-10 font-bold tracking-tight text-white/85 leading-tight max-w-2xl"
            >
              para que te conviertas en el{" "}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-gold via-amber-100 to-goldHover italic pr-2">
                gigante mental
              </span>
              <br />
              que llevas dentro.
            </motion.p>

            <motion.div style={{ opacity: ctaOpacity, y: ctaY }}>
              <a
                href="#modulos"
                className="px-10 py-5 text-lg bg-gold hover:bg-goldHover text-darker font-bold rounded-full transition-all flex items-center justify-center gap-2 shadow-[0_0_30px_rgba(204,164,59,0.4)] hover:scale-105 hover:shadow-[0_0_40px_rgba(204,164,59,0.6)]"
              >
                Descubrir Módulos <ChevronRight size={20} />
              </a>
            </motion.div>
          </div>

          {/* Imagen de Iván */}
          <motion.div
            initial={{ opacity: 0, x: 60 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 1.1, delay: 0.2, ease: "easeOut" }}
            style={{ scale: ivanScale, filter: ivanFilter }}
            className="absolute right-0 bottom-0 w-[55%] h-full origin-bottom-right pointer-events-none"
          >
            <div className="absolute inset-0 bg-gradient-to-t from-darker via-darker/30 to-transparent z-10" />
            <div className="absolute inset-0 bg-gradient-to-l from-transparent via-transparent to-darker z-10" />
            <img
              src={IVAN_IMAGE}
              alt="Iván Mazo"
              className="w-full h-full object-contain object-bottom-right drop-shadow-[0_0_30px_rgba(204,164,59,0.25)]"
            />
          </motion.div>
        </div>
      </div>
    </section>
  );
};

const MobileHero = () => {
  return (
    <section
      id="historia"
      className="relative z-10 flex flex-col items-center text-center px-6 pt-28 pb-16 w-full bg-darker overflow-hidden"
    >
      <motion.h1
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.9, ease: "easeOut" }}
        className="text-4xl sm:text-5xl font-extrabold tracking-tighter mb-6 text-white leading-tight drop-shadow-2xl text-balance"
      >
        Una escuela de{" "}
        <span className="text-transparent bg-clip-text bg-gradient-to-r from-gold via-amber-100 to-goldHover italic">
          rediseño cerebral
        </span>{" "}
        para que te conviertas en el{" "}
        <span className="text-transparent bg-clip-text bg-gradient-to-r from-gold via-amber-100 to-goldHover italic">
          gigante mental
        </span>{" "}
        que llevas dentro.
      </motion.h1>

      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.4, duration: 0.6 }}
      >
        <a
          href="#modulos"
          className="px-8 py-4 text-base sm:text-lg bg-gold hover:bg-goldHover text-darker font-bold rounded-full transition-all flex items-center justify-center gap-2 shadow-[0_0_30px_rgba(204,164,59,0.4)]"
        >
          Descubrir Módulos <ChevronRight size={20} />
        </a>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3, duration: 1 }}
        className="w-full flex justify-center items-center mt-10 relative"
      >
        <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-darker via-darker/40 to-transparent z-10 pointer-events-none" />
        <img
          src={IVAN_IMAGE}
          alt="Iván Mazo"
          className="w-[90%] max-w-sm object-contain drop-shadow-[0_0_30px_rgba(204,164,59,0.25)]"
        />
      </motion.div>
    </section>
  );
};

export const HeroCinematic = () => {
  const isDesktop = useIsDesktop();
  return isDesktop ? <DesktopHero /> : <MobileHero />;
};
