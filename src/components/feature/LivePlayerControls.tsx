import { useEffect, useState, useCallback, useRef, type RefObject, type ChangeEvent } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Play, Pause, Volume2, VolumeX, Maximize, Minimize, Loader2 } from "lucide-react";

interface LivePlayerControlsProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  streamRef: RefObject<any>;
  wrapperRef: RefObject<HTMLDivElement | null>;
  isPlaying: boolean;
  isBuffering: boolean;
  isMuted: boolean;
  onTogglePlay: () => void;
  onToggleMute: () => void;
}

const LivePlayerControls = ({
  streamRef,
  wrapperRef,
  isPlaying,
  isBuffering,
  isMuted,
  onTogglePlay,
  onToggleMute,
}: LivePlayerControlsProps) => {
  const [controlsVisible, setControlsVisible] = useState(true);
  const [volume, setVolume] = useState(1);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [liveDelta, setLiveDelta] = useState(0);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Auto-hide controls después de 3s sin interacción (solo cuando se está reproduciendo)
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

  // Tracking del live edge: cuánto está atrasado el usuario respecto al filo del vivo.
  // Poll cada 1s mientras reproduce. duration crece con el manifest HLS;
  // si currentTime queda atrás, hay delay.
  useEffect(() => {
    if (!isPlaying) return;
    const interval = setInterval(() => {
      const player = streamRef.current;
      if (!player) return;
      const d = player.duration;
      const c = player.currentTime;
      if (!isFinite(d) || !isFinite(c) || d <= 0) return;
      const delta = d - c;
      setLiveDelta(delta > 0 ? delta : 0);
    }, 1000);
    return () => clearInterval(interval);
  }, [isPlaying, streamRef]);

  const handleGoLive = useCallback(() => {
    const player = streamRef.current;
    if (!player) return;
    try {
      const d = player.duration;
      if (!isFinite(d) || d <= 0) return;
      player.currentTime = Math.max(0, d - 0.5);
      // Si estaba pausado, también arranca play()
      if (player.paused) {
        const result = player.play();
        if (result && typeof result.catch === "function") result.catch(() => {});
      }
    } catch (e) {
      console.warn("[LivePlayerControls] go live error:", e);
    }
  }, [streamRef]);

  // Sync con el fullscreen del document (cubre tanto API estándar como webkit)
  useEffect(() => {
    const handle = () => {
      const fs = document.fullscreenElement || (document as unknown as { webkitFullscreenElement?: Element }).webkitFullscreenElement;
      setIsFullscreen(Boolean(fs));
    };
    document.addEventListener("fullscreenchange", handle);
    document.addEventListener("webkitfullscreenchange", handle);
    return () => {
      document.removeEventListener("fullscreenchange", handle);
      document.removeEventListener("webkitfullscreenchange", handle);
    };
  }, []);

  const handleFullscreenToggle = useCallback(async () => {
    const el = wrapperRef.current;
    if (!el) return;
    try {
      const isFs = document.fullscreenElement || (document as unknown as { webkitFullscreenElement?: Element }).webkitFullscreenElement;
      if (!isFs) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const req = el.requestFullscreen || (el as any).webkitRequestFullscreen;
        if (req) {
          await req.call(el);
          // Lock landscape en Android. iOS Safari ignora silenciosamente (no soporta lock).
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const orientation = (screen as any).orientation;
          if (orientation && typeof orientation.lock === "function") {
            orientation.lock("landscape").catch(() => {});
          }
        }
      } else {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const exit = document.exitFullscreen || (document as any).webkitExitFullscreen;
        if (exit) await exit.call(document);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const orientation = (screen as any).orientation;
        if (orientation && typeof orientation.unlock === "function") {
          try { orientation.unlock(); } catch { /* ignore */ }
        }
      }
    } catch (e) {
      console.warn("[LivePlayerControls] fullscreen error:", e);
    }
  }, [wrapperRef]);

  const handleVolumeChange = (e: ChangeEvent<HTMLInputElement>) => {
    const v = parseFloat(e.target.value);
    setVolume(v);
    if (streamRef.current) {
      streamRef.current.volume = v;
      if (v === 0 && !isMuted) onToggleMute();
      if (v > 0 && isMuted) onToggleMute();
    }
    wakeControls();
  };

  return (
    <>
      {/* Click overlay invisible — tap-to-pause */}
      <button
        type="button"
        onClick={() => { onTogglePlay(); wakeControls(); }}
        onMouseMove={wakeControls}
        onTouchStart={wakeControls}
        className="absolute inset-0 z-10 cursor-pointer bg-transparent"
        aria-label={isPlaying ? "Pausar" : "Reproducir"}
      />

      {/* Spinner de buffering */}
      <AnimatePresence>
        {isBuffering && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-[25] flex items-center justify-center pointer-events-none"
          >
            <Loader2 size={48} strokeWidth={2} className="animate-spin text-gold" />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Ícono de play central cuando está pausado */}
      <AnimatePresence>
        {!isPlaying && !isBuffering && (
          <motion.div
            initial={{ opacity: 0, scale: 0.7 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.7 }}
            transition={{ type: "spring", damping: 18, stiffness: 220 }}
            className="absolute inset-0 z-[25] flex items-center justify-center pointer-events-none"
          >
            <div className="p-5 rounded-full bg-black/60 backdrop-blur-md border border-white/15 shadow-2xl">
              <Play size={36} fill="currentColor" strokeWidth={0} className="text-white ml-1" />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Barra de controles inferior con gradient */}
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
                className="text-white hover:text-gold active:scale-90 transition-all"
              >
                {isPlaying ? <Pause size={22} fill="currentColor" strokeWidth={0} /> : <Play size={22} fill="currentColor" strokeWidth={0} />}
              </button>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => { onToggleMute(); wakeControls(); }}
                  aria-label={isMuted ? "Desmutear" : "Mutear"}
                  className="text-white hover:text-gold active:scale-90 transition-all"
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

              {liveDelta > 3 ? (
                <button
                  onClick={() => { handleGoLive(); wakeControls(); }}
                  aria-label="Volver al filo del vivo"
                  className="flex items-center gap-1.5 sm:gap-2 ml-1 px-2 py-1 rounded-full border border-white/15 bg-white/5 text-white/70 hover:text-white hover:border-red-500/50 hover:bg-red-500/10 active:scale-95 transition-all"
                >
                  <span className="w-2 h-2 rounded-full bg-white/40" />
                  <span className="text-[10px] sm:text-xs font-black tracking-widest">
                    VOLVER A VIVO {liveDelta >= 60 ? `-${Math.floor(liveDelta / 60)}m` : `-${Math.floor(liveDelta)}s`}
                  </span>
                </button>
              ) : (
                <div className="flex items-center gap-1.5 sm:gap-2 ml-1 text-red-500 text-[10px] sm:text-xs font-black tracking-widest">
                  <span className="relative flex w-2 h-2">
                    <span className="absolute inset-0 rounded-full bg-red-500 animate-ping opacity-75" />
                    <span className="relative w-2 h-2 rounded-full bg-red-500" />
                  </span>
                  EN VIVO
                </div>
              )}

              <div className="flex-1" />

              <button
                onClick={() => { handleFullscreenToggle(); wakeControls(); }}
                aria-label={isFullscreen ? "Salir de pantalla completa" : "Pantalla completa"}
                className="text-white hover:text-gold active:scale-90 transition-all"
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
