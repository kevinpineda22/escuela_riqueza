/**
 * GlobalPodcastPlayer — UI del reproductor podcast persistente.
 *
 * Solo renderiza la barra de controles. El audio real vive en PodcastEngine.tsx.
 * No contiene ningún iframe — eso elimina el problema de throttling/pausa
 * al navegar entre rutas.
 */
import { useEffect, useRef, useState } from "react";
import {
  Play, Pause, X, Volume2, VolumeX,
  SkipBack, SkipForward, Headphones,
} from "lucide-react";
import { usePlayerStore } from "@/stores/player.store";
import { podcastStreamRef } from "@/components/feature/PodcastEngine";

const GlobalPodcastPlayer = () => {
  const {
    track,
    isPlaying,
    isPodcastMode,
    volume,
    setIsPlaying,
    setVolume,
    setPlaybackProgress,
    closePlayer,
  } = usePlayerStore();

  const [progress, setProgress] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  // Polling de currentTime desde el engine (evita props drilling y re-renders en cadena)
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

  // No renderizar si no hay podcast activo
  if (!track || !isPodcastMode) return null;

  // ── Handlers ──────────────────────────────────────────────────────────────

  const togglePlay = () => {
    const el = podcastStreamRef.current;
    if (!el) return;
    if (isPlaying) {
      el.pause();
      setIsPlaying(false);
    } else {
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
    if (el) el.currentTime = Math.max(el.currentTime - 10, 0);
  };

  const handleSkipForward = () => {
    const el = podcastStreamRef.current;
    if (el && duration > 0) el.currentTime = Math.min(el.currentTime + 10, duration);
  };

  const handleClose = () => {
    const el = podcastStreamRef.current;
    if (el && track) setPlaybackProgress(track.videoId, el.currentTime);
    closePlayer();
  };

  const formatTime = (seconds: number) => {
    if (!seconds || isNaN(seconds)) return "0:00";
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="fixed bottom-0 left-0 w-full z-[100] bg-darker/95 backdrop-blur-xl border-t border-white/10 shadow-[0_-10px_30px_rgba(0,0,0,0.5)]">
      {/* Progress bar — top edge */}
      <div className="absolute top-0 left-0 w-full h-1 bg-white/5 cursor-pointer">
        <div
          className="h-full bg-gold transition-all duration-100 relative"
          style={{ width: `${progress}%` }}
        >
          <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full shadow-[0_0_10px_rgba(204,164,59,1)] opacity-0 hover:opacity-100" />
        </div>
        <input
          type="range" min="0" max="100"
          value={progress}
          onChange={handleSeek}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
        />
      </div>

      <div className="max-w-7xl mx-auto px-4 h-20 md:h-24 flex items-center justify-between gap-4">
        {/* Info — Left */}
        <div className="flex items-center gap-4 flex-1 min-w-0">
          <div className="w-12 h-12 md:w-16 md:h-16 bg-gold/10 rounded-xl border border-gold/30 flex items-center justify-center shrink-0 shadow-lg relative overflow-hidden">
            <Headphones className="text-gold w-6 h-6 md:w-8 md:h-8" />
            {isPlaying && (
              <div className="absolute bottom-2 flex gap-0.5 items-end h-3">
                <div className="w-0.5 bg-gold h-full animate-[pulse_1s_ease-in-out_infinite]" />
                <div className="w-0.5 bg-gold h-2/3 animate-[pulse_1s_ease-in-out_infinite_0.2s]" />
                <div className="w-0.5 bg-gold h-4/5 animate-[pulse_1s_ease-in-out_infinite_0.4s]" />
              </div>
            )}
          </div>
          <div className="truncate">
            <h4 className="text-white font-bold text-sm md:text-base truncate">{track.title}</h4>
            <p className="text-textMuted text-xs md:text-sm truncate uppercase tracking-wider">
              {track.moduleTitle}
            </p>
          </div>
        </div>

        {/* Controls — Center */}
        <div className="flex flex-col items-center justify-center flex-[2] md:flex-1 max-w-md">
          <div className="flex items-center gap-4 md:gap-6">
            <button
              onClick={handleSkipBack}
              className="text-white/50 hover:text-white transition-colors p-2"
              title="Retroceder 10s"
            >
              <SkipBack size={20} />
            </button>
            <button
              onClick={togglePlay}
              className="w-10 h-10 md:w-12 md:h-12 bg-white hover:scale-105 text-darker rounded-full flex items-center justify-center transition-all shadow-[0_0_15px_rgba(255,255,255,0.2)]"
            >
              {isPlaying
                ? <Pause size={20} className="fill-current" />
                : <Play size={20} className="fill-current ml-1" />
              }
            </button>
            <button
              onClick={handleSkipForward}
              className="text-white/50 hover:text-white transition-colors p-2"
              title="Avanzar 10s"
            >
              <SkipForward size={20} />
            </button>
          </div>

          {/* Time + Scrubber — Desktop */}
          <div className="hidden md:flex items-center gap-3 w-full mt-2 text-[11px] font-medium text-white/50">
            <span>{formatTime(currentTime)}</span>
            <div className="flex-1 h-1 rounded-full bg-white/10 relative group">
              <div
                className="absolute top-0 left-0 h-full bg-white rounded-full group-hover:bg-gold transition-colors"
                style={{ width: `${progress}%` }}
              />
              <input
                type="range" min="0" max="100"
                value={progress}
                onChange={handleSeek}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              />
            </div>
            <span>{formatTime(duration)}</span>
          </div>
        </div>

        {/* Actions — Right */}
        <div className="flex items-center justify-end gap-2 md:gap-4 flex-1">
          <div className="hidden md:flex items-center gap-2">
            <button
              onClick={() => setVolume(volume === 0 ? 1 : 0)}
              className="text-white/70 hover:text-white transition-colors"
            >
              {volume === 0 ? <VolumeX size={20} /> : <Volume2 size={20} />}
            </button>
            <input
              type="range" min="0" max="1" step="0.05"
              value={volume}
              onChange={(e) => setVolume(Number(e.target.value))}
              className="w-20 accent-gold bg-white/20 h-1 rounded-full cursor-pointer appearance-none [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:rounded-full"
            />
          </div>
          <div className="w-px h-8 bg-white/10 mx-2 hidden md:block" />
          <button
            onClick={handleClose}
            className="p-2 text-white/50 hover:text-red-400 transition-colors"
            title="Cerrar reproductor"
          >
            <X size={24} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default GlobalPodcastPlayer;
