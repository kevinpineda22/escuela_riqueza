import { useEffect, useRef } from "react";
import { useIsDesktop, usePrefersReducedMotion } from "@/hooks/useMediaQuery";
import { usePreferencesStore } from "@/stores/preferences.store";

/**
 * Constelación dorada sobre canvas 2D: puntos que flotan y se conectan con líneas
 * finas cuando están cerca. Interactúa sutilmente con el mouse en desktop.
 *
 * Por qué canvas y no DOM/Framer: son decenas de nodos + O(n²) líneas por frame.
 * Con DOM sería impagable. Un solo <canvas> y un rAF resuelven todo sin tocar React.
 *
 * Respeta la accesibilidad: si el usuario apaga animaciones (store) o el SO pide
 * reduce-motion, se pinta UN frame estático y no se abre el loop. En mobile baja
 * la densidad de partículas para no castigar batería/GPU.
 *
 * Uso: primer hijo de un contenedor `relative overflow-hidden`; el contenido va
 * por encima con `z-10`+.
 */

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
}

// Paleta oro del cliente (tailwind.config): gold #CCA43B.
const GOLD = { r: 204, g: 164, b: 59 };
const LINK_DISTANCE = 140; // px a partir de los cuales dos puntos se unen
const MOUSE_DISTANCE = 170; // radio de influencia del cursor

const ParticleNetwork = () => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const isDesktop = useIsDesktop();
  const prefersReducedMotion = usePrefersReducedMotion();
  const animationsEnabled = usePreferencesStore((s) => s.animationsEnabled);
  const reduce = prefersReducedMotion || !animationsEnabled;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let width = 0;
    let height = 0;
    let dpr = 1;
    let particles: Particle[] = [];
    let rafId = 0;
    const mouse = { x: -9999, y: -9999, active: false };

    const particleCount = () => {
      const area = width * height;
      // ~1 partícula cada 14.000px² en desktop, más ralo en mobile.
      const density = isDesktop ? 14000 : 24000;
      return Math.min(Math.round(area / density), isDesktop ? 90 : 40);
    };

    const spawn = () => {
      const count = particleCount();
      particles = Array.from({ length: count }, () => ({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 0.35,
        vy: (Math.random() - 0.5) * 0.35,
        r: Math.random() * 1.6 + 0.9,
      }));
    };

    const resize = () => {
      const parent = canvas.parentElement;
      if (!parent) return;
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = parent.clientWidth;
      height = parent.clientHeight;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      spawn();
    };

    const draw = () => {
      ctx.clearRect(0, 0, width, height);

      // Líneas: cada par por debajo del umbral, opacidad según cercanía.
      for (let i = 0; i < particles.length; i++) {
        const a = particles[i];
        for (let j = i + 1; j < particles.length; j++) {
          const b = particles[j];
          const dx = a.x - b.x;
          const dy = a.y - b.y;
          const dist = Math.hypot(dx, dy);
          if (dist < LINK_DISTANCE) {
            const alpha = (1 - dist / LINK_DISTANCE) * 0.28;
            ctx.strokeStyle = `rgba(${GOLD.r},${GOLD.g},${GOLD.b},${alpha})`;
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.stroke();
          }
        }

        // Línea hacia el cursor (desktop) — la constelación "sigue" al mouse.
        if (mouse.active) {
          const dx = a.x - mouse.x;
          const dy = a.y - mouse.y;
          const dist = Math.hypot(dx, dy);
          if (dist < MOUSE_DISTANCE) {
            const alpha = (1 - dist / MOUSE_DISTANCE) * 0.4;
            ctx.strokeStyle = `rgba(${GOLD.r},${GOLD.g},${GOLD.b},${alpha})`;
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(mouse.x, mouse.y);
            ctx.stroke();
          }
        }
      }

      // Puntos con leve glow.
      for (const p of particles) {
        ctx.beginPath();
        ctx.fillStyle = `rgba(${GOLD.r},${GOLD.g},${GOLD.b},0.85)`;
        ctx.shadowColor = `rgba(${GOLD.r},${GOLD.g},${GOLD.b},0.8)`;
        ctx.shadowBlur = 8;
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.shadowBlur = 0;
    };

    const tick = () => {
      for (const p of particles) {
        p.x += p.vx;
        p.y += p.vy;
        // Rebote suave en los bordes.
        if (p.x < 0 || p.x > width) p.vx *= -1;
        if (p.y < 0 || p.y > height) p.vy *= -1;
      }
      draw();
      rafId = requestAnimationFrame(tick);
    };

    resize();

    // Control de loop: sólo corre cuando el canvas está en pantalla.
    let running = false;
    const start = () => {
      if (running || reduce) return;
      running = true;
      rafId = requestAnimationFrame(tick);
    };
    const stop = () => {
      running = false;
      cancelAnimationFrame(rafId);
    };

    if (reduce) {
      // Sin movimiento: un único frame quieto y nos vamos.
      draw();
    } else {
      start();
    }

    // Pausa el rAF cuando el hero sale de viewport (landing larga → no quemar
    // batería animando algo que nadie ve).
    const io = new IntersectionObserver(
      ([entry]) => {
        if (reduce) return;
        if (entry.isIntersecting) start();
        else stop();
      },
      { threshold: 0 },
    );
    io.observe(canvas);

    const onResize = () => resize();
    window.addEventListener("resize", onResize);

    const onMouseMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      mouse.x = e.clientX - rect.left;
      mouse.y = e.clientY - rect.top;
      mouse.active = true;
    };
    const onMouseLeave = () => {
      mouse.active = false;
      mouse.x = -9999;
      mouse.y = -9999;
    };

    // Interacción con el mouse solo en desktop y con animaciones activas.
    if (isDesktop && !reduce) {
      window.addEventListener("mousemove", onMouseMove);
      document.addEventListener("mouseleave", onMouseLeave);
    }

    return () => {
      stop();
      io.disconnect();
      window.removeEventListener("resize", onResize);
      window.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseleave", onMouseLeave);
    };
  }, [isDesktop, reduce]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      className="absolute inset-0 h-full w-full pointer-events-none"
    />
  );
};

export default ParticleNetwork;
