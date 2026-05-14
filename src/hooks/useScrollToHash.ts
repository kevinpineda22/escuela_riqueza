import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

export function useScrollToHash() {
  const { pathname, hash } = useLocation();

  useEffect(() => {
    // Si no hay hash, scrolleamos al inicio solo si cambiamos de ruta (o al montar)
    if (!hash) {
      window.scrollTo(0, 0);
      return;
    }

    // Pequeño delay ampliado a 500ms para asegurar que AnimatePresence termine la transición (dura 300ms)
    const timeoutId = setTimeout(() => {
      const id = hash.replace('#', '');
      const element = document.getElementById(id);
      
      if (element) {
        // Usamos un offset para el header fixed si es necesario, scrollIntoView a veces queda oculto por el header
        const y = element.getBoundingClientRect().top + window.scrollY - 100;
        window.scrollTo({ top: y, behavior: 'smooth' });
      }
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [pathname, hash]);
}
