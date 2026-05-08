import { useEffect, useRef, useState } from "react";
import { Play, Pause, X, Volume2, VolumeX, Maximize2, SkipBack, SkipForward, Headphones } from "lucide-react";
import { usePlayerStore } from "@/stores/player.store";
import { cn } from "@/lib/utils";
import { Stream } from "@cloudflare/stream-react";

const GlobalPodcastPlayer = () => {
  const { track, isPlaying, isPodcastMode, volume, lastKnownTime, setIsPlaying, setVolume, setLastKnownTime, closePlayer } = usePlayerStore();
  const [progress, setProgress] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const streamRef = useRef<any>(null);
  const initializedTimeRef = useRef(false);

  // Auto play/pause when the store changes
  useEffect(() => {
    if (streamRef.current) {
      if (isPlaying) {
        streamRef.current.play().catch(() => setIsPlaying(false));
      } else {
        streamRef.current.pause();
      }
    }
  }, [isPlaying, track]);

  // Volume change
  useEffect(() => {
    if (streamRef.current) {
      streamRef.current.volume = volume;
    }
  }, [volume]);

  // Set initial time when track loads
  useEffect(() => {
    initializedTimeRef.current = false;
  }, [track?.id]);

  if (!track || !isPodcastMode) return null;

  const togglePlay = () => setIsPlaying(!isPlaying);

  const handleClose = () => {
    if (streamRef.current) {
      setLastKnownTime(streamRef.current.currentTime);
    }
    closePlayer();
  };

  const formatTime = (seconds: number) => {
    if (!seconds || isNaN(seconds)) return "0:00";
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  const handleTimeUpdate = () => {
    if (streamRef.current) {
      const current = streamRef.current.currentTime;
      const total = streamRef.current.duration;
      
      // En el primer load, hacer seek al tiempo de donde veníamos
      if (!initializedTimeRef.current && total > 0) {
        streamRef.current.currentTime = lastKnownTime;
        initializedTimeRef.current = true;
      }
      
      setCurrentTime(current);
      setDuration(total);
      setLastKnownTime(current); // Keep store updated frequently for seamless handoff
      if (total > 0) setProgress((current / total) * 100);
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newProgress = Number(e.target.value);
    setProgress(newProgress);
    if (streamRef.current && duration > 0) {
      streamRef.current.currentTime = (newProgress / 100) * duration;
    }
  };

  return (
    <div className="fixed bottom-0 left-0 w-full z-[100] bg-darker/95 backdrop-blur-xl border-t border-white/10 shadow-[0_-10px_30px_rgba(0,0,0,0.5)]">
      {/* ProgressBar Top Edge */}
      <div className="absolute top-0 left-0 w-full h-1 bg-white/5 cursor-pointer">
        <div 
          className="h-full bg-gold transition-all duration-100 relative"
          style={{ width: `${progress}%` }}
        >
          <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full shadow-[0_0_10px_rgba(204,164,59,1)] opacity-0 hover:opacity-100" />
        </div>
        <input 
          type="range" 
          min="0" max="100" 
          value={progress} 
          onChange={handleSeek}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
        />
      </div>

      <div className="max-w-7xl mx-auto px-4 h-20 md:h-24 flex items-center justify-between gap-4">
        {/* Info (Left) */}
        <div className="flex items-center gap-4 flex-1 min-w-0">
          <div className="w-12 h-12 md:w-16 md:h-16 bg-gold/10 rounded-xl border border-gold/30 flex items-center justify-center shrink-0 shadow-lg relative overflow-hidden group">
            <Headphones className="text-gold w-6 h-6 md:w-8 md:h-8" />
            {isPlaying && (
              <div className="absolute bottom-2 flex gap-0.5 items-end h-3">
                <div className="w-0.5 bg-gold h-full animate-[pulse_1s_ease-in-out_infinite]"></div>
                <div className="w-0.5 bg-gold h-2/3 animate-[pulse_1s_ease-in-out_infinite_0.2s]"></div>
                <div className="w-0.5 bg-gold h-4/5 animate-[pulse_1s_ease-in-out_infinite_0.4s]"></div>
              </div>
            )}
          </div>
          <div className="truncate">
            <h4 className="text-white font-bold text-sm md:text-base truncate">{track.title}</h4>
            <p className="text-textMuted text-xs md:text-sm truncate uppercase tracking-wider">{track.moduleTitle}</p>
          </div>
        </div>

        {/* Controls (Center) */}
        <div className="flex flex-col items-center justify-center flex-[2] md:flex-1 max-w-md">
          <div className="flex items-center gap-4 md:gap-6">
            <button className="text-white/50 hover:text-white transition-colors p-2">
              <SkipBack size={20} />
            </button>
            <button 
              onClick={togglePlay}
              className="w-10 h-10 md:w-12 md:h-12 bg-white hover:scale-105 text-darker rounded-full flex items-center justify-center transition-all shadow-[0_0_15px_rgba(255,255,255,0.2)]"
            >
              {isPlaying ? <Pause size={20} className="fill-current" /> : <Play size={20} className="fill-current ml-1" />}
            </button>
            <button className="text-white/50 hover:text-white transition-colors p-2">
              <SkipForward size={20} />
            </button>
          </div>
          
          {/* Time (Desktop only) */}
          <div className="hidden md:flex items-center gap-3 w-full mt-2 text-[11px] font-medium text-white/50">
            <span>{formatTime(currentTime)}</span>
            <div className="flex-1 h-1 rounded-full bg-white/10 relative group">
              <div className="absolute top-0 left-0 h-full bg-white rounded-full group-hover:bg-gold transition-colors" style={{ width: `${progress}%` }}></div>
              <input type="range" min="0" max="100" value={progress} onChange={handleSeek} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
            </div>
            <span>{formatTime(duration)}</span>
          </div>
        </div>

        {/* Actions (Right) */}
        <div className="flex items-center justify-end gap-2 md:gap-4 flex-1">
          <div className="hidden md:flex items-center gap-2 group">
            <button onClick={() => setVolume(volume === 0 ? 1 : 0)} className="text-white/70 hover:text-white transition-colors">
              {volume === 0 ? <VolumeX size={20} /> : <Volume2 size={20} />}
            </button>
            <input 
              type="range" 
              min="0" max="1" step="0.05"
              value={volume} 
              onChange={(e) => setVolume(Number(e.target.value))}
              className="w-20 accent-gold bg-white/20 h-1 rounded-full cursor-pointer appearance-none [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:rounded-full"
            />
          </div>
          <div className="w-px h-8 bg-white/10 mx-2 hidden md:block"></div>
          <button onClick={handleClose} className="p-2 text-white/50 hover:text-red-400 transition-colors" title="Cerrar reproductor">
            <X size={24} />
          </button>
        </div>
      </div>

      {/* Hidden Cloudflare Stream Player for Audio */}
      <div className="hidden w-0 h-0 overflow-hidden opacity-0 pointer-events-none">
        <Stream
          streamRef={streamRef}
          src={track.videoId}
          controls={false}
          autoplay={isPlaying}
          onTimeUpdate={handleTimeUpdate}
          onPlay={() => setIsPlaying(true)}
          onPause={() => setIsPlaying(false)}
        />
      </div>
    </div>
  );
};

export default GlobalPodcastPlayer;