import { useEffect, useState, type RefObject } from "react";
import type { LiveHLSPlayerHandle, LiveLatencyMode } from "@/components/feature/LiveHLSPlayer";

/**
 * Atraso (s) respecto del filo a partir del cual el alumno de "Clase completa"
 * tiene clase pendiente: si el admin finaliza, sigue viéndola. La latencia
 * natural de ese modo es de 15 a 39 s según la duración de los segmentos.
 */
export const PENDING_CLASS_MIN_BEHIND_S = 45;

/**
 * ¿El alumno va atrasado en "Clase completa"? Se muestrea cada 2 s porque
 * leer el player durante el render no está permitido, y la sala necesita la
 * respuesta justo en el render en que la fila pasa a `ended`.
 * Vive aparte de `useLivePlayback`: ese hook escribe en el <video> (mute,
 * volumen) y el React Compiler prohíbe mutar un ref que un efecto ya leyó.
 */
export function usePendingClass(
  playerRef: RefObject<LiveHLSPlayerHandle | null>,
  latencyMode: LiveLatencyMode,
  playerKey: number,
): boolean {
  const [hasPendingClass, setHasPendingClass] = useState(false);
  useEffect(() => {
    if (latencyMode !== "dvr") return;
    const interval = window.setInterval(() => {
      const player = playerRef.current;
      const video = player?.video;
      const range = player?.getSeekableRange();
      setHasPendingClass(Boolean(video && range && range.end - video.currentTime > PENDING_CLASS_MIN_BEHIND_S));
    }, 2000);
    return () => window.clearInterval(interval);
  }, [playerRef, latencyMode, playerKey]);
  // Fuera de "Clase completa" no hay tramo pendiente, aunque quede un muestreo viejo.
  return latencyMode === "dvr" && hasPendingClass;
}
