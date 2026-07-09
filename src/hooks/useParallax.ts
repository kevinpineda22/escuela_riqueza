import type { RefObject } from "react";
import { useScroll, useSpring } from "motion/react";
import { useIsDesktop, usePrefersReducedMotion } from "@/hooks/useMediaQuery";
import { usePreferencesStore } from "@/stores/preferences.store";

// Derivamos el tipo de `offset` de la propia firma de useScroll para no acoplar
// a un tipo con nombre que podría no exportarse.
type UseScrollOptions = NonNullable<Parameters<typeof useScroll>[0]>;

interface UseParallaxOptions {
  /** Sección de referencia que dispara el progreso de scroll. */
  target: RefObject<HTMLElement | null>;
  /** Rango de scroll (mismo formato que useScroll). */
  offset?: UseScrollOptions["offset"];
  /** Intensidad relativa en táctil (0..1). Default 0.4 → 40% del efecto desktop. */
  mobileFactor?: number;
}

/**
 * Primitivo único de parallax para toda la landing. Centraliza las tres reglas
 * que antes faltaban y hacían que cada acto se comportara distinto:
 *
 * 1. Accesibilidad: si el usuario apaga animaciones (preferences.store) o el SO
 *    pide `prefers-reduced-motion`, `factor` es 0 → el efecto queda estático.
 *    (El parallax por `style={{ y }}` NO lo gobierna MotionConfig, por eso hay
 *    que apagarlo acá a mano.)
 * 2. Suavidad en móvil: en desktop el scroll ya viene sedoso por Lenis, así que
 *    usamos el progreso crudo. En móvil no hay Lenis → lo pasamos por un spring
 *    para que no tironee sobre el scroll nativo.
 * 3. Intensidad pareja: full en desktop, reducida en táctil, nula si reduce.
 *
 * Devuelve `progress` (MotionValue 0→1 ya tratado) y `factor` para escalar los
 * rangos de salida. Los `useTransform` viven en cada componente, multiplicando
 * su rango por `factor` (así, factor 0 = valor estático = respeto de la
 * preferencia sin lógica extra).
 */
export function useParallax({
  target,
  offset,
  mobileFactor = 0.4,
}: UseParallaxOptions) {
  const isDesktop = useIsDesktop();
  const prefersReduced = usePrefersReducedMotion();
  const animationsEnabled = usePreferencesStore((s) => s.animationsEnabled);
  const reduce = prefersReduced || !animationsEnabled;

  const { scrollYProgress } = useScroll({ target, offset });
  const smooth = useSpring(scrollYProgress, {
    stiffness: 130,
    damping: 30,
    mass: 0.35,
  });

  const progress = isDesktop ? scrollYProgress : smooth;
  const factor = reduce ? 0 : isDesktop ? 1 : mobileFactor;

  return { progress, factor, reduce };
}
