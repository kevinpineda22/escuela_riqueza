import { useEffect, type ReactNode } from "react";
import Lenis from "lenis";
import { MotionConfig } from "motion/react";
import { useIsDesktop, usePrefersReducedMotion } from "@/hooks/useMediaQuery";
import { usePreferencesStore } from "@/stores/preferences.store";
import { setLenis } from "@/lib/smoothScroll";

interface MotionProviderProps {
  children: ReactNode;
}

const MotionProvider = ({ children }: MotionProviderProps) => {
  const isDesktop = useIsDesktop();
  const prefersReducedMotion = usePrefersReducedMotion();
  const animationsEnabled = usePreferencesStore((s) => s.animationsEnabled);

  // El usuario ganó: si apaga animaciones desde el toggle, o el SO pide reduce,
  // entramos en modo "reducido". Esto apaga Framer Motion y Lenis.
  const reduce = prefersReducedMotion || !animationsEnabled;

  useEffect(() => {
    if (!isDesktop || reduce) return;

    const lenis = new Lenis({
      duration: 1.1,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      lerp: 0.1,
      smoothWheel: true,
    });

    setLenis(lenis);

    let rafId = 0;
    const raf = (time: number) => {
      lenis.raf(time);
      rafId = requestAnimationFrame(raf);
    };
    rafId = requestAnimationFrame(raf);

    return () => {
      cancelAnimationFrame(rafId);
      lenis.destroy();
      setLenis(null);
    };
  }, [isDesktop, reduce]);

  // Reflejamos la preferencia en <html data-reduce-motion> para que CSS pueda
  // apagar animaciones puramente CSS (transitions, keyframes) si hace falta.
  useEffect(() => {
    if (typeof document === "undefined") return;
    document.documentElement.dataset.reduceMotion = reduce ? "true" : "false";
  }, [reduce]);

  return (
    <MotionConfig reducedMotion={reduce ? "always" : "never"}>{children}</MotionConfig>
  );
};

export default MotionProvider;
