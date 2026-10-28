import { useEffect, useState, useCallback, useRef, type RefObject, type ChangeEvent } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Play, Pause, Volume2, VolumeX, Maximize, Minimize, Loader2, Settings, Check, PictureInPicture2, ChevronsLeft, ChevronsRight, Headphones, Video } from "lucide-react";
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { formatClock, spokenClock } from "@/lib/live/playerTime";
import { probeDvrDuration } from "@/lib/live/dvrWindow";
import { readLiveVolume, saveLiveVolume } from "@/lib/live/volumePreference";
import type { LiveHLSPlayerHandle, LiveLatencyMode, QualityLevel } from "./LiveHLSPlayer";
import { LiveTimeline, LIVE_SNAP_S, type TimelineSnapshot } from "./LiveTimeline";

// F07: objetivo táctil de 44 px por botón (antes medían lo que el ícono, 20-22
// px). El margen negativo agranda el área sin engordar la barra.
const CONTROL_BUTTON =
  "inline-flex items-center justify-center size-11 -my-2 rounded-full text-foreground-strong hover:text-accent active:scale-90 transition-all";

/** Foco que vino del teclado (no de un clic de mouse o un toque). */
function isKeyboardFocus(el: EventTarget): boolean {
  try {
    return el instanceof Element && el.matches(":focus-visible");
  } catch {
    return false;
  }
}

/** El teclado pertenece al campo: los atajos del reproductor no lo tocan. */
function isTypingTarget(el: EventTarget | null): boolean {
  if (!(el instanceof HTMLElement)) return false;
  if (el.isContentEditable) return true;
  const tag = el.tagName;
  if (tag === "TEXTAREA" || tag === "SELECT") return true;
  if (tag === "INPUT") return (el as HTMLInputElement).type !== "range";
  return false;
}

/** Atajos como YouTube: flechas 5 s, J/L y doble toque 10 s. */
const ARROW_STEP_S = 5;
const JUMP_STEP_S = 10;
/** Dos toques más cerca que esto, del mismo lado, son un doble toque. */
const DOUBLE_TAP_MS = 300;
/** La duración de la clase (Fluidez) se vuelve a pedir si es más vieja que esto. */
const DVR_PROBE_TTL_MS = 60_000;

interface LivePlayerControlsProps {
  playerRef: RefObject<LiveHLSPlayerHandle | null>;
  isPlaying: boolean;
  isBuffering: boolean;
  isMuted: boolean;
  levels: QualityLevel[];
  /** Calidad elegida por el alumno; -1 = automática. */
  currentLevel: number;
  /** Calidad que el player está reproduciendo ahora (con Auto, la decide el ABR). */
  activeLevel?: number;
  /**
   * Lo decide la sala sola (useLivePlayback): Fluidez para mirar el vivo y
   * Clase completa (`dvr`) al retroceder. Ya no hay menú de modos.
   */
  latencyMode: LiveLatencyMode;
  /** Playlist DVR: en Fluidez, de ahí sale cuánto dura la clase para la barra. */
  dvrManifestUrl?: string;
  /**
   * Cambia cuando "Reintentar" remonta el <video>. Los listeners de la barra
   * se vuelven a enganchar al nodo nuevo: con `[playerRef]` solo, quedaban
   * escuchando al video destruido (timeline, seek, fullscreen y PiP mudos).
   */
  mediaKey?: number;
  onTogglePlay: () => void;
  onToggleMute: () => void;
  onSelectLevel: (index: number) => void;
  /** Retroceder estando en Fluidez: la sala pasa a Clase completa en ese punto. */
  onRewindFromLive: (behindSeconds: number) => void;
  /** "EN VIVO": la sala vuelve al directo (y a Fluidez si estaba retrocediendo). */
  onReturnToLive: () => void;
  /**
   * Solo audio: la clase suena en un <audio> (sigue con la pantalla
   * bloqueada). Sin imagen no hay calidad, pantalla completa ni ventana flotante.
   */
  audioOnly?: boolean;
  onToggleAudioOnly?: () => void;
}

const LivePlayerControls = ({
  playerRef,
  isPlaying,
  isBuffering,
  isMuted,
  levels,
  currentLevel,
  activeLevel = -1,
  latencyMode,
  dvrManifestUrl,
  mediaKey = 0,
  onTogglePlay,
  onToggleMute,
  onSelectLevel,
  onRewindFromLive,
  onReturnToLive,
  audioOnly = false,
  onToggleAudioOnly,
}: LivePlayerControlsProps) => {
  const [controlsVisible, setControlsVisible] = useState(true);
  // El volumen se recuerda entre clases (lib/live/volumePreference).
  const [volume, setVolume] = useState(readLiveVolume);
  const [isFullscreen, setIsFullscreen] = useState(false);
  // Elemento en pantalla completa: el menú de ajustes se portalea ahí. En el
  // body no se ve mientras un contenedor ocupa la pantalla.
  const [fullscreenElement, setFullscreenElement] = useState<HTMLElement | null>(null);
  // Picture-in-Picture: la única forma de que el video siga sonando en Android
  // cuando el usuario cambia de app o bloquea el teléfono (Chrome pausa
  // cualquier <video> de una pestaña oculta). iOS Safari usa su API propia.
  const [isPip, setIsPip] = useState(false);
  const [pipSupported, setPipSupported] = useState(false);
  const [liveDelta, setLiveDelta] = useState(0);
  // Distancia natural al filo según hls.js (filo - liveSyncPosition). Depende
  // de la duración de los segmentos: ~6 s con 2 s, ~25 s con 8 s.
  const [naturalOffset, setNaturalOffset] = useState(0);
  // Spinner solo si el buffering supera 1.5s — micropausas del HLS no
  // dispararan más el loader visible y aparente que el stream "se traba"
  // cada pocos segundos.
  const [showBufferingSpinner, setShowBufferingSpinner] = useState(false);
  // Histéresis del pill "VOLVER A VIVO". LL-HLS hace que liveDelta oscile
  // naturalmente entre 2-7s por la llegada de chunks parciales. Sin histéresis,
  // el pill flickearía constantemente. Los umbrales son dinámicos según el
  // `liveSyncOffset` del modo activo (ver más abajo, junto a `handleGoLive`):
  // modo normal (offset 8) aparece >20s / oculta <12s; modo low (offset 3)
  // tiene un piso absoluto (10s / 5s) para no caer dentro de la banda de
  // jitter normal de 2-7s.
  const [isBehind, setIsBehind] = useState(false);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // F03: con el dedo, tocar el video es "mostrame los controles", no "pausá".
  const lastPointerTypeRef = useRef("mouse");
  const bufferTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Arrastrando la línea de tiempo: la barra no se oculta en medio del gesto.
  const [scrubbing, setScrubbing] = useState(false);
  // Fluidez no conoce la clase entera: su duración sale de la playlist DVR,
  // pedida al tocar la barra o mover el mouse (no a todos al entrar).
  const dvrProbeRef = useRef<{ duration: number; at: number } | null>(null);
  const dvrProbeInFlightRef = useRef(false);
  // Doble toque a los costados (celular): ±10 s, con un destello del lado.
  const lastTapRef = useRef<{ at: number; side: "left" | "right" | "center" } | null>(null);
  const [seekFlash, setSeekFlash] = useState<{ side: "left" | "right"; id: number } | null>(null);
  // "1:02:15 / 2:15:00" cuando el alumno va atrás; se recalcula una vez por segundo.
  const [clockLabel, setClockLabel] = useState<string | null>(null);
  // F05: la barra no se oculta mientras se la está usando — menú de ajustes
  // abierto, foco de teclado adentro o arrastrando la línea de tiempo. Antes
  // el plazo de 3 s la desmontaba en medio de la acción.
  const [menuOpen, setMenuOpen] = useState(false);
  const [keyboardFocusInside, setKeyboardFocusInside] = useState(false);
  const isInteracting = menuOpen || keyboardFocusInside || scrubbing;

  const scheduleHide = useCallback(() => {
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    if (!isPlaying || isInteracting) {
      setControlsVisible(true);
      return;
    }
    hideTimerRef.current = setTimeout(() => setControlsVisible(false), 3000);
  }, [isPlaying, isInteracting]);

  const ensureDvrProbe = useCallback(() => {
    if (latencyMode !== "smooth" || !dvrManifestUrl || dvrProbeInFlightRef.current) return;
    const probe = dvrProbeRef.current;
    if (probe && Date.now() - probe.at < DVR_PROBE_TTL_MS) return;
    dvrProbeInFlightRef.current = true;
    probeDvrDuration(dvrManifestUrl).then((duration) => {
      dvrProbeInFlightRef.current = false;
      if (duration != null) dvrProbeRef.current = { duration, at: Date.now() };
    });
  }, [latencyMode, dvrManifestUrl]);

  const wakeControls = useCallback(() => {
    setControlsVisible(true);
    scheduleHide();
    // Quien mueve el mouse o toca el video probablemente va a usar la barra.
    ensureDvrProbe();
  }, [scheduleHide, ensureDvrProbe]);

  useEffect(() => {
    scheduleHide();
    return () => {
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    };
  }, [scheduleHide]);

  useEffect(() => {
    if (bufferTimerRef.current) {
      clearTimeout(bufferTimerRef.current);
      bufferTimerRef.current = null;
    }
    if (isBuffering) {
      bufferTimerRef.current = setTimeout(() => setShowBufferingSpinner(true), 1500);
    } else {
      setShowBufferingSpinner(false);
    }
    return () => {
      if (bufferTimerRef.current) clearTimeout(bufferTimerRef.current);
    };
  }, [isBuffering]);

  // Un seek manual (barra de "Clase completa") necesita feedback INMEDIATO: el
  // spinner de buffering espera 1.5s a propósito para no parpadear con las
  // micropausas del HLS, pero el evento `seeking` no lo dispara — al soltar la
  // barra quedaban hasta ~2s sin ninguna señal visual y la navegación se
  // sentía trabada. Acá el spinner aparece en el acto y se va con `seeked`.
  useEffect(() => {
    const video = playerRef.current?.video;
    if (!video) return;
    const handleSeeking = () => {
      if (bufferTimerRef.current) {
        clearTimeout(bufferTimerRef.current);
        bufferTimerRef.current = null;
      }
      setShowBufferingSpinner(true);
    };
    const handleSeeked = () => setShowBufferingSpinner(false);
    video.addEventListener("seeking", handleSeeking);
    video.addEventListener("seeked", handleSeeked);
    return () => {
      video.removeEventListener("seeking", handleSeeking);
      video.removeEventListener("seeked", handleSeeked);
    };
  }, [playerRef, latencyMode, mediaKey]);


  // Respaldo para cuando hls.js no expone `liveSyncPosition` (path nativo
  // Safari): aproxima la distancia de sync del perfil activo en LiveHLSPlayer
  // (3 para "low"; 6 para "smooth"/"dvr" = 3 segmentos de 2 s). Con
  // segmentos más largos la distancia real es mayor y se toma de hls.js
  // (`naturalOffset`). Solo define los umbrales del pill: el seek al vivo lo
  // hace `goLive()` del player, con el mismo cálculo.
  const liveSyncOffset = latencyMode === "low" ? 3 : 6;

  // Estado de la línea de tiempo, leído en cada cuadro por LiveTimeline.
  // Clase completa: la ventana navegable real del video. Fluidez: la clase
  // entera según la playlist DVR (estimada con el reloj), con el alumno al
  // final menos lo que se haya atrasado.
  const readTimeline = (): TimelineSnapshot | null => {
    const player = playerRef.current;
    const video = player?.video;
    if (!player || !video || !video.seekable?.length) return null;
    if (latencyMode === "dvr") {
      const range = player.getSeekableRange();
      if (!range) return null;
      const span = Math.max(0, range.end - range.start);
      const position = Math.min(Math.max(0, video.currentTime - range.start), span);
      let bufferedEnd: number | null = null;
      const buffered = video.buffered;
      for (let i = 0; buffered && i < buffered.length; i++) {
        if (buffered.start(i) <= video.currentTime + 0.5 && buffered.end(i) >= video.currentTime) {
          bufferedEnd = buffered.end(i) - range.start;
        }
      }
      return { span, position, bufferedEnd };
    }
    if (latencyMode !== "smooth") return null;
    const probe = dvrProbeRef.current;
    if (!probe) return null;
    const span = probe.duration + (Date.now() - probe.at) / 1000;
    const edge = video.seekable.end(video.seekable.length - 1);
    const sync = player.getLiveSyncPosition?.() ?? edge - liveSyncOffset;
    const behind = Math.max(0, sync - video.currentTime);
    return { span, position: Math.max(0, span - behind), bufferedEnd: null };
  };
  const readTimelineRef = useRef(readTimeline);
  useEffect(() => {
    readTimelineRef.current = readTimeline;
  });

  // Para HLS live, video.duration === Infinity (estándar HTML5). El filo real del
  // vivo se obtiene de video.seekable.end(last) — la ventana DVR que va expandiendo
  // hls.js a medida que llegan segmentos.
  // Corre también en PAUSA: con el video quieto el filo sigue avanzando (hls.js
  // refresca la playlist) y el atraso crece. Antes el polling se cortaba con
  // `!isPlaying` y la barra mostraba un atraso viejo justo al pausar.
  // Fase 2: con la barra oculta no corre. Eran varios re-render por segundo
  // de algo que nadie ve (tirones en Android de gama baja); al mostrarse la
  // barra, se lee en el acto.
  const barVisible = controlsVisible || audioOnly;
  useEffect(() => {
    if (!barVisible) return;
    const tick = () => {
      const video = playerRef.current?.video;
      // Sin muestra válida el offset natural vuelve a 0 en vez de conservar un
      // valor viejo que inflaría los umbrales del pill "Volver al vivo".
      if (!video || !video.seekable.length) { setNaturalOffset(0); return; }
      const liveEdge = video.seekable.end(video.seekable.length - 1);
      const c = video.currentTime;
      if (!isFinite(liveEdge) || !isFinite(c)) { setNaturalOffset(0); return; }
      const delta = liveEdge - c;
      setLiveDelta(delta > 0 ? delta : 0);
      const snap = readTimelineRef.current();
      setClockLabel(
        snap && snap.span - snap.position >= LIVE_SNAP_S ? `${formatClock(snap.position)} / ${formatClock(snap.span)}` : null,
      );
      const syncPosition = playerRef.current?.getLiveSyncPosition?.() ?? null;
      setNaturalOffset(
        syncPosition != null && isFinite(syncPosition) && liveEdge > syncPosition
          ? Math.round(liveEdge - syncPosition)
          : 0,
      );
    };
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [playerRef, latencyMode, mediaKey, barVisible]);

  // Soltar la barra. Cerca del final = volver al vivo. En Fluidez, ir hacia
  // atrás pasa a Clase completa en ese punto (la sala recrea el reproductor).
  const handleTimelineSeek = (position: number, span: number) => {
    const behind = Math.max(0, span - position);
    if (behind < LIVE_SNAP_S) {
      onReturnToLive();
    } else if (latencyMode === "dvr") {
      const range = playerRef.current?.getSeekableRange();
      if (range) playerRef.current?.seekTo(range.start + position);
    } else {
      onRewindFromLive(behind);
    }
    wakeControls();
  };

  // Saltos de teclado y doble toque. En Clase completa, sobre el mismo video;
  // en Fluidez, adelantar no tiene sentido (ya es el vivo) y retroceder pasa
  // a Clase completa a esa distancia del filo.
  const handleSeekBy = useCallback((delta: number) => {
    const player = playerRef.current;
    if (latencyMode === "dvr") {
      player?.seekBy(delta);
      return;
    }
    if (delta >= 0) return;
    const video = player?.video;
    let currentBehind = 0;
    if (video?.seekable?.length) {
      const edge = video.seekable.end(video.seekable.length - 1);
      const sync = player?.getLiveSyncPosition?.() ?? edge - liveSyncOffset;
      currentBehind = Math.max(0, sync - video.currentTime);
    }
    onRewindFromLive(currentBehind - delta);
  }, [playerRef, latencyMode, liveSyncOffset, onRewindFromLive]);

  useEffect(() => {
    const handle = () => {
      const fs =
        document.fullscreenElement ||
        (document as unknown as { webkitFullscreenElement?: Element }).webkitFullscreenElement ||
        (document as unknown as { mozFullScreenElement?: Element }).mozFullScreenElement ||
        (document as unknown as { msFullscreenElement?: Element }).msFullscreenElement;
      setIsFullscreen(Boolean(fs));
      setFullscreenElement(fs instanceof HTMLElement ? fs : null);
    };
    const videoEl = playerRef.current?.video;
    const handleIosFsBegin = () => setIsFullscreen(true);
    const handleIosFsEnd = () => setIsFullscreen(false);

    document.addEventListener("fullscreenchange", handle);
    document.addEventListener("webkitfullscreenchange", handle);
    document.addEventListener("mozfullscreenchange", handle);
    document.addEventListener("MSFullscreenChange", handle);
    if (videoEl) {
      videoEl.addEventListener("webkitbeginfullscreen", handleIosFsBegin);
      videoEl.addEventListener("webkitendfullscreen", handleIosFsEnd);
    }
    return () => {
      document.removeEventListener("fullscreenchange", handle);
      document.removeEventListener("webkitfullscreenchange", handle);
      document.removeEventListener("mozfullscreenchange", handle);
      document.removeEventListener("MSFullscreenChange", handle);
      if (videoEl) {
        videoEl.removeEventListener("webkitbeginfullscreen", handleIosFsBegin);
        videoEl.removeEventListener("webkitendfullscreen", handleIosFsEnd);
      }
    };
  }, [playerRef, mediaKey]);

  useEffect(() => {
    const video = playerRef.current?.video;
    if (!video) return;
    const iosVideo = video as HTMLVideoElement & {
      webkitSupportsPresentationMode?: (mode: string) => boolean;
      webkitPresentationMode?: string;
    };
    const supported =
      (typeof document !== "undefined" && document.pictureInPictureEnabled && !video.disablePictureInPicture) ||
      (typeof iosVideo.webkitSupportsPresentationMode === "function" &&
        iosVideo.webkitSupportsPresentationMode("picture-in-picture"));
    setPipSupported(Boolean(supported));

    const handleEnter = () => setIsPip(true);
    const handleLeave = () => setIsPip(false);
    const handleIosMode = () => setIsPip(iosVideo.webkitPresentationMode === "picture-in-picture");
    video.addEventListener("enterpictureinpicture", handleEnter);
    video.addEventListener("leavepictureinpicture", handleLeave);
    video.addEventListener("webkitpresentationmodechanged", handleIosMode);
    return () => {
      video.removeEventListener("enterpictureinpicture", handleEnter);
      video.removeEventListener("leavepictureinpicture", handleLeave);
      video.removeEventListener("webkitpresentationmodechanged", handleIosMode);
    };
  }, [playerRef, mediaKey]);

  const handlePipToggle = useCallback(async () => {
    const video = playerRef.current?.video;
    if (!video) return;
    const iosVideo = video as HTMLVideoElement & {
      webkitSetPresentationMode?: (mode: string) => void;
      webkitPresentationMode?: string;
    };
    try {
      if (typeof iosVideo.webkitSetPresentationMode === "function" && !document.pictureInPictureEnabled) {
        iosVideo.webkitSetPresentationMode(
          iosVideo.webkitPresentationMode === "picture-in-picture" ? "inline" : "picture-in-picture",
        );
        return;
      }
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
      } else {
        await video.requestPictureInPicture();
      }
    } catch (e) {
      console.warn("[LivePlayerControls] picture-in-picture error:", e);
    }
  }, [playerRef]);

  const handleFullscreenToggle = useCallback(async () => {
    try {
      if (!isFullscreen) {
        await playerRef.current?.enterFullscreen();
        const orientation = (screen as unknown as { orientation?: { lock?: (o: string) => Promise<void> } })
          .orientation;
        if (orientation?.lock) {
          orientation.lock("landscape").catch(() => {});
        }
      } else {
        await playerRef.current?.exitFullscreen();
        const orientation = (screen as unknown as { orientation?: { unlock?: () => void } }).orientation;
        if (orientation?.unlock) {
          try { orientation.unlock(); } catch { /* ignore */ }
        }
      }
    } catch (e) {
      console.warn("[LivePlayerControls] fullscreen error:", e);
    }
  }, [isFullscreen, playerRef]);

  // Cada <video>/<audio> nuevo arranca con el volumen recordado, y la barra
  // lee el volumen del propio elemento: así el ícono y el control nunca dicen
  // otra cosa que lo que suena (teclas del sistema, otro código del player).
  useEffect(() => {
    const media = playerRef.current?.video;
    if (!media) return;
    playerRef.current?.setVolume(readLiveVolume());
    const handleVolume = () => setVolume(media.volume);
    media.addEventListener("volumechange", handleVolume);
    return () => media.removeEventListener("volumechange", handleVolume);
  }, [playerRef, mediaKey]);

  const handleVolumeChange = (e: ChangeEvent<HTMLInputElement>) => {
    const v = parseFloat(e.target.value);
    setVolume(v);
    saveLiveVolume(v);
    if (playerRef.current?.video) {
      playerRef.current.setVolume(v);
      if (v === 0 && !isMuted) onToggleMute();
      if (v > 0 && isMuted) onToggleMute();
    }
    wakeControls();
  };

  // F08: `currentLevel` es la PREFERENCIA (-1 = Auto) y `activeLevel` la que
  // el player usa ahora. Antes eran el mismo estado: cuando el ABR cambiaba
  // de resolución, el selector parecía haber abandonado Auto.
  const activeLabel = levels.find((l) => l.index === activeLevel)?.label;
  const currentLevelLabel =
    currentLevel === -1
      ? activeLabel ? `Auto · ${activeLabel}` : "Auto"
      : levels.find((l) => l.index === currentLevel)?.label || "Auto";

  // Histéresis dura, relativa a la distancia natural al filo del modo activo
  // (la mayor entre el respaldo `liveSyncOffset` y la real de hls.js): el
  // delta natural oscila alrededor de ese valor (6 s con segmentos de 2 s,
  // ~25 s con los de 8 s), así que el pill solo aparece con 2.5x (atraso real
  // visible) y desaparece bajo 1.5x (zona normal). Sin esto, con segmentos
  // largos el pill "Volver al vivo" quedaba fijo y sin efecto, porque volver
  // al vivo lleva a la misma distancia. En modo `low` (offset 3) escalar
  // proporcionalmente daría 7.5s / 4.5s, DENTRO de la banda de jitter normal
  // de 2-7s documentada arriba — el pill flapearía. Por eso hay un piso
  // absoluto: 10s / 5s.
  const effectiveSyncOffset = Math.max(liveSyncOffset, naturalOffset);
  const behindShowThreshold = Math.max(effectiveSyncOffset * 2.5, 10);
  const behindHideThreshold = Math.max(effectiveSyncOffset * 1.5, 5);
  useEffect(() => {
    if (isBehind && liveDelta < behindHideThreshold) setIsBehind(false);
    else if (!isBehind && liveDelta > behindShowThreshold) setIsBehind(true);
  }, [liveDelta, isBehind, behindHideThreshold, behindShowThreshold]);

  // Atajos, solo con el foco DENTRO del reproductor (contenedor del video),
  // como en YouTube: Espacio/K pausa, M sonido, F pantalla completa, flechas
  // ±5 s y J/L ±10 s. Nunca se interceptan campos de texto ni la línea de
  // tiempo, que maneja sus propias flechas; Espacio sobre un botón es la
  // acción de ese botón.
  const shortcutsRef = useRef({ onTogglePlay, onToggleMute, handleFullscreenToggle, handleSeekBy, wakeControls });
  useEffect(() => {
    shortcutsRef.current = { onTogglePlay, onToggleMute, handleFullscreenToggle, handleSeekBy, wakeControls };
  });
  useEffect(() => {
    const container = playerRef.current?.video?.parentElement;
    if (!container) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey) return;
      if (isTypingTarget(e.target)) return;
      // Con el menú de ajustes abierto el teclado es del menú (flechas, letras
      // de búsqueda): los atajos del reproductor no lo tocan.
      if (e.target instanceof Element && e.target.closest('[role="menu"]')) return;
      const actions = shortcutsRef.current;
      const target = e.target instanceof HTMLElement ? e.target : null;
      const isSlider = target?.getAttribute("role") === "slider" || (target instanceof HTMLInputElement && target.type === "range");
      const isButton = target?.tagName === "BUTTON" || Boolean(target?.getAttribute("role")?.startsWith("menuitem"));
      const key = e.key.toLowerCase();
      if (key === " " || key === "k") {
        if (key === " " && (isButton || isSlider)) return;
        e.preventDefault();
        actions.onTogglePlay();
      } else if (key === "m") {
        e.preventDefault();
        actions.onToggleMute();
      } else if (key === "f") {
        e.preventDefault();
        actions.handleFullscreenToggle();
      } else if ((e.key === "ArrowLeft" || e.key === "ArrowRight") && !isSlider) {
        e.preventDefault();
        actions.handleSeekBy(e.key === "ArrowLeft" ? -ARROW_STEP_S : ARROW_STEP_S);
      } else if (key === "j" || key === "l") {
        e.preventDefault();
        actions.handleSeekBy(key === "j" ? -JUMP_STEP_S : JUMP_STEP_S);
      } else {
        return;
      }
      actions.wakeControls();
    };
    container.addEventListener("keydown", handleKeyDown);
    return () => container.removeEventListener("keydown", handleKeyDown);
  }, [playerRef, mediaKey]);

  // Doble toque a los costados (como YouTube en el celular): ±10 s con un
  // destello del lado. El toque simple sigue mostrando la barra (F03).
  const flashSeek = (side: "left" | "right") => {
    setSeekFlash({ side, id: Date.now() });
    window.setTimeout(() => setSeekFlash((f) => (f && Date.now() - f.id >= 550 ? null : f)), 600);
  };
  const handleSurfaceTouch = (clientX: number, rect: DOMRect) => {
    const ratio = rect.width > 0 ? (clientX - rect.left) / rect.width : 0.5;
    const side = ratio < 0.35 ? "left" : ratio > 0.65 ? "right" : "center";
    const now = Date.now();
    const last = lastTapRef.current;
    if (last && side !== "center" && last.side === side && now - last.at < DOUBLE_TAP_MS) {
      lastTapRef.current = null;
      handleSeekBy(side === "left" ? -JUMP_STEP_S : JUMP_STEP_S);
      flashSeek(side);
      return;
    }
    lastTapRef.current = { at: now, side };
  };

  return (
    <>
      {/* Superficie del video. Con mouse o teclado, un clic pausa/reanuda y el
          doble clic es pantalla completa. Con el dedo, un toque muestra los
          controles (antes el mismo toque que buscaba la barra pausaba la
          clase, F03) y el doble toque a los costados salta 10 s.
          `detail === 0` es un clic de teclado, que no pasa por pointerdown. */}
      <button
        type="button"
        onPointerDown={(e) => { lastPointerTypeRef.current = e.pointerType; }}
        onClick={(e) => {
          const isTouch = lastPointerTypeRef.current === "touch" && e.detail !== 0;
          if (isTouch) handleSurfaceTouch(e.clientX, e.currentTarget.getBoundingClientRect());
          else onTogglePlay();
          wakeControls();
        }}
        onDoubleClick={() => {
          if (lastPointerTypeRef.current !== "touch") handleFullscreenToggle();
        }}
        onMouseMove={wakeControls}
        onTouchStart={wakeControls}
        // Llegar con Tab al video también muestra la barra (F05).
        onFocus={wakeControls}
        className="absolute inset-0 z-10 cursor-pointer bg-transparent"
        aria-label={isPlaying ? "Pausar" : "Reproducir"}
      />

      <AnimatePresence>
        {seekFlash && (
          <motion.div
            key={seekFlash.id}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            aria-hidden
            className={cn(
              "pointer-events-none absolute inset-y-0 z-[24] flex w-1/3 items-center justify-center bg-white/10",
              seekFlash.side === "left" ? "left-0 rounded-r-[50%]" : "right-0 rounded-l-[50%]",
            )}
          >
            <span className="flex flex-col items-center gap-1 text-xs font-black text-white">
              {seekFlash.side === "left" ? <ChevronsLeft size={28} /> : <ChevronsRight size={28} />}
              {JUMP_STEP_S} s
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showBufferingSpinner && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="absolute inset-0 z-[25] flex items-center justify-center pointer-events-none"
          >
            <Loader2 size={40} strokeWidth={2.5} className="animate-spin text-accent/80" />
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {!isPlaying && !showBufferingSpinner && (
          <motion.div
            initial={{ opacity: 0, scale: 0.7 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.7 }}
            transition={{ type: "spring", damping: 18, stiffness: 220 }}
            className="absolute inset-0 z-[25] flex items-center justify-center pointer-events-none"
          >
            <div className="p-5 rounded-full bg-black/75 border border-ink/15 shadow-2xl">
              <Play size={36} fill="currentColor" strokeWidth={0} className="text-foreground-strong ml-1" />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {/* Solo audio: la barra no se esconde, no hay imagen que despejar. */}
        {(controlsVisible || audioOnly) && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 16 }}
            transition={{ duration: 0.2 }}
            className="absolute bottom-0 left-0 right-0 z-30 px-3 sm:px-5 pb-3 sm:pb-4 pt-14 bg-gradient-to-t from-black/95 via-black/60 to-transparent pointer-events-none"
            // F05: con foco de TECLADO adentro la barra no se oculta. Solo
            // `:focus-visible` — un clic de mouse también enfoca el botón y,
            // sin este filtro, la barra no se ocultaría nunca más.
            onFocus={(e) => { if (isKeyboardFocus(e.target)) setKeyboardFocusInside(true); }}
            onBlur={(e) => {
              if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setKeyboardFocusInside(false);
            }}
          >
            {/* Línea de tiempo de la clase entera, en los dos modos (como
                YouTube). En Fluidez, ir hacia atrás pasa solo a Clase completa. */}
            {latencyMode !== "low" && (
              <div className="pointer-events-auto mb-1 sm:mb-2">
                <LiveTimeline
                  read={() => readTimelineRef.current()}
                  onSeek={handleTimelineSeek}
                  onActivity={wakeControls}
                  onDraggingChange={setScrubbing}
                />
              </div>
            )}

            <div className="flex items-center gap-1 sm:gap-2 pointer-events-auto">
              <button
                onClick={() => { onTogglePlay(); wakeControls(); }}
                aria-label={isPlaying ? "Pausar" : "Reproducir"}
                className={CONTROL_BUTTON}
              >
                {isPlaying ? <Pause size={22} fill="currentColor" strokeWidth={0} /> : <Play size={22} fill="currentColor" strokeWidth={0} />}
              </button>

              {/* Volumen: el control deslizante se despliega al pasar el mouse. */}
              <div data-audio-control className="group/vol flex items-center">
                <button
                  onClick={() => { onToggleMute(); wakeControls(); }}
                  aria-label={isMuted ? "Activar sonido" : "Silenciar"}
                  className={CONTROL_BUTTON}
                >
                  {isMuted || volume === 0 ? <VolumeX size={20} /> : <Volume2 size={20} />}
                </button>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={isMuted ? 0 : volume}
                  onChange={handleVolumeChange}
                  className="hidden sm:block w-0 opacity-0 group-hover/vol:w-20 group-hover/vol:opacity-100 focus-visible:w-20 focus-visible:opacity-100 transition-all duration-200 accent-gold cursor-pointer"
                  aria-label="Volumen"
                />
              </div>

              {/* EN VIVO como YouTube: rojo cuando estás al día; gris cuando vas
                  atrás, y entonces es el botón para volver. Sin texto extra: el
                  atraso se lee en el reloj de al lado y en la barra. */}
              <button
                type="button"
                onClick={() => { onReturnToLive(); wakeControls(); }}
                aria-label={isBehind ? `Volver al vivo (estás ${spokenClock(liveDelta)} detrás del directo)` : "En vivo"}
                className={cn(
                  "flex shrink-0 items-center gap-1.5 min-h-11 -my-2 px-2 rounded-full whitespace-nowrap text-[11px] sm:text-xs font-black tracking-widest transition-colors cursor-pointer active:scale-95 hover:bg-ink/15",
                  isBehind ? "text-fg-80" : "text-foreground-strong",
                )}
              >
                <span className="relative flex w-2 h-2">
                  {!isBehind && <span className="absolute inset-0 rounded-full bg-red-500 animate-ping opacity-75" />}
                  <span className={cn("relative w-2 h-2 rounded-full", isBehind ? "bg-fg-50" : "bg-red-500")} />
                </span>
                <span>EN VIVO</span>
              </button>

              {clockLabel && (
                <span className="hidden min-[400px]:inline text-[11px] sm:text-xs font-bold tabular-nums text-fg-70 whitespace-nowrap">
                  {clockLabel}
                </span>
              )}

              <div className="flex-1" />

              {/* Calidad: dentro de la barra, como el engranaje de YouTube. */}
              <DropdownMenu onOpenChange={(open) => { setMenuOpen(open); if (open) wakeControls(); }}>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    aria-label="Ajustes"
                    className={cn(CONTROL_BUTTON, "w-auto gap-1 px-2")}
                  >
                    <Settings size={20} />
                    <span className="hidden sm:inline text-[11px] font-black tabular-nums text-fg-70">
                      {audioOnly ? "Solo audio" : currentLevelLabel}
                    </span>
                  </button>
                </DropdownMenuTrigger>
                {/* Se portalea al body, fuera de la isla del escenario: el contexto oscuro
                    se declara aquí explícitamente (spec §4.4). */}
                <DropdownMenuContent
                  container={fullscreenElement}
                  data-theme="dark"
                  align="end"
                  side="top"
                  className="min-w-[160px] bg-surface-page border-line-subtle"
                >
                  {onToggleAudioOnly && (
                    <>
                      <DropdownMenuItem
                        onClick={() => { onToggleAudioOnly(); wakeControls(); }}
                        className="cursor-pointer items-start gap-2.5 py-2"
                      >
                        {audioOnly ? <Video size={16} className="mt-0.5 shrink-0" /> : <Headphones size={16} className="mt-0.5 shrink-0 text-accent" />}
                        <span className="flex flex-col">
                          <span className="font-bold">{audioOnly ? "Volver al video" : "Solo audio"}</span>
                          {!audioOnly && (
                            <span className="text-[11px] text-foreground-muted">Sigue sonando con la pantalla apagada</span>
                          )}
                        </span>
                      </DropdownMenuItem>
                      {!audioOnly && <DropdownMenuSeparator />}
                    </>
                  )}
                  {!audioOnly && (
                  <>
                  <DropdownMenuLabel className="text-xs text-foreground-muted uppercase tracking-wider">
                    Calidad
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => { onSelectLevel(-1); wakeControls(); }}
                    className={cn("cursor-pointer", currentLevel === -1 && "text-accent")}
                  >
                    <span className="flex-1">{activeLabel ? `Auto (${activeLabel})` : "Auto"}</span>
                    {currentLevel === -1 && <Check size={14} className="text-accent" />}
                  </DropdownMenuItem>
                  {levels.length === 0 ? (
                    <DropdownMenuItem disabled className="text-foreground-muted text-xs italic">
                      Sin otras calidades disponibles
                    </DropdownMenuItem>
                  ) : (
                    [...levels]
                      .sort((a, b) => b.height - a.height)
                      .map((lvl) => (
                        <DropdownMenuItem
                          key={lvl.index}
                          onClick={() => { onSelectLevel(lvl.index); wakeControls(); }}
                          className={cn("cursor-pointer", currentLevel === lvl.index && "text-accent")}
                        >
                          <span className="flex-1">{lvl.label}</span>
                          {currentLevel === lvl.index && <Check size={14} className="text-accent" />}
                        </DropdownMenuItem>
                      ))
                  )}
                  </>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>

              {/* "Segundo plano" con texto visible: el ícono solo de picture-in-picture
                  no lo reconocía nadie, y es justo lo que buscan los alumnos que
                  reportaban que el vivo "no funciona en segundo plano" (Chrome pausa
                  cualquier <video> de una pestaña oculta; la ventana flotante es la
                  única forma de seguir escuchando con otra app o la pantalla
                  bloqueada). En celular el texto va en dos líneas para no
                  desbordar la barra. */}
              {pipSupported && !audioOnly && (
                <button
                  type="button"
                  onClick={() => { handlePipToggle(); wakeControls(); }}
                  aria-label={
                    isPip
                      ? "Volver a ver aquí"
                      : "Segundo plano: seguir viendo en una ventana flotante mientras usas otra app"
                  }
                  className={cn(
                    "inline-flex flex-col sm:flex-row items-center justify-center gap-0.5 sm:gap-1.5 min-h-11 -my-2 px-1.5 sm:px-3 rounded-full transition-colors cursor-pointer active:scale-95",
                    isPip
                      ? "text-accent bg-accent/15 hover:bg-accent/25"
                      : "text-foreground-strong hover:bg-ink/15",
                  )}
                >
                  <PictureInPicture2 className="shrink-0 size-4 sm:size-[18px]" />
                  <span className="text-[9px] sm:text-xs font-black uppercase tracking-wide leading-[1.1] text-center sm:text-left">
                    {isPip ? (
                      "Volver"
                    ) : (
                      <>
                        Segundo<br className="sm:hidden" /> plano
                      </>
                    )}
                  </span>
                </button>
              )}

              {!audioOnly && (
                <button
                  onClick={() => { handleFullscreenToggle(); wakeControls(); }}
                  aria-label={isFullscreen ? "Salir de pantalla completa" : "Pantalla completa"}
                  className={CONTROL_BUTTON}
                >
                  {isFullscreen ? <Minimize size={20} /> : <Maximize size={20} />}
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default LivePlayerControls;
