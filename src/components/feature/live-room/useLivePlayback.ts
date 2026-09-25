import { useRef, useState } from "react";
import type { LiveHLSPlayerHandle, QualityLevel } from "@/components/feature/LiveHLSPlayer";

/**
 * Estado de reproducción de la sala en vivo: audio, play/pausa, calidad y
 * error del player. Vive en `LiveRoom` (no en el player) para sobrevivir a los
 * remontajes del player y a los cambios de estado de la sala.
 * Devuelve `[playerRef, playback]`: el ref viaja aparte del estado para que el
 * estado se pueda leer en el render sin tocar un ref.
 */
export function useLivePlayback() {
  const playerRef = useRef<LiveHLSPlayerHandle | null>(null);
  // Estados SEPARADOS de audio (antes estaban acoplados en `audioEnabled` y eso
  // hacía que al mutear desde los controles, el aviso reapareciera):
  //  - audioPromptDismissed: flag de "una vez". Al activar el sonido (desde el
  //    aviso o la barra) o elegir seguir sin sonido, el aviso NO vuelve.
  //  - isMuted: estado actual de mute del player. Independiente del aviso.
  const [audioPromptDismissed, setAudioPromptDismissed] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  // H9: si `video.play()` rechaza al activar sonido, mantenemos el aviso
  // visible y mostramos un hint de reintento en vez de ocultarlo a ciegas.
  const [audioRetryHint, setAudioRetryHint] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isBuffering, setIsBuffering] = useState(false);
  const [qualityLevels, setQualityLevels] = useState<QualityLevel[]>([]);
  // F08: la PREFERENCIA del alumno (-1 = Auto) y la calidad que el player usa
  // ahora van separadas. Antes `LEVEL_SWITCHED` pisaba la preferencia y, con
  // Auto, el selector mostraba "720p" como si el alumno la hubiera elegido.
  const [currentQualityLevel, setCurrentQualityLevel] = useState(-1);
  const [activeQualityLevel, setActiveQualityLevel] = useState(-1);
  // H8: sin reintentos automáticos disponibles — la UI muestra error + botón
  // manual. `playerKey` fuerza el remount (nuevo `Hls`, contador en 0).
  const [playerError, setPlayerError] = useState(false);
  const [playerKey, setPlayerKey] = useState(0);

  const enableAudio = async () => {
    const video = playerRef.current?.video;
    if (!video) return;
    setAudioRetryHint(false);
    // `muted` es prop CONTROLADA del <video> (LiveHLSPlayer). Si solo se toca
    // `video.muted` a mano, el siguiente re-render con `isMuted` todavía en
    // true revierte el cambio y el alumno tiene que volver a tocar el botón.
    // Por eso el estado de React se actualiza ANTES de pedir el play.
    setIsMuted(false);
    video.muted = false;
    video.volume = 1;
    try {
      // H9: esperamos la promesa real de play() antes de ocultar el aviso —
      // ocultarlo optimistamente dejaba al alumno sin sonido y sin explicación
      // cuando el navegador rechazaba la reproducción.
      await video.play();
      setAudioPromptDismissed(true);
    } catch (e) {
      // AbortError = otro play()/pause() del player interrumpió a este (pausa
      // de sala, catch-up de latencia, vuelta de background). El audio ya
      // quedó activo: revertir a mudo acá era lo que obligaba a insistir.
      if (e instanceof DOMException && e.name === "AbortError") {
        setAudioPromptDismissed(true);
        return;
      }
      console.warn("[LiveRoom] No se pudo activar el audio:", e);
      setIsMuted(true);
      video.muted = true;
      setAudioRetryHint(true);
    }
  };

  // F01: escuchar es una preferencia, no un paso obligatorio.
  const dismissAudioPrompt = () => {
    setAudioPromptDismissed(true);
    setAudioRetryHint(false);
  };

  const retryPlayer = () => {
    setPlayerError(false);
    setPlayerKey((k) => k + 1);
    // El player nuevo arranca en automática: la preferencia vuelve a Auto.
    setCurrentQualityLevel(-1);
    setActiveQualityLevel(-1);
  };

  const togglePlay = () => {
    const video = playerRef.current?.video;
    if (!video) return;
    try {
      if (isPlaying) {
        // Intención explícita del alumno — el player ya no la infiere del
        // evento nativo 'pause' (ver fix H7/autoplay-respect).
        playerRef.current?.setUserPaused(true);
        video.pause();
      } else {
        playerRef.current?.setUserPaused(false);
        const result = video.play();
        if (result && typeof result.catch === "function") result.catch(() => {});
      }
    } catch (e) {
      console.warn("[LiveRoom] play/pause error:", e);
    }
  };

  const toggleMute = () => {
    const video = playerRef.current?.video;
    if (!video) return;
    const next = !isMuted;
    setIsMuted(next);
    // Activar el sonido desde la barra también responde al aviso.
    if (!next) dismissAudioPrompt();
    try {
      video.muted = next;
      if (!next && video.volume === 0) video.volume = 1;
    } catch (e) {
      console.warn("[LiveRoom] toggle mute error:", e);
    }
  };

  const selectQualityLevel = (index: number) => {
    playerRef.current?.setQualityLevel(index);
    setCurrentQualityLevel(index);
  };

  const playback = {
    playerKey,
    isMuted,
    isPlaying,
    isBuffering,
    qualityLevels,
    currentQualityLevel,
    activeQualityLevel,
    audioPromptDismissed,
    audioRetryHint,
    playerError,
    enableAudio,
    dismissAudioPrompt,
    retryPlayer,
    togglePlay,
    toggleMute,
    selectQualityLevel,
    /** Props de eventos para `LiveHLSPlayer`. */
    playerEvents: {
      onPlay: () => { setIsPlaying(true); setIsBuffering(false); },
      onPause: () => setIsPlaying(false),
      onWaiting: () => setIsBuffering(true),
      onPlaying: () => { setIsBuffering(false); setIsPlaying(true); },
      onLevelsChange: (levels: QualityLevel[], current: number) => {
        setQualityLevels(levels);
        setActiveQualityLevel(current);
      },
      onFatalError: () => setPlayerError(true),
    },
  };

  return [playerRef, playback] as const;
}

export type LivePlayback = ReturnType<typeof useLivePlayback>[1];
