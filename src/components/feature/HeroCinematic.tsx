import { motion } from "motion/react";

const IVAN_IMAGE =
  "https://imagedelivery.net/HGkLNfdVjFNAti8ZHHgxtQ/0f50233e-863f-4032-5ccf-e57fa0254f00/public";

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
 * Acto 1 — Apertura.
 *
 * Espacio amplio en titular cursiva (leading 1.25 + pb-2) para que ascenders
 * de "ñ", "b", "l" no se corten. Span con `pr-5` y `box-decoration-clone` para
 * que el gradient respete el padding al partirse en líneas.
 */
export const HeroCinematic = () => {
  return (
    <section
      id="historia"
      className="relative min-h-[calc(100svh-4rem)] w-full flex items-center pt-10 pb-24 md:pt-12 md:pb-20 overflow-hidden"
    >
      <div className="relative max-w-7xl mx-auto px-6 w-full grid grid-cols-1 md:grid-cols-12 gap-8 lg:gap-12 items-center">
        <div className="md:col-span-7 z-20 flex flex-col items-start text-left order-2 md:order-1">
          <motion.h1
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.9, ease: "easeOut" }}
            className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl xl:text-8xl font-extrabold tracking-tighter mb-8 pb-2 text-white leading-[1.25] drop-shadow-2xl text-balance"
          >
            Una escuela de{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-gold via-amber-100 to-goldHover italic pr-5 box-decoration-clone">
              rediseño cerebral
            </span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.3, ease: "easeOut" }}
            className="text-lg sm:text-xl md:text-2xl lg:text-3xl font-bold tracking-tight text-white/85 leading-[1.35] max-w-2xl text-pretty pb-2"
          >
            para que te conviertas en el{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-gold via-amber-100 to-goldHover italic pr-5 box-decoration-clone">
              gigante mental
            </span>{" "}
            que llevas dentro.
          </motion.p>
        </div>

        <motion.div
          initial={{ opacity: 0, x: 40, scale: 0.95 }}
          animate={{ opacity: 1, x: 0, scale: 1 }}
          transition={{ duration: 1.1, delay: 0.2, ease: "easeOut" }}
          className="md:col-span-5 relative order-1 md:order-2 w-full flex justify-center md:justify-end items-center"
        >
          <div
            aria-hidden
            className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-darker via-darker/40 to-transparent z-10 pointer-events-none"
          />
          <img
            src={IVAN_IMAGE}
            alt="Iván Mazo"
            loading="eager"
            className="w-[70%] sm:w-[55%] md:w-full max-w-[480px] lg:max-w-[560px] object-contain drop-shadow-[0_0_30px_rgba(204,164,59,0.25)]"
          />
        </motion.div>
      </div>

      <ScrollIndicator />
    </section>
  );
};
