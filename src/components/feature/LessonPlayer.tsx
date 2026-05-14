import { useState, useRef, useEffect } from "react";
import { Play, Headphones, ShieldAlert, MonitorPlay } from "lucide-react";
import { cn } from "@/lib/utils";
import { usePlayerStore } from "@/stores/player.store";
import { podcastStreamRef } from "@/components/feature/PodcastEngine";
import { Stream } from "@cloudflare/stream-react";

interface LessonPlayerProps {
  videoSrc?: string;
  isPremium: boolean;
  lesson?: { id: number; titulo: string; modId: number };
  moduleTitle?: string;
}

const AD_DURATION = 41;
const AD_VIDEO_ID = "02b22da00a68753980615a8df8f06e96";

const LessonPlayer = ({ videoSrc, isPremium, lesson, moduleTitle }: LessonPlayerProps) => {
  const { playTrack, isPodcastMode, closePlayer, track, lastKnownTime, lastVideoId, setPlaybackProgress } = usePlayerStore();

  const isPlayingThisInPodcast = isPodcastMode && track?.videoId === videoSrc;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const streamRef = useRef<any>(null);

  // Tiempo pendiente de restaurar al volver del modo podcast al video
  const pendingSeekRef = useRef<number | null>(null);

  const [playRequested, setPlayRequested] = useState(false);
  const initializedTimeRef = useRef(false);

  const [showAd, setShowAd] = useState(false);
  const [hasAdPlayed, setHasAdPlayed] = useState(false);
  const [adCurrentTime, setAdCurrentTime] = useState(0);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const adStreamRef = useRef<any>(null);

  // Controlar play/pause del video LOCAL
  useEffect(() => {
    if (!streamRef.current || isPlayingThisInPodcast) return;
    if (showAd || !playRequested) {
      try { streamRef.current.pause(); } catch { /* stream not ready */ }
    } else {
      try { streamRef.current.play(); } catch { /* stream not ready */ }
    }
  }, [showAd, isPlayingThisInPodcast, playRequested]);

  // Resetear estado local cuando cambia la lección
  useEffect(() => {
    if (isPlayingThisInPodcast) return;
    setPlayRequested(false);
    setShowAd(false);
    setHasAdPlayed(false);
    setAdCurrentTime(0);
    initializedTimeRef.current = false;
  }, [videoSrc]); // eslint-disable-line react-hooks/exhaustive-deps

  const handlePlayRequest = () => {
    // Si el usuario decide reproducir un video normal, apagamos el podcast global para evitar audios superpuestos
    if (isPodcastMode) {
      closePlayer();
    }
    
    setPlayRequested(true);
    if (!isPremium && !hasAdPlayed) {
      setShowAd(true);
      setAdCurrentTime(0);
    }
  };

  const handleAdEnd = () => {
    setShowAd(false);
    setHasAdPlayed(true);
  };

  const handlePodcastToggle = () => {
    if (isPlayingThisInPodcast) {
      // Leer el tiempo actual del engine antes de cerrarlo
      const latestTime = podcastStreamRef.current?.currentTime ?? usePlayerStore.getState().lastKnownTime;
      closePlayer();
      // El Stream local se montará con autoplay en el próximo render.
      // Guardamos el tiempo exacto para restaurarlo en el primer onTimeUpdate.
      pendingSeekRef.current = latestTime;
      setPlayRequested(true);
    } else if (videoSrc && lesson && moduleTitle) {
      setPlayRequested(false);
      const currentTimeToPass = streamRef.current?.currentTime ?? lastKnownTime;

      // En móvil: desbloquear audio creando un AudioContext dentro del gesto del usuario.
      // Esto permite que PodcastEngine pueda hacer play() sin ser bloqueado por el navegador.
      try {
        const ACtx = (window.AudioContext || (window as any).webkitAudioContext);
        if (ACtx) {
          const ctx = new ACtx();
          if (ctx.state === "suspended") ctx.resume();
          const osc = ctx.createOscillator();
          osc.connect(ctx.destination);
          osc.start(0);
          osc.stop(0.001);
          setTimeout(() => ctx.close(), 200);
        }
      } catch { /* fallback silencioso */ }

      // Intento forzado de desbloquear el autoplay del iframe enviando play en el call stack
      if (podcastStreamRef.current) {
        podcastStreamRef.current.play().catch(() => {});
      }

      playTrack({
        id: lesson.id,
        title: lesson.titulo,
        moduleTitle: moduleTitle,
        videoId: videoSrc,
      }, currentTimeToPass);
    }
  };

  const handleTimeUpdate = () => {
    if (!streamRef.current) return;

    // Restaurar tiempo al volver del modo podcast (se ejecuta una vez)
    if (pendingSeekRef.current !== null && streamRef.current.duration > 0) {
      streamRef.current.currentTime = pendingSeekRef.current;
      pendingSeekRef.current = null;
      initializedTimeRef.current = true;
      return;
    }

    // Restaurar tiempo la primera vez que se reproduce un video
    if (!initializedTimeRef.current && streamRef.current.duration > 0) {
      if (lastVideoId === videoSrc && lastKnownTime > 0) {
        streamRef.current.currentTime = lastKnownTime;
      }
      initializedTimeRef.current = true;
    }

    const currentTime = streamRef.current.currentTime;
    if (Math.abs(currentTime - lastKnownTime) > 1 && videoSrc) {
      setPlaybackProgress(videoSrc, currentTime);
    }
  };

  return (
    <div className="w-full max-w-5xl flex flex-col gap-4">
      <div
        className={cn(
          "p-3 rounded-xl border flex items-center justify-between",
          isPremium ? "bg-gold/10 border-gold/30 text-gold" : "bg-white/5 border-white/10 text-white/70"
        )}
      >
        <div className="flex items-center gap-2 font-medium">
          <ShieldAlert size={18} />
          {isPremium ? "Plan Individual - Sin Interrupciones" : "Plan Gratuito - Reproducción con Publicidad"}
        </div>

        {isPremium && (
          <button
            onClick={handlePodcastToggle}
            className={cn(
              "flex items-center gap-2 px-4 py-1.5 rounded-lg font-medium transition-all",
              isPlayingThisInPodcast ? "bg-gold text-darker shadow-[0_0_15px_rgba(204,164,59,0.3)]" : "bg-transparent border border-gold hover:bg-gold/10 text-gold"
            )}
          >
            <Headphones size={18} /> Modo Podcast {isPlayingThisInPodcast ? "ON" : "OFF"}
          </button>
        )}
      </div>

      <div className="relative aspect-video bg-black rounded-2xl overflow-hidden border border-white/10 shadow-2xl group transition-all duration-500 ease-in-out">
        {!videoSrc ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 z-20">
            <MonitorPlay size={48} className="text-white/20 mb-4" />
            <h3 className="text-white font-bold text-lg">Video no disponible</h3>
            <p className="text-textMuted text-sm">Esta lección aún no tiene un video asignado.</p>
          </div>
        ) : null}

        <div 
          className={cn(
            "absolute inset-0 z-30 bg-gradient-to-br from-darker to-[#1a1a1a] flex flex-col items-center justify-center transition-all duration-500 ease-in-out",
            isPlayingThisInPodcast && !showAd ? "opacity-100 visible" : "opacity-0 invisible pointer-events-none"
          )}
        >
          <img
            src="https://imagedelivery.net/HGkLNfdVjFNAti8ZHHgxtQ/18dc9190-6625-4b89-8f1e-3f221e96b500/public"
            className="h-24 md:h-32 object-contain mb-6 opacity-80 animate-pulse drop-shadow-[0_0_15px_rgba(204,164,59,0.3)]"
          />
          <div className="flex items-center gap-3">
            <Headphones size={24} className="text-gold animate-bounce" />
            <h3 className="text-2xl font-bold text-white">Modo Podcast Activado</h3>
          </div>
          <p className="text-sm text-textMuted mt-2 mb-6">Reproduciéndose en segundo plano.</p>
          
          <button 
            onClick={handlePodcastToggle}
            className="px-6 py-2.5 bg-white/10 hover:bg-white/20 border border-white/20 rounded-full flex items-center justify-center transition-all gap-2 text-sm font-bold text-white pointer-events-auto"
          >
            <MonitorPlay size={18} />
            Volver a Video
          </button>
        </div>

        {showAd && (
          <div className="absolute inset-0 z-40 bg-black flex flex-col items-center justify-center">
            <div className="absolute top-4 left-4 z-50 bg-black/60 backdrop-blur-md px-4 py-2 border border-white/10 text-sm font-bold text-white uppercase tracking-widest rounded-lg flex items-center gap-2 pointer-events-none">
              <span className="w-2 h-2 rounded-full bg-gold animate-pulse"></span>
              Publicidad de Aliado
            </div>

            <div className="absolute inset-0 w-full h-full pointer-events-none flex items-center justify-center bg-black">
              <Stream
                streamRef={adStreamRef}
                src={AD_VIDEO_ID}
                controls={false}
                autoplay
                preload="auto"
                letterboxColor="transparent"
                className="w-full h-full [&>iframe]:w-full [&>iframe]:h-full [&>iframe]:object-contain"
                onTimeUpdate={() => {
                  if (adStreamRef.current) {
                    setAdCurrentTime(adStreamRef.current.currentTime);
                  }
                }}
                onEnded={handleAdEnd}
              />
            </div>

            <div className="absolute bottom-6 right-6 z-50 flex flex-col items-end gap-2">
              {adCurrentTime >= 30 ? (
                <button 
                  onClick={handleAdEnd}
                  className="bg-gold hover:bg-goldHover text-darker font-bold px-6 py-2 rounded-lg transition-all shadow-[0_0_15px_rgba(204,164,59,0.5)] animate-in fade-in zoom-in duration-300"
                >
                  Omitir Anuncio ⏭
                </button>
              ) : (
                <div className="bg-black/60 backdrop-blur-md px-4 py-2 border border-white/10 text-xs font-medium text-white rounded-lg">
                  Podrás omitir en {Math.max(0, Math.ceil(30 - adCurrentTime))}s...
                </div>
              )}
              <div className="w-48 h-1.5 bg-black/50 rounded-full overflow-hidden border border-white/5">
                <div
                  className="h-full bg-white/40 transition-all duration-300"
                  style={{ width: `${Math.min((adCurrentTime / AD_DURATION) * 100, 100)}%` }}
                ></div>
              </div>
            </div>
          </div>
        )}

        {!playRequested && !showAd && (
          <div className="absolute inset-0 z-20 bg-darker flex items-center justify-center">
            <button 
              onClick={handlePlayRequest}
              disabled={!videoSrc}
              className={cn("w-20 h-20 rounded-full flex items-center justify-center transition-transform hover:scale-105 shadow-[0_0_30px_rgba(204,164,59,0.4)]", videoSrc ? "bg-gold hover:bg-goldHover" : "bg-gray-600 cursor-not-allowed")}
            >
              <Play size={40} className="text-darker ml-2" />
            </button>
          </div>
        )}

        {videoSrc && !isPlayingThisInPodcast && (
          <div 
            key={videoSrc}
            className={cn(
              "w-full h-full absolute inset-0 bg-black transition-all duration-300",
              showAd || !playRequested ? "opacity-0 pointer-events-none z-0" : "opacity-100 z-10"
            )}
          >
            <Stream
              streamRef={streamRef}
              src={videoSrc}
              controls={!showAd}
              autoplay={playRequested && !showAd}
              preload="auto"
              className="w-full h-full border-none"
              onTimeUpdate={handleTimeUpdate}
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default LessonPlayer;
