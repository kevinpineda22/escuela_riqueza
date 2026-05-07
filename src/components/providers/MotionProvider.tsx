import { useEffect, type ReactNode } from "react";
import Lenis from "lenis";
import { MotionConfig } from "motion/react";
import { useIsDesktop, usePrefersReducedMotion } from "@/hooks/useMediaQuery";

interface MotionProviderProps {
  children: ReactNode;
}

const MotionProvider = ({ children }: MotionProviderProps) => {
  const isDesktop = useIsDesktop();
  const prefersReducedMotion = usePrefersReducedMotion();

  useEffect(() => {
    // Lenis solo en desktop y solo si el usuario no pidió reducir motion.
    // En mobile rompe el scroll nativo (momentum, sticky, etc.).
    if (!isDesktop || prefersReducedMotion) return;

    const lenis = new Lenis({
      duration: 1.1,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      lerp: 0.1,
      smoothWheel: true,
    });

    let rafId = 0;
    const raf = (time: number) => {
      lenis.raf(time);
      rafId = requestAnimationFrame(raf);
    };
    rafId = requestAnimationFrame(raf);

    return () => {
      cancelAnimationFrame(rafId);
      lenis.destroy();
    };
  }, [isDesktop, prefersReducedMotion]);

  return (
    <MotionConfig reducedMotion={prefersReducedMotion ? "always" : "never"}>{children}</MotionConfig>
  );
};

export default MotionProvider;
