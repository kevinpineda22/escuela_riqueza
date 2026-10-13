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

const prefersReducedMotion = () =>
  typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true;

/**
 * Alto del header pegado arriba (sticky/fixed), para que un destino no quede
 * tapado por él. 0 si no hay.
 */
const stickyHeaderHeight = (): number => {
  const header = document.querySelector("header");
  if (!header) return 0;
  const position = getComputedStyle(header).position;
  return position === "sticky" || position === "fixed" ? header.getBoundingClientRect().height : 0;
};

/**
 * Lleva `el` a la vista, debajo del header pegado, con el smooth scroll de la
 * app. Con Lenis activo hay que pasar por él: un `window.scrollTo` directo lo
 * desincroniza y el salto se ve brusco o rebota.
 */
export const scrollToElement = (el: HTMLElement, { gap = 16, immediate = false }: { gap?: number; immediate?: boolean } = {}) => {
  const offset = stickyHeaderHeight() + gap;
  if (lenisInstance) {
    // Lenis guarda la altura de la página y recorta el destino con ella. Si el
    // contenido acaba de cambiar (el detalle recién cargó), el límite viejo
    // frenaba el scroll a mitad de camino: se recalcula antes.
    lenisInstance.resize();
    lenisInstance.scrollTo(el, { offset: -offset, duration: 1, immediate });
    return;
  }
  const top = el.getBoundingClientRect().top + window.scrollY - offset;
  window.scrollTo({ top: Math.max(0, top), behavior: immediate || prefersReducedMotion() ? "auto" : "smooth" });
};

/** Posición absoluta (ej. restaurar dónde se estaba leyendo), respetando Lenis. */
export const scrollToY = (top: number, { immediate = false }: { immediate?: boolean } = {}) => {
  if (lenisInstance) {
    lenisInstance.resize();
    lenisInstance.scrollTo(top, { duration: 1, immediate });
    return;
  }
  window.scrollTo({ top, behavior: immediate || prefersReducedMotion() ? "auto" : "smooth" });
};

export const scrollToTop = () => {
  if (lenisInstance) {
    lenisInstance.scrollTo(0, { duration: 1.2 });
  } else {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
};
