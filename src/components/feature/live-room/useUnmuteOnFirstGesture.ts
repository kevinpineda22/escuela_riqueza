import { useEffect, useRef } from "react";

/**
 * Lo que NO cuenta como "primer toque": el aviso de sonido y los controles de
 * volumen tienen su propia acción, y el silencio elegido se respeta.
 */
const AUDIO_CONTROL_SELECTOR = "[data-audio-control]";

/**
 * El navegador no dejó arrancar la clase con sonido: el primer toque o tecla
 * en cualquier parte de la sala lo activa, sin obligar a encontrar el botón.
 * Un toque es un "gesto" para el navegador, y dentro de él sí se puede activar
 * el sonido. Se escucha en captura: corre antes que el botón tocado, que igual
 * hace lo suyo.
 */
export function useUnmuteOnFirstGesture(active: boolean, enableAudio: () => void | Promise<void>) {
  const enableAudioRef = useRef(enableAudio);
  useEffect(() => {
    enableAudioRef.current = enableAudio;
  });

  useEffect(() => {
    if (!active) return;
    const handleGesture = (e: Event) => {
      if (e.target instanceof Element && e.target.closest(AUDIO_CONTROL_SELECTOR)) return;
      // "M" es el atajo de silencio: decide el atajo.
      if (e instanceof KeyboardEvent && e.key.toLowerCase() === "m") return;
      void enableAudioRef.current();
    };
    const events = ["click", "touchend", "keydown"] as const;
    for (const type of events) document.addEventListener(type, handleGesture, true);
    return () => {
      for (const type of events) document.removeEventListener(type, handleGesture, true);
    };
  }, [active]);
}
