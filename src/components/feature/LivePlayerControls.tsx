import { useEffect, useState, useCallback, useRef, type RefObject, type ChangeEvent } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Play, Pause, Volume2, VolumeX, Maximize, Minimize, Loader2, Settings, Check, PictureInPicture2 } from "lucide-react";
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import type { LiveHLSPlayerHandle, LiveLatencyMode, QualityLevel } from "./LiveHLSPlayer";

interface LivePlayerControlsProps {
  playerRef: RefObject<LiveHLSPlayerHandle | null>;
  isPlaying: boolean;
  isBuffering: boolean;
  isMuted: boolean;
  levels: QualityLevel[];
  currentLevel: number;
  latencyMode: LiveLatencyMode;
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
  latencyMode,
  onTogglePlay,
  onToggleMute,
  onSelectLevel,
  onSelectLatencyMode,
}: LivePlayerControlsProps) => {
  const [controlsVisible, setControlsVisible] = useState(true);
  const [volume, setVolume] = useState(1);
  const [isFullscreen, setIsFullscreen] = useState(false);
  // Picture-in-Picture: la única forma de que el video siga sonando en Android
  // cuando el usuario cambia de app o bloquea el teléfono (Chrome pausa
  // cualquier <video> de una pestaña oculta). iOS Safari usa su API propia.
  const [isPip, setIsPip] = useState(false);
  const [pipSupported, setPipSupported] = useState(false);
  const [liveDelta, setLiveDelta] = useState(0);
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
  const bufferTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const scheduleHide = useCallback(() => {
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    if (!isPlaying) {
      setControlsVisible(true);
      return;
    }
    hideTimerRef.current = setTimeout(() => setControlsVisible(false), 3000);
  }, [isPlaying]);

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

  // Para HLS live, video.duration === Infinity (estándar HTML5). El filo real del
  // vivo se obtiene de video.seekable.end(last) — la ventana DVR que va expandiendo
  // hls.js a medida que llegan segmentos.
  useEffect(() => {
    if (!isPlaying) return;
    const interval = setInterval(() => {
      const video = playerRef.current?.video;
      if (!video || !video.seekable.length) return;
      const liveEdge = video.seekable.end(video.seekable.length - 1);
      const c = video.currentTime;
      if (!isFinite(liveEdge) || !isFinite(c)) return;
      const delta = liveEdge - c;
      setLiveDelta(delta > 0 ? delta : 0);
    }, 1000);
    return () => clearInterval(interval);
  }, [isPlaying, playerRef]);

  // Debe coincidir con `liveSyncDuration` del perfil activo en LiveHLSPlayer
  // (3 para "low", 8 para "normal"/"smooth"). Un valor fijo hacía que el botón
  // "EN VIVO" empeorara el retraso en modo `low`.
  const liveSyncOffset = latencyMode === "low" ? 3 : 8;

  const handleGoLive = useCallback(() => {
    const video = playerRef.current?.video;
    if (!video || !video.seekable.length) return;
    try {
      // Modo "low": hls.js calcula `liveSyncPosition` a partir de
      // PART-HOLD-BACK del manifest LL-HLS — más preciso que restar un
      // offset fijo al edge. Si no está disponible (path nativo Safari, o
      // modo "smooth" sin instancia relevante) caemos al cálculo anterior.
      const syncPosition = playerRef.current?.getLiveSyncPosition?.() ?? null;
      if (syncPosition != null && isFinite(syncPosition)) {
        video.currentTime = syncPosition;
      } else {
        const liveEdge = video.seekable.end(video.seekable.length - 1);
        if (!isFinite(liveEdge)) return;
        // Volver al filo del vivo SIN romper el buffer: nos paramos a
        // `liveSyncOffset` del edge, coincidiendo con liveSyncDuration del modo
        // activo. Evita el latigazo de seek a una zona sin pre-cargar.
        video.currentTime = Math.max(0, liveEdge - liveSyncOffset);
      }
      if (video.paused) {
        video.play().catch(() => {});
      }
    } catch (e) {
      console.warn("[LivePlayerControls] go live error:", e);
    }
  }, [playerRef, liveSyncOffset]);

  useEffect(() => {
    const handle = () => {
      const fs =
        document.fullscreenElement ||
        (document as unknown as { webkitFullscreenElement?: Element }).webkitFullscreenElement ||
        (document as unknown as { mozFullScreenElement?: Element }).mozFullScreenElement ||
        (document as unknown as { msFullscreenElement?: Element }).msFullscreenElement;
      setIsFullscreen(Boolean(fs));
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
  }, [playerRef]);

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
  }, [playerRef]);

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

  const currentLevelLabel =
    currentLevel === -1
      ? "Auto"
      : levels.find((l) => l.index === currentLevel)?.label || "Auto";

  // Histéresis dura, relativa al `liveSyncOffset` del modo activo: con
  // liveSyncDuration:8 el delta natural oscila 6-12s, así que el pill solo
  // aparece si pasa los 20s (atraso real visible) y desaparece bajo 12s (zona
  // normal) — sin cambios respecto al comportamiento previo. En modo `low`
  // (offset 3) escalar proporcionalmente daría 7.5s / 4.5s, DENTRO de la
  // banda de jitter normal de 2-7s documentada arriba — el pill flapearía.
  // Por eso hay un piso absoluto: 10s / 5s.
  const behindShowThreshold = Math.max(liveSyncOffset * 2.5, 10);
  const behindHideThreshold = Math.max(liveSyncOffset * 1.5, 5);
  useEffect(() => {
    if (isBehind && liveDelta < behindHideThreshold) setIsBehind(false);
    else if (!isBehind && liveDelta > behindShowThreshold) setIsBehind(true);
  }, [liveDelta, isBehind, behindHideThreshold, behindShowThreshold]);

  return (
    <>
      <button
        type="button"
        onClick={() => { onTogglePlay(); wakeControls(); }}
        onMouseMove={wakeControls}
        onTouchStart={wakeControls}
        className="absolute inset-0 z-10 cursor-pointer bg-transparent"
        aria-label={isPlaying ? "Pausar" : "Reproducir"}
      />

      {/* Selector de calidad — FLOTANTE y SIEMPRE visible. Vive fuera de la barra
          que se auto-oculta, así el usuario lo encuentra sin necesidad de hovereár
          el video. Posicionado bottom-right por encima del bar. */}
      <DropdownMenu onOpenChange={(open) => { if (open) wakeControls(); }}>
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
              Sin renditions adicionales
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
          <DropdownMenuLabel className="text-xs text-foreground-muted uppercase tracking-wider">
            Latencia
          </DropdownMenuLabel>
          <DropdownMenuItem
            onClick={() => { onSelectLatencyMode("smooth"); wakeControls(); }}
            className={cn("cursor-pointer", latencyMode === "smooth" && "text-accent")}
          >
            <span className="flex-1">Fluidez</span>
            {latencyMode === "smooth" && <Check size={14} className="text-accent" />}
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => { onSelectLatencyMode("low"); wakeControls(); }}
            className={cn("cursor-pointer", latencyMode === "low" && "text-accent")}
          >
            <span className="flex-1">Baja latencia</span>
            {latencyMode === "low" && <Check size={14} className="text-accent" />}
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
          >
            <div className="flex items-center gap-3 sm:gap-5 pointer-events-auto">
              <button
                onClick={() => { onTogglePlay(); wakeControls(); }}
                aria-label={isPlaying ? "Pausar" : "Reproducir"}
                className="text-foreground-strong hover:text-accent active:scale-90 transition-all"
              >
                {isPlaying ? <Pause size={22} fill="currentColor" strokeWidth={0} /> : <Play size={22} fill="currentColor" strokeWidth={0} />}
              </button>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => { onToggleMute(); wakeControls(); }}
                  aria-label={isMuted ? "Desmutear" : "Mutear"}
                  className="text-foreground-strong hover:text-accent active:scale-90 transition-all"
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

              <button
                type="button"
                onClick={() => { handleGoLive(); wakeControls(); }}
                aria-label={isBehind ? `Volver al filo del vivo, atrasado ${Math.floor(liveDelta)} segundos` : "Saltar al filo del vivo"}
                title={isBehind ? "Volver al vivo" : "Ya estás al filo del vivo"}
                className="flex items-center gap-1.5 sm:gap-2 ml-1 text-red-500 hover:text-danger active:scale-95 text-[10px] sm:text-xs font-black tracking-widest transition-colors cursor-pointer"
              >
                <span className="relative flex w-2 h-2">
                  <span className="absolute inset-0 rounded-full bg-red-500 animate-ping opacity-75" />
                  <span className="relative w-2 h-2 rounded-full bg-red-500" />
                </span>
                <span>
                  EN VIVO{isBehind && ` ${liveDelta >= 60 ? `-${Math.floor(liveDelta / 60)}m` : `-${Math.floor(liveDelta)}s`}`}
                </span>
              </button>

              <div className="flex-1" />

              {pipSupported && (
                <button
                  onClick={() => { handlePipToggle(); wakeControls(); }}
                  aria-label={isPip ? "Salir de ventana flotante" : "Ventana flotante (seguir viendo en otra app)"}
                  title={isPip ? "Salir de ventana flotante" : "Ventana flotante"}
                  className={cn(
                    "mr-3 sm:mr-4 hover:text-accent active:scale-90 transition-all",
                    isPip ? "text-accent" : "text-foreground-strong",
                  )}
                >
                  <PictureInPicture2 size={20} />
                </button>
              )}

              <button
                onClick={() => { handleFullscreenToggle(); wakeControls(); }}
                aria-label={isFullscreen ? "Salir de pantalla completa" : "Pantalla completa"}
                className="text-foreground-strong hover:text-accent active:scale-90 transition-all"
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
