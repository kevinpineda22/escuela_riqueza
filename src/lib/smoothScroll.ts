import type Lenis from "lenis";

/**
 * Referencia al Lenis activo (solo existe en desktop, ver MotionProvider).
 * Permite que componentes como ScrollToTop scrolleen respetando el smooth
 * scroll, con fallback nativo cuando Lenis no está (mobile / reduce-motion).
 */
let lenisInstance: Lenis | null = null;

export const setLenis = (instance: Lenis | null) => {
  lenisInstance = instance;
};

export const scrollToTop = () => {
  if (lenisInstance) {
    lenisInstance.scrollTo(0, { duration: 1.2 });
  } else {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
};
