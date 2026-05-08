import { useState, useRef, useEffect } from "react";
import { Play, Headphones, ShieldAlert, MonitorPlay } from "lucide-react";
import { cn } from "@/lib/utils";
import { usePlayerStore } from "@/stores/player.store";
import { Stream } from "@cloudflare/stream-react";

interface LessonPlayerProps {
  videoSrc?: string; // Ahora esperamos el Cloudflare Video ID, ej: 595f2bfac6285d604cf136e049c37b08
  isPremium: boolean;
  lesson?: { id: number; titulo: string; modId: number };
  moduleTitle?: string;
}

// Esta es la mejor práctica para no interrumpir el aprendizaje en medio del video.
const AD_DURATION = 41; // 41 segundos de duración del anuncio
const AD_VIDEO_ID = "02b22da00a68753980615a8df8f06e96"; // ID del video de publicidad aliado

const LessonPlayer = ({ videoSrc, isPremium, lesson, moduleTitle }: LessonPlayerProps) => {
  const { playTrack, isPodcastMode, closePlayer, track, lastKnownTime, setLastKnownTime } = usePlayerStore();

  // Verifica si el reproductor global está tocando EXACTAMENTE esta lección
  const isPlayingThisInPodcast = isPodcastMode && track?.videoId === videoSrc;

  const streamRef = useRef<any>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const initializedTimeRef = useRef(false);

  // Lógica de Anuncios
  const [showAd, setShowAd] = useState(false);
  const [hasAdPlayed, setHasAdPlayed] = useState(false);
  const [adTimeLeft, setAdTimeLeft] = useState(AD_DURATION);

  // Cuando cambie el video, resetear los estados
  useEffect(() => {
    setIsPlaying(false);
    setShowAd(false);
    setHasAdPlayed(false);
    initializedTimeRef.current = false;
  }, [videoSrc]);

  const handlePlayRequest = () => {
    // Si no es premium y no ha visto el anuncio, mostrar el anuncio (Pre-roll)
    if (!isPremium && !hasAdPlayed) {
      setShowAd(true);
      startAdTimer();
    } else {
      setIsPlaying(true);
    }
  };

  const handleAdEnd = () => {
    setShowAd(false);
    setHasAdPlayed(true);
    setIsPlaying(true); // Reproducir el video principal tras terminar el anuncio
  };

  const startAdTimer = () => {
    setAdTimeLeft(AD_DURATION);
    const timer = setInterval(() => {
      setAdTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          handleAdEnd();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const handlePodcastToggle = () => {
    if (isPlayingThisInPodcast) {
      closePlayer(); // Al cerrar, el player global ya actualizó lastKnownTime
      setIsPlaying(true);
      initializedTimeRef.current = false; // Forzar que el Stream local haga seek al tiempo guardado
    } else if (videoSrc && lesson && moduleTitle) {
      if (streamRef.current) {
        setLastKnownTime(streamRef.current.currentTime);
      }
      setIsPlaying(false); // Pausamos el video visual para no tener audio doble
      playTrack({
        id: lesson.id,
        title: lesson.titulo,
        moduleTitle: moduleTitle,
        videoId: videoSrc
      }, lastKnownTime);
    }
  };

  return (
    <div className="w-full max-w-5xl flex flex-col gap-4">
      {/* Indicador de Plan */}
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

      {/* Contenedor de Video Principal */}
      <div className="relative aspect-video bg-black rounded-2xl overflow-hidden border border-white/10 shadow-2xl group transition-all duration-500 ease-in-out">
        {/* Pseudo-Podcast Mode Layer (Se pone encima y cubre el video visualmente) */}
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
          
          {/* Controles simples superpuestos en modo podcast */}
          <button 
            onClick={handlePodcastToggle}
            className="px-6 py-2.5 bg-white/10 hover:bg-white/20 border border-white/20 rounded-full flex items-center justify-center transition-all gap-2 text-sm font-bold text-white pointer-events-auto"
          >
            <MonitorPlay size={18} />
            Volver a Video
          </button>
        </div>

        {/* Layer del Anuncio en Video Real */}
        {showAd && (
          <div className="absolute inset-0 z-40 bg-black flex flex-col items-center justify-center">
            <div className="absolute top-4 left-4 z-50 bg-black/60 backdrop-blur-md px-4 py-2 border border-white/10 text-sm font-bold text-white uppercase tracking-widest rounded-lg flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-gold animate-pulse"></span>
              Publicidad de Aliado
            </div>

            <iframe
              src={`https://iframe.videodelivery.net/${AD_VIDEO_ID}?autoplay=true`}
              className="w-full h-full"
              allow="autoplay; fullscreen; picture-in-picture"
              style={{ border: 'none' }}
              onLoad={() => {
                // El countdown maneja el cierre automático
              }}
            />

            <div className="absolute bottom-6 right-6 z-50 flex flex-col items-end gap-2">
              <div className="bg-black/60 backdrop-blur-md px-4 py-2 border border-white/10 text-xs font-medium text-white rounded-lg">
                El video se reanudará en {adTimeLeft}s...
              </div>
              <div className="w-32 h-1.5 bg-black/50 rounded-full overflow-hidden border border-white/5">
                <div
                  className="h-full bg-gold transition-all duration-300"
                  style={{ width: `${((AD_DURATION - adTimeLeft) / AD_DURATION) * 100}%` }}
                ></div>
              </div>
            </div>
          </div>
        )}

        {/* Portada Inicial si no está reproduciendo ni mostrando anuncio */}
        {!isPlaying && !showAd && (
          <div className="absolute inset-0 z-20 bg-darker flex items-center justify-center">
            <button 
              onClick={handlePlayRequest}
              className="w-20 h-20 bg-gold hover:bg-goldHover rounded-full flex items-center justify-center transition-transform hover:scale-105 shadow-[0_0_30px_rgba(204,164,59,0.4)]"
            >
              <Play size={40} className="text-darker ml-2" />
            </button>
          </div>
        )}

        {/* Reproductor de Cloudflare Principal */}
        {isPlaying && !isPlayingThisInPodcast && videoSrc && (
          <Stream
            streamRef={streamRef}
            src={videoSrc}
            controls
            autoplay
            className={cn("w-full h-full object-contain relative z-10 border-none")}
            onTimeUpdate={() => {
              if (streamRef.current) {
                // Sincronización en la primera carga si venimos del modo podcast
                if (!initializedTimeRef.current && streamRef.current.duration > 0 && lastKnownTime > 0) {
                  streamRef.current.currentTime = lastKnownTime;
                  initializedTimeRef.current = true;
                }
                setLastKnownTime(streamRef.current.currentTime);
              }
            }}
          />
        )}
      </div>
    </div>
  );
};

export default LessonPlayer;
