import { useEffect, useState, useCallback, useRef, type RefObject, type ChangeEvent } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Play, Pause, Volume2, VolumeX, Maximize, Minimize, Loader2, Settings, Check, PictureInPicture2, RotateCcw, RotateCw } from "lucide-react";
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { formatClock, spokenClock } from "@/lib/live/playerTime";
import type { LiveHLSPlayerHandle, LiveLatencyMode, QualityLevel } from "./LiveHLSPlayer";

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

/** Salto de los botones y flechas de "Clase completa". */
const SEEK_STEP_S = 10;

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
  latencyMode: LiveLatencyMode;
  /**
   * Cambia cuando "Reintentar" remonta el <video>. Los listeners de la barra
   * se vuelven a enganchar al nodo nuevo: con `[playerRef]` solo, quedaban
   * escuchando al video destruido (timeline, seek, fullscreen y PiP mudos).
   */
  mediaKey?: number;
  onTogglePlay: () => void;
  onToggleMute: () => void;
  onSelectLevel: (index: number) => void;
  onSelectLatencyMode: (mode: LiveLatencyMode) => void;
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
  mediaKey = 0,
  onTogglePlay,
  onToggleMute,
  onSelectLevel,
  onSelectLatencyMode,
}: LivePlayerControlsProps) => {
  const [controlsVisible, setControlsVisible] = useState(true);
  const [volume, setVolume] = useState(1);
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
  // Timeline del modo "dvr": posición actual + ventana seekable (crece con la
  // transmisión). Throttleado a ~500ms vía un timestamp en ref — reusa el
  // 'timeupdate' nativo del <video> en vez de armar un setInterval propio.
  const [dvrCurrentTime, setDvrCurrentTime] = useState(0);
  const [dvrRange, setDvrRange] = useState<{ start: number; end: number } | null>(null);
  const lastDvrUpdateRef = useRef(0);
  // Scrubbing tipo YouTube: mientras el usuario arrastra SOLO se mueve el
  // indicador (estado local). El seek real se hace una sola vez al soltar.
  const [scrubValue, setScrubValue] = useState<number | null>(null);
  // F05: la barra no se oculta mientras se la está usando — menú de ajustes
  // abierto, foco de teclado adentro o arrastrando la línea de tiempo. Antes
  // el plazo de 3 s la desmontaba en medio de la acción.
  const [menuOpen, setMenuOpen] = useState(false);
  const [keyboardFocusInside, setKeyboardFocusInside] = useState(false);
  const isInteracting = menuOpen || keyboardFocusInside || scrubValue !== null;

  const scheduleHide = useCallback(() => {
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    if (!isPlaying || isInteracting) {
      setControlsVisible(true);
      return;
    }
    hideTimerRef.current = setTimeout(() => setControlsVisible(false), 3000);
  }, [isPlaying, isInteracting]);

  const wakeControls = useCallback(() => {
    setControlsVisible(true);
    scheduleHide();
  }, [scheduleHide]);

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

  // Para HLS live, video.duration === Infinity (estándar HTML5). El filo real del
  // vivo se obtiene de video.seekable.end(last) — la ventana DVR que va expandiendo
  // hls.js a medida que llegan segmentos.
  // Corre también en PAUSA: con el video quieto el filo sigue avanzando (hls.js
  // refresca la playlist) y el atraso crece. Antes el polling se cortaba con
  // `!isPlaying` y la barra mostraba un atraso viejo justo al pausar.
  useEffect(() => {
    const interval = setInterval(() => {
      const video = playerRef.current?.video;
      // Sin muestra válida el offset natural vuelve a 0 en vez de conservar un
      // valor viejo que inflaría los umbrales del pill "Volver al vivo".
      if (!video || !video.seekable.length) { setNaturalOffset(0); return; }
      const liveEdge = video.seekable.end(video.seekable.length - 1);
      const c = video.currentTime;
      if (!isFinite(liveEdge) || !isFinite(c)) { setNaturalOffset(0); return; }
      const delta = liveEdge - c;
      setLiveDelta(delta > 0 ? delta : 0);
      // En pausa no hay `timeupdate`: la ventana de la timeline se refresca acá.
      if (video.paused && latencyMode === "dvr") {
        setDvrCurrentTime(c);
        setDvrRange(playerRef.current?.getSeekableRange?.() ?? null);
      }
      const syncPosition = playerRef.current?.getLiveSyncPosition?.() ?? null;
      setNaturalOffset(
        syncPosition != null && isFinite(syncPosition) && liveEdge > syncPosition
          ? Math.round(liveEdge - syncPosition)
          : 0,
      );
    }, 1000);
    return () => clearInterval(interval);
  }, [playerRef, latencyMode, mediaKey]);

  // Respaldo para cuando hls.js no expone `liveSyncPosition` (path nativo
  // Safari): aproxima la distancia de sync del perfil activo en LiveHLSPlayer
  // (3 para "low"; 6 para "smooth"/"dvr" = 3 segmentos de 2 s). Con
  // segmentos más largos la distancia real es mayor y se toma de hls.js
  // (`naturalOffset`). Solo define los umbrales del pill: el seek al vivo lo
  // hace `goLive()` del player, con el mismo cálculo.
  const liveSyncOffset = latencyMode === "low" ? 3 : 6;

  // Timeline del modo "dvr": actualiza posición + ventana seekable en cada
  // 'timeupdate' del <video>, throttleado a ~500ms.
  useEffect(() => {
    if (latencyMode !== "dvr") return;
    const video = playerRef.current?.video;
    if (!video) return;
    const handleTimeUpdate = () => {
      const now = Date.now();
      if (now - lastDvrUpdateRef.current < 500) return;
      lastDvrUpdateRef.current = now;
      setDvrCurrentTime(video.currentTime);
      setDvrRange(playerRef.current?.getSeekableRange?.() ?? null);
    };
    video.addEventListener("timeupdate", handleTimeUpdate);
    handleTimeUpdate();
    return () => video.removeEventListener("timeupdate", handleTimeUpdate);
  }, [latencyMode, playerRef, mediaKey]);

  // `scrubValue` (declarado arriba): antes se llamaba a `seekTo` en cada
  // `change` del range — un arrastre disparaba decenas de seeks y cada uno
  // tira el buffer y vuelve a pedir fragmentos, de ahí los tirones.
  const handleDvrScrub = (e: ChangeEvent<HTMLInputElement>) => {
    setScrubValue(parseFloat(e.target.value));
    wakeControls();
  };

  const commitDvrScrub = () => {
    if (scrubValue === null || !dvrRange) return;
    playerRef.current?.seekTo(dvrRange.start + scrubValue);
    setScrubValue(null);
    wakeControls();
  };

  // Escape o un gesto cancelado por el sistema descartan el arrastre: el
  // indicador vuelve a la posición real sin hacer ningún seek.
  const cancelDvrScrub = () => {
    if (scrubValue === null) return;
    setScrubValue(null);
    wakeControls();
  };

  // Misma operación que el aviso "Retomamos donde lo dejaste" (ver goLive).
  const handleGoLive = useCallback(() => {
    playerRef.current?.goLive();
  }, [playerRef]);

  const handleSeekBy = useCallback((delta: number) => {
    playerRef.current?.seekBy(delta);
  }, [playerRef]);

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

  const handleVolumeChange = (e: ChangeEvent<HTMLInputElement>) => {
    const v = parseFloat(e.target.value);
    setVolume(v);
    const video = playerRef.current?.video;
    if (video) {
      video.volume = v;
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

  // Atajos, solo con el foco DENTRO del reproductor (contenedor del video):
  // Espacio/K pausa, M sonido, F pantalla completa y flechas ±10 s en "Clase
  // completa". Nunca se interceptan campos de texto ni la barra de tiempo, que
  // ya responde a las flechas por sí misma; Espacio sobre un botón es la
  // acción de ese botón.
  const shortcutsRef = useRef({ onTogglePlay, onToggleMute, handleFullscreenToggle, handleSeekBy, latencyMode, wakeControls });
  useEffect(() => {
    shortcutsRef.current = { onTogglePlay, onToggleMute, handleFullscreenToggle, handleSeekBy, latencyMode, wakeControls };
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
      const isRange = target instanceof HTMLInputElement && target.type === "range";
      const isButton = target?.tagName === "BUTTON" || Boolean(target?.getAttribute("role")?.startsWith("menuitem"));
      const key = e.key.toLowerCase();
      if (key === " " || key === "k") {
        if (key === " " && (isButton || isRange)) return;
        e.preventDefault();
        actions.onTogglePlay();
      } else if (key === "m") {
        e.preventDefault();
        actions.onToggleMute();
      } else if (key === "f") {
        e.preventDefault();
        actions.handleFullscreenToggle();
      } else if ((e.key === "ArrowLeft" || e.key === "ArrowRight") && !isRange && actions.latencyMode === "dvr") {
        e.preventDefault();
        actions.handleSeekBy(e.key === "ArrowLeft" ? -SEEK_STEP_S : SEEK_STEP_S);
      } else {
        return;
      }
      actions.wakeControls();
    };
    container.addEventListener("keydown", handleKeyDown);
    return () => container.removeEventListener("keydown", handleKeyDown);
  }, [playerRef, mediaKey]);

  const dvrSpan = dvrRange ? Math.max(0, dvrRange.end - dvrRange.start) : 0;
  const dvrPosition = dvrRange
    ? scrubValue ?? Math.min(Math.max(0, dvrCurrentTime - dvrRange.start), dvrSpan)
    : 0;
  const dvrBehind = Math.max(0, dvrSpan - dvrPosition);

  return (
    <>
      {/* Superficie del video. Con mouse o teclado, un clic pausa/reanuda.
          Con el dedo solo muestra los controles: antes el mismo toque que
          buscaba la barra pausaba la clase (F03); pausar queda en la barra.
          `detail === 0` es un clic de teclado, que no pasa por pointerdown. */}
      <button
        type="button"
        onPointerDown={(e) => { lastPointerTypeRef.current = e.pointerType; }}
        onClick={(e) => {
          const isTouch = lastPointerTypeRef.current === "touch" && e.detail !== 0;
          if (!isTouch) onTogglePlay();
          wakeControls();
        }}
        onMouseMove={wakeControls}
        onTouchStart={wakeControls}
        // Llegar con Tab al video también muestra la barra (F05).
        onFocus={wakeControls}
        className="absolute inset-0 z-10 cursor-pointer bg-transparent"
        aria-label={isPlaying ? "Pausar" : "Reproducir"}
      />

      {/* Selector de calidad — FLOTANTE y SIEMPRE visible. Vive fuera de la barra
          que se auto-oculta, así el usuario lo encuentra sin necesidad de hovereár
          el video. Posicionado bottom-right por encima del bar. */}
      <DropdownMenu onOpenChange={(open) => { setMenuOpen(open); if (open) wakeControls(); }}>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            aria-label="Calidad de video"
            className="absolute right-3 sm:right-5 bottom-16 sm:bottom-20 z-[32] flex items-center gap-1.5 px-2.5 py-1.5 rounded-full bg-black/60 backdrop-blur-md border border-ink/15 text-fg-90 hover:text-accent hover:bg-black/80 active:scale-95 transition-all pointer-events-auto shadow-lg"
          >
            <Settings size={16} />
            <span className="text-[10px] sm:text-xs font-black tracking-wider tabular-nums">{currentLevelLabel}</span>
          </button>
        </DropdownMenuTrigger>
        {/* Se portalea al body, fuera de la isla del escenario: el contexto oscuro
            se declara aquí explícitamente (spec §4.4). */}
        <DropdownMenuContent
          container={fullscreenElement}
          data-theme="dark"
          align="end"
          side="top"
          className="min-w-[160px] bg-surface-page/95 backdrop-blur-xl border-line-subtle"
        >
          <DropdownMenuLabel className="text-xs text-foreground-muted uppercase tracking-wider">
            Calidad
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={() => { onSelectLevel(-1); wakeControls(); }}
            className={cn("cursor-pointer", currentLevel === -1 && "text-accent")}
          >
            <span className="flex-1">Auto</span>
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

          <DropdownMenuSeparator />
          {/* Modo de clase: qué se puede hacer con el tiempo. No confundir con
              "Volver al vivo" (posición dentro del modo) ni con pantalla
              completa (tamaño): son tres acciones distintas. */}
          <DropdownMenuLabel className="text-xs text-foreground-muted uppercase tracking-wider">
            Modo de clase
          </DropdownMenuLabel>
          <DropdownMenuItem
            onClick={() => { onSelectLatencyMode("dvr"); wakeControls(); }}
            className={cn("cursor-pointer items-start", latencyMode === "dvr" && "text-accent")}
          >
            <span className="flex-1 flex flex-col">
              <span>Clase completa</span>
              <span className="text-[11px] text-foreground-muted">Puedes retroceder y retomar</span>
            </span>
            {latencyMode === "dvr" && <Check size={14} className="text-accent mt-0.5" />}
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => { onSelectLatencyMode("smooth"); wakeControls(); }}
            className={cn("cursor-pointer items-start", latencyMode === "smooth" && "text-accent")}
          >
            <span className="flex-1 flex flex-col">
              <span>Clase normal · Fluidez</span>
              <span className="text-[11px] text-foreground-muted">Siempre en el directo</span>
            </span>
            {latencyMode === "smooth" && <Check size={14} className="text-accent mt-0.5" />}
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => { onSelectLatencyMode("low"); wakeControls(); }}
            className={cn("cursor-pointer items-start", latencyMode === "low" && "text-accent")}
          >
            <span className="flex-1 flex flex-col">
              <span>Baja latencia</span>
              <span className="text-[11px] text-foreground-muted">Menos retraso, necesita buena red</span>
            </span>
            {latencyMode === "low" && <Check size={14} className="text-accent mt-0.5" />}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

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
            <div className="p-5 rounded-full bg-black/60 backdrop-blur-md border border-ink/15 shadow-2xl">
              <Play size={36} fill="currentColor" strokeWidth={0} className="text-foreground-strong ml-1" />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {controlsVisible && (
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
            {/* Timeline — solo modo "dvr". Sin esto en smooth/low, que no tienen
                una ventana seekable usable para un scrubber. */}
            {latencyMode === "dvr" && dvrRange && (
              <div className="flex items-center gap-2 sm:gap-3 pointer-events-auto mb-2 sm:mb-3">
                <span className="text-[10px] sm:text-xs font-black tabular-nums text-foreground-strong/80 shrink-0">
                  {formatClock(dvrPosition)}
                </span>
                <input
                  type="range"
                  min={0}
                  max={dvrSpan}
                  step={1}
                  value={dvrPosition}
                  onChange={handleDvrScrub}
                  onPointerUp={commitDvrScrub}
                  onPointerCancel={cancelDvrScrub}
                  onKeyUp={(e) => { if (e.key !== "Escape") commitDvrScrub(); }}
                  onKeyDown={(e) => {
                    if (e.key === "Escape" && scrubValue !== null) {
                      e.preventDefault();
                      cancelDvrScrub();
                    }
                  }}
                  onBlur={commitDvrScrub}
                  onMouseDown={wakeControls}
                  onTouchStart={wakeControls}
                  className="flex-1 accent-gold cursor-pointer"
                  aria-label="Posición en la clase"
                  aria-valuetext={
                    dvrBehind < 1
                      ? `${spokenClock(dvrPosition)} de ${spokenClock(dvrSpan)}, en el directo`
                      : `${spokenClock(dvrPosition)} de ${spokenClock(dvrSpan)}, ${spokenClock(dvrBehind)} detrás del directo`
                  }
                />
                <span className="text-[10px] sm:text-xs font-black tabular-nums text-foreground-strong/80 shrink-0">
                  {formatClock(dvrSpan)}
                </span>
              </div>
            )}

            <div className="flex items-center gap-1 sm:gap-3 pointer-events-auto">
              <button
                onClick={() => { onTogglePlay(); wakeControls(); }}
                aria-label={isPlaying ? "Pausar" : "Reproducir"}
                className={CONTROL_BUTTON}
              >
                {isPlaying ? <Pause size={22} fill="currentColor" strokeWidth={0} /> : <Play size={22} fill="currentColor" strokeWidth={0} />}
              </button>

              {latencyMode === "dvr" && (
                <>
                  <button
                    type="button"
                    onClick={() => { handleSeekBy(-SEEK_STEP_S); wakeControls(); }}
                    aria-label={`Retroceder ${SEEK_STEP_S} segundos`}
                    // Bajo 360 px no entra junto a "AL VIVO −13:20": quedan la barra
                    // de tiempo y las flechas del teclado.
                    className={cn(CONTROL_BUTTON, "hidden min-[360px]:inline-flex")}
                  >
                    <RotateCcw size={20} />
                  </button>
                  <button
                    type="button"
                    onClick={() => { handleSeekBy(SEEK_STEP_S); wakeControls(); }}
                    aria-label={`Adelantar ${SEEK_STEP_S} segundos`}
                    className={cn(CONTROL_BUTTON, "hidden min-[400px]:inline-flex")}
                  >
                    <RotateCw size={20} />
                  </button>
                </>
              )}

              <div className="flex items-center gap-2">
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
                  className="hidden sm:block w-20 accent-gold cursor-pointer"
                  aria-label="Volumen"
                />
              </div>

              {/* F43: al filo es un indicador ("EN VIVO", rojo con pulso); con
                  atraso es una ACCIÓN ("Volver al vivo", sin pulso ni rojo).
                  Antes siempre decía EN VIVO y el atraso era un sufijo `-12s`
                  con la explicación en un `title`, que en touch no existe. */}
              <button
                type="button"
                onClick={() => { handleGoLive(); wakeControls(); }}
                aria-label={isBehind ? `Volver al vivo (estás ${spokenClock(liveDelta)} detrás del directo)` : "En vivo"}
                className={cn(
                  "flex shrink-0 items-center gap-1.5 sm:gap-2 ml-1 min-h-11 -my-2 px-2 rounded-full whitespace-nowrap text-[10px] sm:text-xs font-black tracking-widest transition-colors cursor-pointer active:scale-95",
                  isBehind
                    ? "text-foreground-strong bg-ink/15 hover:bg-ink/25"
                    : "text-red-500 hover:text-danger"
                )}
              >
                {isBehind ? (
                  <>
                    {/* Bajo 360 px el punto no entra con un atraso de horas (−1:02:15). */}
                    <span className="hidden min-[360px]:block w-2 h-2 rounded-full bg-fg-60" />
                    {/* En celular "VOLVER AL VIVO -1:30" se partía en dos renglones
                        (medido: 320/360/375 px). La pill gris ya comunica que es una
                        acción; el aria-label mantiene la frase completa. */}
                    <span className="sm:hidden">AL VIVO</span>
                    <span className="hidden sm:inline">VOLVER AL VIVO</span>
                    <span className="font-bold text-fg-70 tabular-nums">−{formatClock(liveDelta)}</span>
                  </>
                ) : (
                  <>
                    <span className="relative flex w-2 h-2">
                      <span className="absolute inset-0 rounded-full bg-red-500 animate-ping opacity-75" />
                      <span className="relative w-2 h-2 rounded-full bg-red-500" />
                    </span>
                    <span>EN VIVO</span>
                  </>
                )}
              </button>

              <div className="flex-1" />

              {/* "Segundo plano" con texto visible: el ícono solo de picture-in-picture
                  no lo reconocía nadie, y es justo lo que buscan los alumnos que
                  reportaban que el vivo "no funciona en segundo plano" (Chrome pausa
                  cualquier <video> de una pestaña oculta; la ventana flotante es la
                  única forma de seguir escuchando con otra app o la pantalla
                  bloqueada). En celular el texto va en dos líneas para no
                  desbordar la barra junto a "VOLVER AL VIVO". */}
              {pipSupported && (
                <button
                  type="button"
                  onClick={() => { handlePipToggle(); wakeControls(); }}
                  aria-label={
                    isPip
                      ? "Volver a ver aquí"
                      : "Segundo plano: seguir viendo en una ventana flotante mientras usas otra app"
                  }
                  className={cn(
                    // Celular: ícono arriba y etiqueta debajo (2 líneas) — medido en
                    // 360/375/390 px junto a "AL VIVO -1:30" sin partir ni desbordar.
                    // sm+: ícono y etiqueta en una sola línea.
                    "inline-flex flex-col sm:flex-row items-center justify-center gap-0.5 sm:gap-1.5 min-h-11 -my-2 px-1.5 sm:px-3 rounded-full sm:rounded-full transition-colors cursor-pointer active:scale-95",
                    isPip
                      ? "text-accent bg-accent/15 hover:bg-accent/25"
                      : "text-foreground-strong bg-ink/15 hover:bg-ink/25",
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

              <button
                onClick={() => { handleFullscreenToggle(); wakeControls(); }}
                aria-label={isFullscreen ? "Salir de pantalla completa" : "Pantalla completa"}
                className={CONTROL_BUTTON}
              >
                {isFullscreen ? <Minimize size={20} /> : <Maximize size={20} />}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default LivePlayerControls;
