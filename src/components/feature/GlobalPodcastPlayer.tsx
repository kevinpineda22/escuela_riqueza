/**
 * GlobalPodcastPlayer — UI del reproductor podcast persistente.
 *
 * Solo renderiza la barra de controles. El audio real vive en PodcastEngine.tsx.
 * No contiene ningún iframe — eso elimina el problema de throttling/pausa
 * al navegar entre rutas.
 */
import { useEffect, useRef, useState } from "react";
import { motion } from "motion/react";
import {
  Play, Pause, X, Volume2, VolumeX,
  RotateCcw, RotateCw, Headphones, Check,
} from "lucide-react";
import { usePlayerStore } from "@/stores/player.store";
import { podcastStreamRef } from "@/components/feature/PodcastEngine";
import { flushLessonProgress } from "@/lib/api/stream/progress";
import { cn } from "@/lib/utils";

const SKIP_SECONDS = 10;

const SecondaryButton = ({
  onClick, title, ariaLabel, children, className,
}: {
  onClick: () => void;
  title: string;
  ariaLabel: string;
  children: React.ReactNode;
  className?: string;
}) => (
  <button
    onClick={onClick}
    title={title}
    aria-label={ariaLabel}
    className={cn(
      "w-10 h-10 rounded-full flex items-center justify-center shrink-0",
      "text-white/70 hover:text-white hover:bg-white/8 active:bg-white/12",
      "transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/60",
      className,
    )}
  >
    {children}
  </button>
);

const SkipIcon = ({
  direction,
}: { direction: "back" | "forward" }) => (
  <span className="relative inline-flex items-center justify-center w-5 h-5">
    {direction === "back"
      ? <RotateCcw size={20} strokeWidth={1.8} />
      : <RotateCw size={20} strokeWidth={1.8} />}
    <span className="absolute text-[8px] font-bold leading-none mt-[1px] tracking-tight">
      {SKIP_SECONDS}
    </span>
  </span>
);

const GlobalPodcastPlayer = () => {
  const {
    track,
    isPlaying,
    isPodcastMode,
    hasEnded,
    volume,
    setIsPlaying,
    setVolume,
    setPlaybackProgress,
    closePlayer,
  } = usePlayerStore();

  const [progress, setProgress] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    const tick = () => {
      const el = podcastStreamRef.current;
      if (el) {
        const cur = el.currentTime ?? 0;
        const dur = el.duration ?? 0;
        setCurrentTime(cur);
        setDuration(dur);
        if (dur > 0) setProgress((cur / dur) * 100);
      }
      rafRef.current = requestAnimationFrame(tick);
    };

    if (isPodcastMode && track) {
      rafRef.current = requestAnimationFrame(tick);
    }

    return () => cancelAnimationFrame(rafRef.current);
  }, [isPodcastMode, track]);

  if (!track || !isPodcastMode) return null;

  const togglePlay = () => {
    const el = podcastStreamRef.current;
    if (!el) return;
    if (isPlaying) {
      el.pause();
      setIsPlaying(false);
    } else {
      // Tras completar la lección volvemos al inicio explícitamente: es la única
      // forma de reproducir de nuevo, y así el usuario lo elige en vez de sufrirlo.
      if (hasEnded) el.currentTime = 0;
      el.play().catch(() => {});
      setIsPlaying(true);
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = Number(e.target.value);
    setProgress(val);
    const el = podcastStreamRef.current;
    if (el && duration > 0) {
      el.currentTime = (val / 100) * duration;
    }
  };

  const handleSkipBack = () => {
    const el = podcastStreamRef.current;
    if (el) el.currentTime = Math.max(el.currentTime - SKIP_SECONDS, 0);
  };

  const handleSkipForward = () => {
    const el = podcastStreamRef.current;
    if (el && duration > 0) el.currentTime = Math.min(el.currentTime + SKIP_SECONDS, duration);
  };

  const handleClose = () => {
    const el = podcastStreamRef.current;
    if (el && track) {
      setPlaybackProgress(track.videoId, el.currentTime);
      // Además del store local, persistimos el minuto exacto: al cerrar el podcast
      // el engine deja de correr y su guardado periódico ya no vuelve a dispararse.
      flushLessonProgress(track.id, el.currentTime, el.duration).catch(() => {});
    }
    closePlayer();
  };

  const formatTime = (seconds: number) => {
    if (!seconds || isNaN(seconds)) return "0:00";
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  return (
    <motion.div
      initial={{ y: "100%" }}
      animate={{ y: 0 }}
      transition={{ type: "spring", stiffness: 260, damping: 30 }}
      className={cn(
        "fixed bottom-0 left-0 w-full z-[100] bg-darker/95 backdrop-blur-xl border-t shadow-[0_-10px_30px_rgba(0,0,0,0.5)]",
        // Respetar el home indicator del iPhone: sin esto los controles quedan
        // debajo de la barra del sistema.
        "pb-[env(safe-area-inset-bottom)]",
        hasEnded ? "border-green-500/30" : "border-white/10"
      )}
    >
      {/* Progress bar — top edge (mobile primary scrubber) */}
      <div className="absolute top-0 left-0 w-full h-1 bg-white/5 cursor-pointer">
        <div
          className={cn(
            "h-full transition-all duration-100 relative",
            hasEnded ? "bg-green-500" : "bg-gold"
          )}
          style={{ width: `${hasEnded ? 100 : progress}%` }}
        />
        <input
          type="range" min="0" max="100" step="0.1"
          value={progress}
          onChange={handleSeek}
          aria-label="Progreso"
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
        />
      </div>

      <div className="max-w-7xl mx-auto px-3 sm:px-4 py-2 md:py-3 flex flex-col md:grid md:grid-cols-3 md:items-center gap-2 md:gap-4">
        {/* LEFT — info card */}
        <div className="flex items-center gap-3 min-w-0">
          <div className={cn(
            "w-11 h-11 md:w-14 md:h-14 rounded-xl border flex items-center justify-center shrink-0 shadow-lg relative overflow-hidden transition-colors",
            hasEnded ? "bg-green-500/10 border-green-500/40" : "bg-gold/10 border-gold/30"
          )}>
            {hasEnded ? (
              <Check className="text-green-500 w-5 h-5 md:w-7 md:h-7" />
            ) : (
              <>
                <Headphones className="text-gold w-5 h-5 md:w-7 md:h-7" />
                {isPlaying && (
                  // Ecualizador real: barras que cambian de alto. Antes usaban `pulse`,
                  // que solo hace fade y no se leía como audio sonando.
                  <div className="absolute bottom-1.5 flex gap-0.5 items-end h-3">
                    {[0, 0.15, 0.3].map((delay, i) => (
                      <motion.span
                        key={i}
                        className="w-0.5 bg-gold rounded-full"
                        animate={{ height: ["30%", "100%", "45%", "80%", "30%"] }}
                        transition={{ duration: 1.1, repeat: Infinity, ease: "easeInOut", delay }}
                        style={{ height: "30%" }}
                      />
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <h4 className="text-white font-bold text-sm md:text-base truncate leading-tight">
              {track.title}
            </h4>
            {hasEnded ? (
              <p className="text-green-400 text-[11px] md:text-xs truncate font-semibold mt-0.5 flex items-center gap-1">
                <Check size={12} className="shrink-0" /> Lección completada
              </p>
            ) : (
              <p className="text-textMuted text-[11px] md:text-xs truncate uppercase tracking-wider mt-0.5">
                {track.moduleTitle}
              </p>
            )}
          </div>

          {/* Mobile-only close */}
          <div className="md:hidden">
            <SecondaryButton
              onClick={handleClose}
              title="Cerrar reproductor"
              ariaLabel="Cerrar reproductor"
              className="hover:text-red-400 hover:bg-red-400/10"
            >
              <X size={18} />
            </SecondaryButton>
          </div>
        </div>

        {/* CENTER — controls (Spotify-style, truly centered) */}
        <div className="flex flex-col items-center w-full md:max-w-[420px] md:mx-auto md:justify-self-center">
          <div className="flex items-center justify-center gap-3 sm:gap-4">
            <SecondaryButton
              onClick={handleSkipBack}
              title="Retroceder 10 segundos"
              ariaLabel="Retroceder 10 segundos"
            >
              <SkipIcon direction="back" />
            </SecondaryButton>

            <button
              onClick={togglePlay}
              aria-label={hasEnded ? "Escuchar de nuevo" : isPlaying ? "Pausar" : "Reproducir"}
              title={hasEnded ? "Escuchar de nuevo" : undefined}
              className={cn(
                "w-12 h-12 rounded-full flex items-center justify-center shrink-0",
                "hover:scale-105 active:scale-95",
                "transition-transform focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/60",
                hasEnded
                  ? "bg-green-500 text-darker shadow-[0_0_18px_rgba(34,197,94,0.35)]"
                  : "bg-white text-darker shadow-[0_0_18px_rgba(255,255,255,0.18)]"
              )}
            >
              {hasEnded
                ? <RotateCcw size={20} />
                : isPlaying
                  ? <Pause size={20} className="fill-current" />
                  : <Play size={20} className="fill-current ml-0.5" />
              }
            </button>

            <SecondaryButton
              onClick={handleSkipForward}
              title="Avanzar 10 segundos"
              ariaLabel="Avanzar 10 segundos"
            >
              <SkipIcon direction="forward" />
            </SecondaryButton>
          </div>

          {/* Desktop scrubber + time */}
          <div className="hidden md:flex items-center gap-3 w-full mt-2 text-[11px] font-medium text-white/50 tabular-nums">
            <span className="w-10 text-right">{formatTime(currentTime)}</span>
            <div className="flex-1 h-1 rounded-full bg-white/10 relative group">
              <div
                className="absolute top-0 left-0 h-full bg-white/80 rounded-full group-hover:bg-gold transition-colors"
                style={{ width: `${progress}%` }}
              />
              <input
                type="range" min="0" max="100" step="0.1"
                value={progress}
                onChange={handleSeek}
                aria-label="Progreso"
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              />
            </div>
            <span className="w-10 text-left">{formatTime(duration)}</span>
          </div>
        </div>

        {/* RIGHT — actions (desktop only) */}
        <div className="hidden md:flex items-center justify-end gap-2 shrink-0">
          <SecondaryButton
            onClick={() => setVolume(volume === 0 ? 1 : 0)}
            title={volume === 0 ? "Activar sonido" : "Silenciar"}
            ariaLabel="Silenciar o activar sonido"
          >
            {volume === 0 ? <VolumeX size={18} /> : <Volume2 size={18} />}
          </SecondaryButton>
          <input
            type="range" min="0" max="1" step="0.05"
            value={volume}
            onChange={(e) => setVolume(Number(e.target.value))}
            aria-label="Volumen"
            className="w-20 accent-gold bg-white/15 h-1 rounded-full cursor-pointer appearance-none [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:rounded-full"
          />
          <div className="w-px h-7 bg-white/10 mx-1" />
          <SecondaryButton
            onClick={handleClose}
            title="Cerrar reproductor"
            ariaLabel="Cerrar reproductor"
            className="hover:text-red-400 hover:bg-red-400/10"
          >
            <X size={18} />
          </SecondaryButton>
        </div>

        {/* Mobile time row */}
        <div className="md:hidden flex items-center justify-between text-[10px] font-medium text-white/50 tabular-nums px-1 -mt-1">
          <span>{formatTime(currentTime)}</span>
          <span>{formatTime(duration)}</span>
        </div>
      </div>
    </motion.div>
  );
};

export default GlobalPodcastPlayer;
