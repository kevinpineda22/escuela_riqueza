import { useEffect, useState, useCallback, useRef, type RefObject, type ChangeEvent } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Play, Pause, Volume2, VolumeX, Maximize, Minimize, Loader2, Settings, Check } from "lucide-react";
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import type { LiveHLSPlayerHandle, QualityLevel } from "./LiveHLSPlayer";

interface LivePlayerControlsProps {
  playerRef: RefObject<LiveHLSPlayerHandle | null>;
  isPlaying: boolean;
  isBuffering: boolean;
  isMuted: boolean;
  levels: QualityLevel[];
  currentLevel: number;
  onTogglePlay: () => void;
  onToggleMute: () => void;
  onSelectLevel: (index: number) => void;
}

const LivePlayerControls = ({
  playerRef,
  isPlaying,
  isBuffering,
  isMuted,
  levels,
  currentLevel,
  onTogglePlay,
  onToggleMute,
  onSelectLevel,
}: LivePlayerControlsProps) => {
  const [controlsVisible, setControlsVisible] = useState(true);
  const [volume, setVolume] = useState(1);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [liveDelta, setLiveDelta] = useState(0);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
    if (!isPlaying) return;
    const interval = setInterval(() => {
      const video = playerRef.current?.video;
      if (!video) return;
      const d = video.duration;
      const c = video.currentTime;
      if (!isFinite(d) || !isFinite(c) || d <= 0) return;
      const delta = d - c;
      setLiveDelta(delta > 0 ? delta : 0);
    }, 1000);
    return () => clearInterval(interval);
  }, [isPlaying, playerRef]);

  const handleGoLive = useCallback(() => {
    const video = playerRef.current?.video;
    if (!video) return;
    try {
      const d = video.duration;
      if (!isFinite(d) || d <= 0) return;
      video.currentTime = Math.max(0, d - 0.5);
      if (video.paused) {
        video.play().catch(() => {});
      }
    } catch (e) {
      console.warn("[LivePlayerControls] go live error:", e);
    }
  }, [playerRef]);

  useEffect(() => {
    const handle = () => {
      const fs =
        document.fullscreenElement ||
        (document as unknown as { webkitFullscreenElement?: Element }).webkitFullscreenElement;
      setIsFullscreen(Boolean(fs));
    };
    const videoEl = playerRef.current?.video;
    const handleIosFsBegin = () => setIsFullscreen(true);
    const handleIosFsEnd = () => setIsFullscreen(false);

    document.addEventListener("fullscreenchange", handle);
    document.addEventListener("webkitfullscreenchange", handle);
    if (videoEl) {
      videoEl.addEventListener("webkitbeginfullscreen", handleIosFsBegin);
      videoEl.addEventListener("webkitendfullscreen", handleIosFsEnd);
    }
    return () => {
      document.removeEventListener("fullscreenchange", handle);
      document.removeEventListener("webkitfullscreenchange", handle);
      if (videoEl) {
        videoEl.removeEventListener("webkitbeginfullscreen", handleIosFsBegin);
        videoEl.removeEventListener("webkitendfullscreen", handleIosFsEnd);
      }
    };
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

              {levels.length > 0 && (
                <DropdownMenu onOpenChange={(open) => { if (open) wakeControls(); }}>
                  <DropdownMenuTrigger asChild>
                    <button
                      aria-label="Calidad de video"
                      className="flex items-center gap-1.5 text-white hover:text-gold active:scale-90 transition-all"
                    >
                      <Settings size={20} />
                      <span className="hidden sm:inline text-xs font-bold tabular-nums">{currentLevelLabel}</span>
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent
                    align="end"
                    side="top"
                    className="min-w-[160px] bg-darker/95 backdrop-blur-xl border-white/10"
                  >
                    <DropdownMenuLabel className="text-xs text-textMuted uppercase tracking-wider">
                      Calidad
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={() => { onSelectLevel(-1); wakeControls(); }}
                      className={cn("cursor-pointer", currentLevel === -1 && "text-gold")}
                    >
                      <span className="flex-1">Auto</span>
                      {currentLevel === -1 && <Check size={14} className="text-gold" />}
                    </DropdownMenuItem>
                    {[...levels]
                      .sort((a, b) => b.height - a.height)
                      .map((lvl) => (
                        <DropdownMenuItem
                          key={lvl.index}
                          onClick={() => { onSelectLevel(lvl.index); wakeControls(); }}
                          className={cn("cursor-pointer", currentLevel === lvl.index && "text-gold")}
                        >
                          <span className="flex-1">{lvl.label}</span>
                          {currentLevel === lvl.index && <Check size={14} className="text-gold" />}
                        </DropdownMenuItem>
                      ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              )}

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
