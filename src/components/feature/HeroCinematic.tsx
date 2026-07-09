import { useRef, type ReactNode } from "react";
import { motion, useTransform } from "motion/react";
import EditableField from "@/components/feature/EditableField";
import AuroraBackground from "@/components/feature/AuroraBackground";
import ParticleNetwork from "@/components/feature/ParticleNetwork";
import { useParallax } from "@/hooks/useParallax";
import { cn } from "@/lib/utils";

const IVAN_IMAGE =
  "https://imagedelivery.net/HGkLNfdVjFNAti8ZHHgxtQ/0f50233e-863f-4032-5ccf-e57fa0254f00/public";

/**
 * Reveal en secuencia: cada bloque del titular aparece con un pequeño retraso,
 * dando la sensación de que la frase "se arma" al entrar. Sólo opacidad (inline
 * seguro, sin transform que rompa el wrapping del gradiente).
 */
const Reveal = ({ children, delay }: { children: ReactNode; delay: number }) => (
  <motion.span
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    transition={{ duration: 0.5, delay, ease: "easeOut" }}
    className="inline"
  >
    {children}
  </motion.span>
);

/**
 * Acento dorado con "brillo" que lo recorre: un gradiente al 200% cuya banda
 * clara (via-amber-100) barre las letras en loop. Es la firma visual del titular.
 * Mantiene `inline` + box-decoration-clone para partirse en líneas sin cortar el
 * gradiente. Respeta reduce-motion vía el MotionConfig global.
 */
const ShimmerAccent = ({
  children,
  delay,
  className,
}: {
  children: ReactNode;
  delay: number;
  className?: string;
}) => (
  <motion.span
    initial={{ opacity: 0 }}
    animate={{ opacity: 1, backgroundPosition: ["0% 50%", "200% 50%"] }}
    transition={{
      opacity: { duration: 0.5, delay, ease: "easeOut" },
      backgroundPosition: { duration: 6, repeat: Infinity, ease: "linear" },
    }}
    className={cn(
      "text-transparent bg-clip-text bg-gradient-to-r from-gold via-amber-100 to-goldHover italic pr-3 sm:pr-5 box-decoration-clone [background-size:200%_auto]",
      className,
    )}
  >
    {children}
  </motion.span>
);

const ScrollIndicator = () => (
  <motion.div
    aria-hidden
    initial={{ opacity: 0, y: 10 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ delay: 1.4, duration: 0.8 }}
    className="absolute bottom-6 md:bottom-10 left-1/2 -translate-x-1/2 flex flex-col items-center gap-3 pointer-events-none"
  >
    <div className="w-7 h-12 border-2 border-gold/40 rounded-full flex items-start justify-center pt-2">
      <motion.div
        className="w-1 h-2 rounded-full bg-gold"
        animate={{ y: [0, 14, 0], opacity: [1, 0, 1] }}
        transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
      />
    </div>
    <span className="text-[10px] uppercase tracking-[0.4em] text-textMuted font-semibold">
      Continuar
    </span>
  </motion.div>
);

/**
 * Acto 1 — Apertura, con parallax.
 *
 * Las capas se mueven a distinta velocidad al scrollear (aurora, contenido y
 * foto) para dar profundidad. El header flota transparente por encima
 * (LandingHeader es `fixed`), por eso el hero ocupa `100svh` y trae padding
 * superior para no chocar con él.
 *
 * Espacio amplio en titular cursiva (leading 1.25 + pb-2) para que ascenders
 * de "ñ", "b", "l" no se corten. Span con `pr-5` y `box-decoration-clone` para
 * que el gradient respete el padding al partirse en líneas.
 */
export const HeroCinematic = () => {
  const ref = useRef<HTMLElement>(null);
  const { progress, factor, reduce } = useParallax({
    target: ref,
    offset: ["start start", "end start"],
  });

  // Capas parallax: la aurora queda atrás (se mueve poco), la foto sube, el
  // contenido baja y se desvanece a medida que el hero sale de pantalla. Cada
  // rango se escala por `factor` → full en desktop, 40% en móvil, 0 si reduce.
  const auroraY = useTransform(progress, [0, 1], ["0%", `${22 * factor}%`]);
  const contentY = useTransform(progress, [0, 1], [0, 90 * factor]);
  const contentOpacity = useTransform(progress, [0, 0.75], [1, reduce ? 1 : 0]);
  const photoY = useTransform(progress, [0, 1], [0, -55 * factor]);

  return (
    <section
      ref={ref}
      id="historia"
      className="relative min-h-[100svh] w-full flex items-center pt-24 pb-20 md:pt-28 md:pb-24 overflow-hidden"
    >
      {/* Aurora + constelación de fondo con parallax lento. La constelación
          dorada es la misma firma visual del login: unifica la marca. */}
      <motion.div style={{ y: auroraY }} className="absolute inset-0" aria-hidden>
        <AuroraBackground />
        <ParticleNetwork />
      </motion.div>

      <motion.div
        style={{ y: contentY, opacity: contentOpacity }}
        className="relative z-10 max-w-7xl mx-auto px-5 sm:px-6 w-full grid grid-cols-1 md:grid-cols-12 gap-6 sm:gap-8 lg:gap-12 items-center"
      >
        <div className="md:col-span-7 z-20 flex flex-col items-start text-left order-2 md:order-1">
          <motion.h1
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.9, ease: "easeOut" }}
            className="text-3xl sm:text-5xl md:text-6xl lg:text-7xl xl:text-8xl font-extrabold tracking-tight md:tracking-tighter mb-6 sm:mb-8 pb-2 text-white leading-[1.2] sm:leading-[1.25] drop-shadow-2xl text-balance"
          >
            <Reveal delay={0.15}>
              <EditableField textKey="hero_title" defaultValue="Una escuela de" as="span" />
            </Reveal>{" "}
            <ShimmerAccent delay={0.35}>
              <EditableField textKey="hero_accent" defaultValue="rediseño cerebral" as="span" className="inline" />
            </ShimmerAccent>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.3, ease: "easeOut" }}
            className="text-base sm:text-xl md:text-2xl lg:text-3xl font-bold tracking-tight text-white/85 leading-[1.35] max-w-2xl text-pretty pb-2"
          >
            <Reveal delay={0.5}>
              <EditableField textKey="hero_subtitle" defaultValue="para que te conviertas en el" as="span" />
            </Reveal>{" "}
            <ShimmerAccent delay={0.7}>
              <EditableField textKey="hero_accent_2" defaultValue="gigante mental" as="span" className="inline" />
            </ShimmerAccent>{" "}
            <Reveal delay={0.85}>
              <EditableField textKey="hero_subtitle_end" defaultValue="que llevas dentro." as="span" />
            </Reveal>
          </motion.p>
        </div>

        <motion.div
          style={{ y: photoY }}
          className="md:col-span-5 relative order-1 md:order-2 w-full flex justify-center md:justify-end items-center"
        >
          <motion.div
            initial={{ opacity: 0, x: 40, scale: 0.95 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            transition={{ duration: 1.1, delay: 0.2, ease: "easeOut" }}
            className="relative w-full flex justify-center md:justify-end items-center"
          >
            {/* Glow dorado pulsante detrás de la foto */}
            <motion.div
              aria-hidden
              className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[70%] max-w-[520px] aspect-square rounded-full bg-[radial-gradient(circle_at_center,rgba(204,164,59,0.35),transparent_60%)] blur-3xl pointer-events-none"
              animate={{ scale: [1, 1.08, 1], opacity: [0.6, 0.9, 0.6] }}
              transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
            />
            {/* "Piso" degradado que funde la base de la foto: solo desktop, donde
                la imagen llena la columna. En mobile la foto es chica y centrada,
                y este overlay dejaba una banda oscura cortada. */}
            <div
              aria-hidden
              className="hidden md:block absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-darker via-darker/40 to-transparent z-10 pointer-events-none"
            />
            <motion.img
              src={IVAN_IMAGE}
              alt="Iván Mazo"
              loading="eager"
              className="relative z-[5] w-[55%] sm:w-[50%] md:w-full max-w-[360px] sm:max-w-[480px] lg:max-w-[560px] object-contain drop-shadow-[0_0_40px_rgba(204,164,59,0.3)]"
              animate={{ y: [0, -12, 0] }}
              transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
            />
          </motion.div>
        </motion.div>
      </motion.div>

      <ScrollIndicator />
    </section>
  );
};
