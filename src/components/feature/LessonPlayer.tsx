import { useState, useRef, useEffect } from "react";
import { Play, Headphones, ShieldAlert, MonitorPlay, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { usePlayerStore } from "@/stores/player.store";
import { podcastStreamRef } from "@/components/feature/PodcastEngine";
import { Stream } from "@cloudflare/stream-react";
import { fetchUserProgress, saveUserProgress } from "@/lib/api/stream/progress";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface LessonPlayerProps {
  videoSrc?: string;
  isPremium: boolean;
  lesson?: { id: string; titulo: string; modId: string };
  moduleTitle?: string;
}

const AD_DURATION = 41;
const AD_VIDEO_ID = "e5d953d28c8b3d1c1ae8f0b0825191be";

const LessonPlayer = ({ videoSrc, isPremium, lesson, moduleTitle }: LessonPlayerProps) => {
  const { playTrack, isPodcastMode, closePlayer, track, lastKnownTime, lastVideoId, setPlaybackProgress } = usePlayerStore();

  const isPlayingThisInPodcast = isPodcastMode && track?.videoId === videoSrc;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const streamRef = useRef<any>(null);

  // Tiempo pendiente de restaurar al volver del modo podcast al video
  const pendingSeekRef = useRef<number | null>(null);

  const [playRequested, setPlayRequested] = useState(false);
  const initializedTimeRef = useRef(false);

  // Progreso guardado en base de datos
  const [showResumeModal, setShowResumeModal] = useState(false);
  const [savedProgressSeconds, setSavedProgressSeconds] = useState(0);
  const lastSavedTimeRef = useRef(0);
  const lastSaveCallTimeRef = useRef(Date.now());

  // Ref sincronizada con props para evitar stale closures en handlers del Stream
  const lessonRef = useRef(lesson);
  useEffect(() => { lessonRef.current = lesson; }, [lesson]);

  const [showAd, setShowAd] = useState(false);
  const [hasAdPlayed, setHasAdPlayed] = useState(false);
  const [adCurrentTime, setAdCurrentTime] = useState(0);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const adStreamRef = useRef<any>(null);

  const endedRef = useRef(false);

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
      lastSavedTimeRef.current = 0;
      endedRef.current = false;
      
      // Buscar progreso real
      const loadProgress = async () => {
        if (!lesson || !videoSrc) return;
        const progress = await fetchUserProgress(String(lesson.id));
        if (progress && progress.progress_seconds > 5 && !progress.is_completed) {
          setSavedProgressSeconds(progress.progress_seconds);
        } else {
          setSavedProgressSeconds(0);
        }
      };
      loadProgress();
    }, [videoSrc, lesson?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const handlePlayRequest = () => {
    if (isPodcastMode) {
      closePlayer();
    }
    
    if (savedProgressSeconds > 0) {
      setShowResumeModal(true);
      return;
    }
    
    startPlayback();
  };

  const startPlayback = () => {
    endedRef.current = false;
    setPlayRequested(true);
    if (!isPremium && !hasAdPlayed) {
      setShowAd(true);
      setAdCurrentTime(0);
    }
  };

  const handleResume = () => {
    setShowResumeModal(false);
    pendingSeekRef.current = savedProgressSeconds;
    setSavedProgressSeconds(0);
    startPlayback();
  };

  const handleStartOver = () => {
    setShowResumeModal(false);
    pendingSeekRef.current = 0;
    setSavedProgressSeconds(0);
    startPlayback();
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
    const duration = streamRef.current.duration;
    
    if (Math.abs(currentTime - lastKnownTime) > 1 && videoSrc) {
      setPlaybackProgress(videoSrc, currentTime);
    }

    // Auto-guardado en Supabase cada 10 segundos
    if (lesson && currentTime > 0 && Math.abs(currentTime - lastSavedTimeRef.current) >= 10) {
      const now = Date.now();
      // Throttle extra por seguridad (max 1 llamada cada 5s)
      if (now - lastSaveCallTimeRef.current > 5000) {
        lastSavedTimeRef.current = currentTime;
        lastSaveCallTimeRef.current = now;
        
        const isCompleted = endedRef.current || (duration > 0 && (currentTime / duration) >= 0.9);
        
        saveUserProgress(String(lesson.id), currentTime, isCompleted).catch(() => {});
      }
    }
  };

  const handleEnded = () => {
    endedRef.current = true;
    setPlayRequested(false);
    const currentLesson = lessonRef.current;
    const el = streamRef.current;
    if (currentLesson && el?.duration) {
      saveUserProgress(String(currentLesson.id), el.duration, true).catch(() => {});
    }
  };

  // Guardar progreso al desmontar el componente (navegación, cierre de pestaña)
  useEffect(() => {
    return () => {
      const currentLesson = lessonRef.current;
      const el = streamRef.current;
      if (currentLesson && el?.currentTime && el.currentTime > 5) {
        const currentTime = el.currentTime;
        const duration = el.duration;
        const isCompleted = duration > 0 && (currentTime / duration) >= 0.9;
        saveUserProgress(String(currentLesson.id), currentTime, isCompleted).catch(() => {});
      }
    };
  }, []);

  return (
    <div className="w-full max-w-5xl flex flex-col gap-4">
      <div
        className={cn(
          "p-3 rounded-xl border flex flex-wrap items-center justify-between gap-2",
          isPremium ? "bg-gold/10 border-gold/30 text-gold" : "bg-white/5 border-white/10 text-white/70"
        )}
      >
        <div className="flex items-center gap-2 font-medium text-xs sm:text-sm min-w-0">
          <ShieldAlert size={16} className="shrink-0" />
          <span className="truncate">{isPremium ? "Plan Individual — Sin interrupciones" : "Plan Gratuito — Con publicidad"}</span>
        </div>

        {isPremium && (
          <button
            onClick={handlePodcastToggle}
            className={cn(
              "flex items-center gap-2 px-3 sm:px-4 py-1.5 rounded-lg font-medium transition-all text-xs sm:text-sm shrink-0",
              isPlayingThisInPodcast ? "bg-gold text-darker shadow-[0_0_15px_rgba(204,164,59,0.3)]" : "bg-transparent border border-gold hover:bg-gold/10 text-gold"
            )}
          >
            <Headphones size={16} /> Podcast <span className="hidden sm:inline">{isPlayingThisInPodcast ? "ON" : "OFF"}</span>
          </button>
        )}
      </div>

      <div className="relative aspect-video max-h-[70dvh] sm:max-h-none bg-black rounded-2xl overflow-hidden border border-white/10 shadow-2xl group transition-all duration-500 ease-in-out">
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
            className="h-16 sm:h-24 md:h-32 object-contain mb-4 sm:mb-6 opacity-80 animate-pulse drop-shadow-[0_0_15px_rgba(204,164,59,0.3)]"
          />
          <div className="flex items-center gap-2 sm:gap-3 px-4 text-center">
            <Headphones size={20} className="text-gold animate-bounce shrink-0" />
            <h3 className="text-lg sm:text-2xl font-bold text-white">Modo Podcast Activado</h3>
          </div>
          <p className="text-xs sm:text-sm text-textMuted mt-2 mb-4 sm:mb-6 px-4 text-center">Reproduciéndose en segundo plano.</p>
          
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
            {endedRef.current ? (
              <div className="flex flex-col items-center gap-4">
                <div className="w-20 h-20 rounded-full bg-green-500/20 border-2 border-green-500 flex items-center justify-center">
                  <Check size={40} className="text-green-500" />
                </div>
                <p className="text-white font-bold text-lg">Lección completada</p>
                <button
                  onClick={handlePlayRequest}
                  disabled={!videoSrc}
                  className="px-6 py-2.5 bg-gold hover:bg-goldHover text-darker font-bold rounded-lg transition-all flex items-center gap-2"
                >
                  <Play size={18} /> Reproducir de nuevo
                </button>
              </div>
            ) : (
              <button
                onClick={handlePlayRequest}
                disabled={!videoSrc}
                className={cn("w-20 h-20 rounded-full flex items-center justify-center transition-transform hover:scale-105 shadow-[0_0_30px_rgba(204,164,59,0.4)]", videoSrc ? "bg-gold hover:bg-goldHover" : "bg-gray-600 cursor-not-allowed")}
              >
                <Play size={40} className="text-darker ml-2" />
              </button>
            )}
          </div>
        )}

        {playRequested && !showAd && videoSrc && !isPlayingThisInPodcast && (
          <div className="w-full h-full absolute inset-0 bg-black z-10">
            <Stream
              streamRef={streamRef}
              src={videoSrc}
              controls
              autoplay
              preload="auto"
              className="w-full h-full border-none"
              onTimeUpdate={handleTimeUpdate}
              onEnded={handleEnded}
            />
          </div>
        )}
      </div>

      <Dialog open={showResumeModal} onOpenChange={setShowResumeModal}>
        <DialogContent className="bg-darker border-white/10 sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-white">Retomar Lección</DialogTitle>
            <DialogDescription className="text-textMuted">
              Parece que dejaste esta lección en el minuto {Math.floor(savedProgressSeconds / 60)}:{(Math.floor(savedProgressSeconds % 60)).toString().padStart(2, '0')}. ¿Qué deseas hacer?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex gap-2 sm:justify-end mt-4">
            <Button variant="outline" onClick={handleStartOver} className="bg-white/5 text-white hover:bg-white/10 border-white/10">
              Iniciar de nuevo
            </Button>
            <Button onClick={handleResume} className="bg-gold text-darker hover:bg-goldHover">
              <Play className="w-4 h-4 mr-2" /> Continuar viendo
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default LessonPlayer;
