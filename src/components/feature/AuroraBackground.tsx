import { motion } from "motion/react";

/**
 * Fondo ambiental "aurora dorada": luces doradas difusas que se mueven lento
 * detrás del contenido. Envolvente y premium, en paleta oro/oscuro.
 *
 * Uso: colocarlo como primer hijo de un contenedor `relative overflow-hidden`.
 * El contenido va con `z-10`+ por encima. En mobile se apaga el movimiento
 * (un único orbe estático) para no castigar la performance.
 */
const AuroraBackground = () => (
  <div aria-hidden className="absolute inset-0 overflow-hidden pointer-events-none">
    {/* Halo superior difuso que tiñe toda la escena */}
    <div className="absolute inset-0 bg-[radial-gradient(ellipse_100%_70%_at_50%_-10%,rgba(204,164,59,0.12),transparent_60%)]" />

    {/* Aurora animada — solo desktop */}
    <motion.div
      className="hidden md:block absolute -top-1/4 left-[15%] w-[46vw] h-[46vw] max-w-[720px] max-h-[720px] rounded-full bg-[radial-gradient(circle_at_center,rgba(204,164,59,0.30),transparent_62%)] blur-[100px]"
      animate={{ x: [0, 90, -30, 0], y: [0, -60, 40, 0], scale: [1, 1.15, 1] }}
      transition={{ duration: 26, repeat: Infinity, ease: "easeInOut" }}
    />
    <motion.div
      className="hidden md:block absolute top-[10%] right-[8%] w-[40vw] h-[40vw] max-w-[640px] max-h-[640px] rounded-full bg-[radial-gradient(circle_at_center,rgba(225,184,70,0.24),transparent_65%)] blur-[110px]"
      animate={{ x: [0, -70, 40, 0], y: [0, 50, -40, 0], scale: [1, 1.2, 1] }}
      transition={{ duration: 30, repeat: Infinity, ease: "easeInOut", delay: 3 }}
    />
    <motion.div
      className="hidden md:block absolute bottom-[-20%] left-1/2 -translate-x-1/2 w-[54vw] h-[40vw] max-w-[820px] max-h-[560px] rounded-full bg-[radial-gradient(circle_at_center,rgba(160,110,30,0.20),transparent_60%)] blur-[120px]"
      animate={{ scale: [1, 1.12, 1], opacity: [0.55, 0.85, 0.55] }}
      transition={{ duration: 18, repeat: Infinity, ease: "easeInOut" }}
    />

    {/* Mobile: un único orbe estático compacto */}
    <div className="md:hidden absolute -top-[10%] left-1/2 -translate-x-1/2 w-[150vw] h-[150vw] rounded-full bg-[radial-gradient(circle_at_center,rgba(204,164,59,0.16),transparent_60%)] blur-3xl" />

    {/* Grid sutil con mask radial (estructura, profundidad) */}
    <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff08_1px,transparent_1px),linear-gradient(to_bottom,#ffffff08_1px,transparent_1px)] bg-[size:70px_70px] [mask-image:radial-gradient(ellipse_75%_60%_at_50%_45%,#000_25%,transparent_85%)]" />

    {/* Viñeta inferior para asentar el contenido sobre el oscuro */}
    <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-darker to-transparent" />
  </div>
);

export default AuroraBackground;
