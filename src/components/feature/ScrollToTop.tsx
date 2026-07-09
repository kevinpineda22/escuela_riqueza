import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "motion/react";
import { ArrowUp } from "lucide-react";
import { scrollToTop } from "@/lib/smoothScroll";

/**
 * Botón flotante "volver arriba". Aparece cuando el usuario scrolleó más allá
 * del header (~80% del alto de pantalla) y desaparece cerca del top.
 *
 * Se renderiza con portal a `document.body`: un ancestro con `filter`/`transform`
 * (el PageTransition) rompería `position: fixed` y lo anclaría al fondo del
 * documento (footer). El portal lo saca de ese contenedor y lo fija a la pantalla.
 *
 * Usa el helper de smoothScroll para respetar Lenis en desktop y scroll nativo
 * en mobile.
 */
const ScrollToTop = () => {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > window.innerHeight * 0.8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return createPortal(
    <AnimatePresence>
      {visible && (
        <motion.button
          type="button"
          onClick={scrollToTop}
          aria-label="Volver arriba"
          initial={{ opacity: 0, scale: 0.8, y: 12 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.8, y: 12 }}
          transition={{ duration: 0.25, ease: "easeOut" }}
          className="group fixed bottom-5 right-5 sm:bottom-8 sm:right-8 z-[60] w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-gradient-to-br from-goldHover to-gold text-darker shadow-[0_10px_30px_-8px_rgba(204,164,59,0.6)] flex items-center justify-center transition-transform hover:-translate-y-1 active:scale-95"
        >
          <ArrowUp size={22} className="transition-transform group-hover:-translate-y-0.5" />
        </motion.button>
      )}
    </AnimatePresence>,
    document.body,
  );
};

export default ScrollToTop;
