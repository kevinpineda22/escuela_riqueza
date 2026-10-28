import { useRef, useState } from "react";
import { flushSync } from "react-dom";
import type { LiveHLSPlayerHandle, QualityLevel } from "@/components/feature/LiveHLSPlayer";
import type { ReportResult } from "@/lib/errors/errorReporter";
import { hasSavedLivePosition } from "@/lib/live/savedPosition";
import { readLiveVolume } from "@/lib/live/volumePreference";

/** Modos que decide la sala sola. "low" (LL-HLS) ya no se ofrece al alumno. */
export type AutoLatencyMode = "smooth" | "dvr";

/**
 * Estado de reproducción de la sala en vivo: audio, play/pausa, calidad y
 * error del player. Vive en `LiveRoom` (no en el player) para sobrevivir a los
 * remontajes del player y a los cambios de estado de la sala.
 * Devuelve `[playerRef, playback]`: el ref viaja aparte del estado para que el
 * estado se pueda leer en el render sin tocar un ref.
 *
 * Modo AUTOMÁTICO (como YouTube, el alumno nunca elige "modo"): todos miran en
 * Fluidez, lo más estable para clases de 3-4 h. Al retroceder, la sala pasa
 * sola a "Clase completa" (DVR) arrancando en el punto pedido; "EN VIVO"
 * vuelve a Fluidez. Arranca en Clase completa solo si hay una posición
 * guardada de esta clase, para no romper "Retomamos donde lo dejaste".
 */
export function useLivePlayback(resumeKey?: string) {
  const playerRef = useRef<LiveHLSPlayerHandle | null>(null);
  const [latencyMode, setLatencyMode] = useState<AutoLatencyMode>(() =>
    resumeKey && hasSavedLivePosition(resumeKey) ? "dvr" : "smooth",
  );
  // Segundos detrás del filo donde debe arrancar "Clase completa" tras el
  // cambio automático. El player lo aplica una vez y avisa para limpiarlo.
  const [startBehindLive, setStartBehindLive] = useState<number | null>(null);
  // Estados SEPARADOS de audio (antes estaban acoplados en `audioEnabled` y eso
  // hacía que al mutear desde los controles, el aviso reapareciera):
  //  - audioPromptDismissed: flag de "una vez". Al activar el sonido (desde el
  //    aviso o la barra) o elegir seguir sin sonido, el aviso NO vuelve.
  //  - isMuted: estado actual de mute del player. Independiente del aviso.
  // Fase 3: la clase arranca CON sonido. Solo si el navegador lo bloquea
  // (iPhone sin un toque previo) pasa a silencio y aparece el aviso.
  const [audioPromptDismissed, setAudioPromptDismissed] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  // El navegador bloqueó el sonido: el primer toque en cualquier parte de la
  // sala lo activa, sin obligar a encontrar el botón (useUnmuteOnFirstGesture).
  const [awaitingGesture, setAwaitingGesture] = useState(false);
  // Solo audio: la clase sigue sonando con la pantalla bloqueada.
  const [audioOnly, setAudioOnly] = useState(false);
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
  // De quién es la falla (red, plataforma o traba ambigua) y su código.
  const [playerFailure, setPlayerFailure] = useState<ReportResult | null>(null);
  const [playerKey, setPlayerKey] = useState(0);

  const enableAudio = async () => {
    const video = playerRef.current?.video;
    if (!video) return;
    setAudioRetryHint(false);
    setAwaitingGesture(false);
    // `muted` es prop CONTROLADA del <video> (LiveHLSPlayer). Si solo se toca
    // `video.muted` a mano, el siguiente re-render con `isMuted` todavía en
    // true revierte el cambio y el alumno tiene que volver a tocar el botón.
    // Por eso el estado de React se actualiza ANTES de pedir el play.
    setIsMuted(false);
    video.muted = false;
    video.volume = readLiveVolume();
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
    setAwaitingGesture(false);
  };

  // El player arrancó en silencio porque el navegador no dejó sonar.
  const handleAutoplayBlocked = () => {
    setIsMuted(true);
    // También tras una recarga: si el alumno ya escuchaba, el aviso vuelve.
    setAudioPromptDismissed(false);
    setAudioRetryHint(false);
    setAwaitingGesture(true);
  };

  const retryPlayer = () => {
    setPlayerError(false);
    setPlayerFailure(null);
    setPlayerKey((k) => k + 1);
    // El player nuevo arranca en automática: la preferencia vuelve a Auto.
    setCurrentQualityLevel(-1);
    setActiveQualityLevel(-1);
  };

  const play = () => {
    const video = playerRef.current?.video;
    if (!video) return;
    try {
      playerRef.current?.setUserPaused(false);
      const result = video.play();
      if (result && typeof result.catch === "function") result.catch(() => {});
    } catch (e) {
      console.warn("[LiveRoom] play error:", e);
    }
  };

  const pause = () => {
    const video = playerRef.current?.video;
    if (!video) return;
    try {
      // Intención explícita del alumno — el player ya no la infiere del
      // evento nativo 'pause' (ver fix H7/autoplay-respect).
      playerRef.current?.setUserPaused(true);
      video.pause();
    } catch (e) {
      console.warn("[LiveRoom] pause error:", e);
    }
  };

  const togglePlay = () => {
    if (isPlaying) pause();
    else play();
  };

  /**
   * Solo audio ⇄ video. El player se remonta sobre el elemento nuevo; en
   * Clase completa arranca a la misma distancia del filo, no en el vivo.
   */
  const toggleAudioOnly = () => {
    const media = playerRef.current?.video;
    const wasPlaying = isPlaying;
    if (latencyMode === "dvr" && media?.seekable.length) {
      const end = media.seekable.end(media.seekable.length - 1);
      setStartBehindLive(Math.max(0, end - media.currentTime));
    }
    // flushSync: el elemento nuevo existe antes de salir de este toque, y su
    // play() cuenta como pedido del alumno. Si no, iPhone lo arranca mudo.
    flushSync(() => setAudioOnly((v) => !v));
    const next = playerRef.current?.video;
    if (!next || !wasPlaying) return;
    try {
      const result = next.play();
      if (result && typeof result.catch === "function") result.catch(() => {});
    } catch { /* el player lo arranca solo al cargar */ }
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
      if (!next && video.volume === 0) video.volume = readLiveVolume();
    } catch (e) {
      console.warn("[LiveRoom] toggle mute error:", e);
    }
  };

  /** Retroceder estando en Fluidez: pasa a Clase completa en ese punto. */
  const rewindFromLive = (behindSeconds: number) => {
    setStartBehindLive(Math.max(0, behindSeconds));
    setLatencyMode("dvr");
  };

  /** "EN VIVO": desde Clase completa vuelve a Fluidez; en Fluidez, al filo. */
  const returnToLive = () => {
    setStartBehindLive(null);
    if (latencyMode === "dvr") setLatencyMode("smooth");
    else playerRef.current?.goLive();
  };

  /** Salida de un error en Clase completa: Fluidez no depende del DVR. */
  const recoverInSmooth = () => {
    setStartBehindLive(null);
    setLatencyMode("smooth");
    retryPlayer();
  };

  const selectQualityLevel = (index: number) => {
    playerRef.current?.setQualityLevel(index);
    setCurrentQualityLevel(index);
  };

  const playback = {
    playerKey,
    /** Cambia con cada <video>/<audio> nuevo: Reintentar o Solo audio. */
    mediaKey: playerKey * 2 + (audioOnly ? 1 : 0),
    audioOnly,
    toggleAudioOnly,
    awaitingGesture,
    play,
    pause,
    latencyMode,
    startBehindLive,
    rewindFromLive,
    returnToLive,
    recoverInSmooth,
    clearStartBehind: () => setStartBehindLive(null),
    isMuted,
    isPlaying,
    isBuffering,
    qualityLevels,
    currentQualityLevel,
    activeQualityLevel,
    audioPromptDismissed,
    audioRetryHint,
    playerError,
    playerFailure,
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
      onFatalError: (failure?: ReportResult) => {
        setPlayerError(true);
        if (failure) setPlayerFailure(failure);
      },
      onRecovered: () => {
        setPlayerError(false);
        setPlayerFailure(null);
      },
      onAutoplayBlocked: handleAutoplayBlocked,
    },
  };

  return [playerRef, playback] as const;
}

export type LivePlayback = ReturnType<typeof useLivePlayback>[1];
