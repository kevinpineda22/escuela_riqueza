import { useEffect, useRef, useState, type UIEvent } from "react";

// Cuánto puede estar el lector lejos del final y seguir "al día".
const BOTTOM_THRESHOLD_PX = 80;

function scrollToEnd(el: HTMLElement, smooth: boolean) {
  try {
    el.scrollTo({ top: el.scrollHeight, behavior: smooth ? "smooth" : "auto" });
  } catch {
    // Safari viejo / jsdom: sin scrollTo con opciones.
    el.scrollTop = el.scrollHeight;
  }
}

/**
 * Seguimiento del final en una lista de chat (F19). Si el lector está al
 * final, los mensajes nuevos lo acompañan; si subió a leer, se respeta su
 * posición y se cuentan los que llegan para ofrecerle volver. Desplaza solo
 * la lista: `scrollIntoView` arrastraba también la página y el video.
 */
export function useChatScroll(itemCount: number, ready: boolean) {
  const listRef = useRef<HTMLDivElement>(null);
  const [atBottom, setAtBottom] = useState(true);
  // Mensajes ya vistos: lo que había la última vez que el lector estuvo al final.
  const [seenCount, setSeenCount] = useState(itemCount);
  const didInitialScrollRef = useRef(false);

  useEffect(() => {
    const el = listRef.current;
    if (!ready || !atBottom || !el) return;
    // La primera vez salta directo al final; después, acompaña suave.
    scrollToEnd(el, didInitialScrollRef.current);
    didInitialScrollRef.current = true;
  }, [itemCount, ready, atBottom]);

  // Si la lista cambia de alto (teclado que achica la vista, rotación, panel
  // que se abre) con el lector al final, se lo mantiene ahí. Achicarse no
  // dispara `scroll`: sin esto los últimos mensajes quedaban tapados hasta que
  // llegaba el siguiente (F15).
  useEffect(() => {
    const el = listRef.current;
    if (!ready || !atBottom || !el || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => scrollToEnd(el, false));
    observer.observe(el);
    return () => observer.disconnect();
  }, [ready, atBottom]);

  const handleScroll = (e: UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < BOTTOM_THRESHOLD_PX;
    setAtBottom(nearBottom);
    if (nearBottom) setSeenCount(itemCount);
  };

  const jumpToLatest = () => {
    setAtBottom(true);
    setSeenCount(itemCount);
    if (listRef.current) scrollToEnd(listRef.current, true);
  };

  return {
    listRef,
    handleScroll,
    /** Mensajes llegados mientras el lector no estaba al final. */
    unseenCount: atBottom ? 0 : Math.max(0, itemCount - seenCount),
    jumpToLatest,
  };
}
