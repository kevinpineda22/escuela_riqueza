import { useState, useRef, useEffect } from "react";
import { Play, Headphones, ShieldAlert, MonitorPlay, Check, Volume2, Maximize2, Minimize2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { usePlayerStore } from "@/stores/player.store";
import { podcastStreamRef } from "@/components/feature/PodcastEngine";
import { Stream } from "@cloudflare/stream-react";
import { fetchUserProgress, saveUserProgress, flushLessonProgress } from "@/lib/api/stream/progress";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { fetchPlatformSettings, type PlatformSettings } from "@/lib/api/admin/settings";
import { fetchActiveAdsCatalog, pickWeightedAd, incrementAdImpression, type ActiveAdVideo } from "@/lib/api/ads";

interface LessonPlayerProps {
  videoSrc?: string;
  isPremium: boolean;
  lesson?: { id: string; titulo: string; modId: string };
  moduleTitle?: string;
}

// Duración asumida solo mientras el anuncio no reportó su metadata real.
const AD_DURATION_FALLBACK = 41;
// Segundo a partir del cual se habilita "Omitir" (se recorta si el anuncio es más corto).
const AD_SKIP_SECONDS = 30;
// Si el anuncio no empezó a avanzar en este tiempo, mostramos ayuda manual al usuario.
const AD_STALL_MS = 6000;
// Y si sigue sin arrancar acá, lo salteamos: nunca dejar al usuario encerrado en el anuncio.
const AD_BAIL_MS = 14000;
const AD_VIDEO_ID_FALLBACK = "e5d953d28c8b3d1c1ae8f0b0825191be";

const LessonPlayer = ({ videoSrc, isPremium, lesson, moduleTitle }: LessonPlayerProps) => {
  const { playTrack, isPodcastMode, closePlayer, track, lastKnownTime, lastVideoId, setPlaybackProgress } = usePlayerStore();

  // Settings
  const [settings, setSettings] = useState<PlatformSettings | null>(null);
  useEffect(() => {
    fetchPlatformSettings().then(setSettings).catch(console.error);
  }, []);

  // Catálogo de anuncios (aliados activos + videos activos)
  const [adsCatalog, setAdsCatalog] = useState<ActiveAdVideo[]>([]);
  useEffect(() => {
    if (isPremium) return;
    fetchActiveAdsCatalog().then(setAdsCatalog).catch(console.error);
  }, [isPremium]);

  // Anuncio actual seleccionado (se re-pickea en cada nueva instancia)
  const [currentAd, setCurrentAd] = useState<ActiveAdVideo | null>(null);
  const currentAdSrc = currentAd?.streamUid ?? AD_VIDEO_ID_FALLBACK;

  const adConfig = {
    type: settings?.free_ad_type ?? "both",
    frequency: settings?.free_ad_frequency_seconds ?? 120,
    perBlock: settings?.free_ads_per_block ?? 1,
  };

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
  const lastSaveCallTimeRef = useRef(0);

  // Ref sincronizada con props para evitar stale closures en handlers del Stream
  const lessonRef = useRef(lesson);
  useEffect(() => { lessonRef.current = lesson; }, [lesson]);

  // Ads state (Logic using Ref to avoid stale closures in event handlers)
  const [showAd, setShowAd] = useState(false);
  const [adCurrentTime, setAdCurrentTime] = useState(0);
  // Key incremental para forzar remount del <Stream> de anuncio entre anuncios del mismo bloque
  const [adInstanceKey, setAdInstanceKey] = useState(0);
  // Duración real reportada por el anuncio (0 hasta que llega su metadata)
  const [adDuration, setAdDuration] = useState(0);
  // El anuncio SIEMPRE se monta muteado: es la única forma de que el autoplay no lo
  // bloqueen los navegadores móviles. Apenas empieza a correr intentamos activar el
  // sonido; si el navegador lo rechaza queda el botón manual.
  const [adMuted, setAdMuted] = useState(true);
  const [adStarted, setAdStarted] = useState(false);
  const [adStalled, setAdStalled] = useState(false);
  // Modo pantalla completa del anuncio. Se hace con `fixed inset-0` sobre el MISMO nodo
  // (no un portal) para no remontar el <Stream>: un remount recarga el iframe y el
  // anuncio volvería a empezar de cero.
  const [adFullscreen, setAdFullscreen] = useState(false);
  const adOverlayRef = useRef<HTMLDivElement>(null);

  // Espejos en ref para los timeouts del watchdog (evita closures con estado viejo)
  const adStartedRef = useRef(false);
  const adUnmuteTriedRef = useRef(false);


  const adTrackingRef = useRef({
    hasPrerollPlayed: false,
    lastAdTime: 0,
    remainingInBlock: 0,
    isTransitioning: false, // Lock para evitar dobles invocaciones (click + onEnded simultáneos)
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const adStreamRef = useRef<any>(null);

  // Progreso y "Omitir" se calculan sobre la duración REAL del anuncio. Antes se asumía
  // una duración fija, así que un anuncio corto nunca llegaba al umbral de omitir.
  const adTotalDuration = adDuration > 0 ? adDuration : AD_DURATION_FALLBACK;
  const adSkipAt = adDuration > 0
    ? Math.min(AD_SKIP_SECONDS, Math.max(3, adDuration - 1))
    : AD_SKIP_SECONDS;

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
    adTrackingRef.current = {
      hasPrerollPlayed: false,
      lastAdTime: 0,
      remainingInBlock: 0,
      isTransitioning: false,
    };
    setAdCurrentTime(0);
    setAdInstanceKey(0);
    setAdDuration(0);
    setAdStarted(false);
    setAdStalled(false);
    setAdMuted(true);
    adStartedRef.current = false;
    adUnmuteTriedRef.current = false;
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
    
    adTrackingRef.current.lastAdTime = 0;
    startPlayback();
  };

  /**
   * Selecciona un anuncio ponderado del catálogo y registra una impresión.
   * Si el catálogo está vacío, deja `currentAd` en null y el player usa el video fallback.
   */
  const pickAndTrackAd = () => {
    // Cada anuncio monta una instancia limpia del <Stream>: reseteamos su estado de
    // reproducción para que el watchdog y el indicador de carga arranquen de cero.
    setAdDuration(0);
    setAdStarted(false);
    setAdStalled(false);
    setAdMuted(true);
    adStartedRef.current = false;
    adUnmuteTriedRef.current = false;

    const picked = adsCatalog.length > 0 ? pickWeightedAd(adsCatalog) : null;
    setCurrentAd(picked);
    if (picked) {
      incrementAdImpression(picked.videoId);
    }
  };

  const startPlayback = () => {
    endedRef.current = false;
    
    const shouldPlayPreroll =
      !isPremium &&
      (adConfig.type === "preroll" || adConfig.type === "both") &&
      !adTrackingRef.current.hasPrerollPlayed;
    
    if (shouldPlayPreroll) {
      adTrackingRef.current.remainingInBlock = adConfig.perBlock;
      adTrackingRef.current.isTransitioning = false;
      pickAndTrackAd();
      setAdInstanceKey((k) => k + 1); // Monta una instancia fresca del Stream de anuncio
      setAdCurrentTime(0);
      setShowAd(true);
    } else {
      setPlayRequested(true);
    }
  };

  const handleResume = () => {
    setShowResumeModal(false);
    pendingSeekRef.current = savedProgressSeconds;
    adTrackingRef.current.lastAdTime = savedProgressSeconds;
    setSavedProgressSeconds(0);
    startPlayback();
  };

  const handleStartOver = () => {
    setShowResumeModal(false);
    pendingSeekRef.current = 0;
    adTrackingRef.current.lastAdTime = 0;
    setSavedProgressSeconds(0);
    startPlayback();
  };

  /**
   * Avanza el bloque de anuncios — lo dispara TANTO el click de "Omitir" COMO el evento onEnded
   * del Stream. Un lock (`isTransitioning`) garantiza que ambos eventos disparados de forma casi
   * simultánea NO produzcan un doble decremento (causa del bug de bucle infinito).
   */
  const handleAdEnd = (e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation();
      e.preventDefault();
    }
    
    if (adTrackingRef.current.isTransitioning) return;
    adTrackingRef.current.isTransitioning = true;
    
    adTrackingRef.current.remainingInBlock = Math.max(0, adTrackingRef.current.remainingInBlock - 1);
    
    if (adTrackingRef.current.remainingInBlock > 0) {
      // Aún quedan anuncios — fuerza un remount del Stream incrementando la key.
      // Esto da una instancia 100% limpia (sin estado residual del iframe anterior).
      pickAndTrackAd();
      setAdCurrentTime(0);
      setAdInstanceKey((k) => k + 1);
      // Libera el lock después de que React re-renderice
      setTimeout(() => { adTrackingRef.current.isTransitioning = false; }, 100);
    } else {
      // Bloque finalizado — vuelve al video principal
      if (!adTrackingRef.current.hasPrerollPlayed && (adConfig.type === "preroll" || adConfig.type === "both")) {
        adTrackingRef.current.hasPrerollPlayed = true;
      }
      // Si era un midroll (lastAdTime > 0), restauramos el punto donde estaba el video.
      // El <Stream> principal se desmontó al mostrar el anuncio, así que la nueva instancia
      // arranca en 0 — usamos pendingSeekRef + reset de initializedTimeRef para hacer seek.
      if (adTrackingRef.current.lastAdTime > 0) {
        pendingSeekRef.current = adTrackingRef.current.lastAdTime;
        initializedTimeRef.current = false;
      }
      setShowAd(false);
      setPlayRequested(true);
      
      // Reanudar autoplay dentro del mismo gesto del usuario
      setTimeout(() => {
        try { streamRef.current?.play(); } catch { /* autoplay restringido */ }
        adTrackingRef.current.isTransitioning = false;
      }, 100);
    }
  };

  /**
   * Watchdog del anuncio. En móvil el iframe puede quedarse sin arrancar (autoplay
   * bloqueado, red lenta, error de Cloudflare) y antes eso dejaba al usuario mirando
   * una pantalla negra sin salida. Acá: a los AD_STALL_MS ofrecemos ayuda manual y a
   * los AD_BAIL_MS abandonamos el bloque y seguimos con la lección.
   */
  useEffect(() => {
    if (!showAd) return;

    const stallTimer = window.setTimeout(() => {
      if (!adStartedRef.current) setAdStalled(true);
    }, AD_STALL_MS);

    const bailTimer = window.setTimeout(() => {
      if (adStartedRef.current) return;
      // Si este anuncio no arrancó, el siguiente del bloque tampoco va a arrancar:
      // cerramos el bloque entero en vez de encadenar fallos.
      adTrackingRef.current.remainingInBlock = 1;
      adTrackingRef.current.isTransitioning = false;
      handleAdEnd();
    }, AD_BAIL_MS);

    return () => {
      window.clearTimeout(stallTimer);
      window.clearTimeout(bailTimer);
    };
  }, [showAd, adInstanceKey]); // eslint-disable-line react-hooks/exhaustive-deps

  // Al cerrarse el anuncio siempre volvemos al tamaño encajado en el player.
  useEffect(() => {
    if (!showAd) setAdFullscreen(false);
  }, [showAd]);

  // En pantalla completa: promovemos el overlay al top layer, bloqueamos el scroll de
  // fondo y habilitamos salir con Escape.
  useEffect(() => {
    if (!adFullscreen) return;

    // El overlay vive dentro de contenedores con z-index propio (la card de la lección),
    // así que un z-index alto no alcanza para tapar el header. La Popover API lo sube al
    // top layer sin moverlo en el DOM: el <Stream> no se remonta y el anuncio no reinicia.
    const overlay = adOverlayRef.current;
    let promoted = false;
    if (overlay && typeof overlay.showPopover === "function") {
      try {
        overlay.setAttribute("popover", "manual");
        overlay.showPopover();
        promoted = true;
      } catch {
        overlay.removeAttribute("popover");
      }
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setAdFullscreen(false);
    };
    window.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
      if (promoted && overlay) {
        try { overlay.hidePopover(); } catch { /* ya cerrado */ }
        overlay.removeAttribute("popover");
      }
    };
  }, [adFullscreen]);

  /** Marca el anuncio como efectivamente reproduciéndose e intenta activar el sonido. */
  const markAdStarted = () => {
    if (adStartedRef.current) return;
    adStartedRef.current = true;
    setAdStarted(true);
    setAdStalled(false);

    // Se monta muteado para que el autoplay móvil no lo bloquee; una vez que ya está
    // corriendo intentamos subir el audio. Si el navegador lo revierte, onVolumeChange
    // vuelve a mostrar el botón "Activar sonido".
    if (adUnmuteTriedRef.current) return;
    adUnmuteTriedRef.current = true;
    const el = adStreamRef.current;
    if (!el) return;
    try {
      el.muted = false;
      el.volume = 1;
      setAdMuted(false);
    } catch { /* el navegador mantiene el mute; queda el botón manual */ }
  };

  /** Tap del usuario sobre el anuncio: destraba reproducción y sonido dentro del gesto. */
  const handleAdTap = () => {
    const el = adStreamRef.current;
    if (!el) return;
    try {
      el.muted = false;
      el.volume = 1;
      setAdMuted(false);
    } catch { /* sin sonido, pero seguimos intentando reproducir */ }
    try {
      const played = el.play?.();
      // Si el navegador rechaza el play con audio, reintentamos muteado (siempre permitido).
      played?.catch?.(() => {
        try {
          el.muted = true;
          setAdMuted(true);
          el.play?.();
        } catch { /* sin salida: el watchdog lo va a saltear */ }
      });
    } catch { /* sin salida: el watchdog lo va a saltear */ }
  };

  const handlePodcastToggle = () => {
    if (isPlayingThisInPodcast) {
      // Leer el tiempo actual del engine antes de cerrarlo
      const latestTime = podcastStreamRef.current?.currentTime ?? usePlayerStore.getState().lastKnownTime;
      const engineDuration = podcastStreamRef.current?.duration;
      closePlayer();
      // El Stream local se montará con autoplay en el próximo render.
      // Guardamos el tiempo exacto para restaurarlo en el primer onTimeUpdate.
      pendingSeekRef.current = latestTime;
      setPlayRequested(true);
      // Persistir el minuto exacto del cambio: si no, queda solo en el store local
      // y la base se quedaría con el último guardado periódico (hasta 10s atrás).
      flushLessonProgress(lessonRef.current?.id, latestTime, engineDuration).catch(() => {});
    } else if (videoSrc && lesson && moduleTitle) {
      setPlayRequested(false);
      const currentTimeToPass = streamRef.current?.currentTime ?? lastKnownTime;
      const videoDuration = streamRef.current?.duration;

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

      // Se dispara al final para no interponer nada entre el gesto del usuario y
      // el desbloqueo de autoplay. No usa await: no difiere el resto del handler.
      flushLessonProgress(lesson.id, currentTimeToPass, videoDuration).catch(() => {});
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

    // Check for midroll ad
    if (!isPremium && playRequested && !showAd && (adConfig.type === "midroll" || adConfig.type === "both")) {
      if (currentTime < adTrackingRef.current.lastAdTime) {
        // User seeked backwards, reset the timer to current time
        adTrackingRef.current.lastAdTime = currentTime;
      } else if (currentTime - adTrackingRef.current.lastAdTime >= adConfig.frequency) {
        adTrackingRef.current.lastAdTime = currentTime;
        adTrackingRef.current.remainingInBlock = adConfig.perBlock;
        adTrackingRef.current.isTransitioning = false;
        pickAndTrackAd();
        setAdInstanceKey((k) => k + 1);
        setAdCurrentTime(0);
        setShowAd(true);
        return;
      }
    }
    
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
      if (!currentLesson) return;

      // En modo podcast el <Stream> local NO está montado (lo desmontamos para no
      // tener dos iframes del mismo UID), así que streamRef está vacío y el tiempo
      // vivo lo tiene el engine. Leemos del store con getState para no depender de
      // un closure que quedó congelado en el primer render.
      const { isPodcastMode, track } = usePlayerStore.getState();
      const listeningThisLesson =
        isPodcastMode && track != null && String(track.id) === String(currentLesson.id);
      const el = listeningThisLesson ? podcastStreamRef.current : streamRef.current;

      const currentTime = el?.currentTime;
      if (!currentTime || currentTime <= 5) return;
      flushLessonProgress(currentLesson.id, currentTime, el?.duration).catch(() => {});
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
            data-testid="podcast-toggle"
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
          <div
            ref={adOverlayRef}
            data-testid="ad-overlay"
            className={cn(
              "bg-black flex flex-col items-center justify-center",
              adFullscreen
                // `m-0 p-0 border-0 max-w-none max-h-none` neutraliza los estilos que el
                // navegador aplica por defecto a un elemento con `popover`.
                ? "fixed inset-0 z-[100] w-screen h-[100dvh] m-0 p-0 border-0 max-w-none max-h-none"
                : "absolute inset-0 z-40"
            )}
          >
            {/* Degradados: dan contraste a los controles sin tapar el centro del anuncio */}
            <div className="absolute inset-x-0 top-0 h-16 sm:h-20 z-40 bg-gradient-to-b from-black/70 to-transparent pointer-events-none" />
            <div className="absolute inset-x-0 bottom-0 h-20 sm:h-24 z-40 bg-gradient-to-t from-black/70 to-transparent pointer-events-none" />

            <div
              className={cn(
                "absolute left-2 sm:left-4 z-50 bg-black/50 backdrop-blur-md px-2 py-1 sm:px-3 sm:py-1.5 border border-white/10 text-[9px] sm:text-xs font-bold text-white uppercase tracking-wider rounded-md sm:rounded-lg flex items-center gap-1.5 pointer-events-none",
                adFullscreen ? "top-[max(0.5rem,env(safe-area-inset-top))]" : "top-2 sm:top-4"
              )}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-gold animate-pulse"></span>
              Publicidad
            </div>

            <button
              type="button"
              onClick={e => { e.stopPropagation(); setAdFullscreen(v => !v); }}
              aria-label={adFullscreen ? "Salir de pantalla completa" : "Ver en pantalla completa"}
              className={cn(
                "absolute right-2 sm:right-4 z-50 p-2 sm:p-2.5 rounded-md sm:rounded-lg bg-black/50 hover:bg-black/70 backdrop-blur-md border border-white/10 text-white transition-colors",
                adFullscreen ? "top-[max(0.5rem,env(safe-area-inset-top))]" : "top-2 sm:top-4"
              )}
            >
              {adFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
            </button>

            {/* En pantalla completa el iframe conserva el aspect ratio del anuncio: si lo
                estiramos al alto del viewport, el player de Cloudflare recorta la imagen. */}
            <div
              className={cn(
                "pointer-events-none flex items-center justify-center bg-black",
                adFullscreen
                  // Con el teléfono vertical manda el ancho; girado manda el alto. Fijar
                  // una sola dimensión rompía la proporción en la otra orientación.
                  ? "relative aspect-video portrait:w-full landscape:h-full"
                  : "absolute inset-0 w-full h-full"
              )}
            >
              <Stream
                key={adInstanceKey}
                streamRef={adStreamRef}
                src={currentAdSrc}
                controls={false}
                autoplay
                muted
                preload="auto"
                letterboxColor="transparent"
                // En pantalla completa anulamos el padding-top con el que <Stream> simula
                // el aspect ratio: descentraba el video. Cloudflare ya hace letterbox.
                className={cn(
                  "w-full h-full [&>iframe]:w-full [&>iframe]:h-full",
                  adFullscreen && "!pt-0"
                )}
                onLoadedMetaData={() => {
                  const d = adStreamRef.current?.duration;
                  if (typeof d === "number" && d > 0) setAdDuration(d);
                }}
                onDurationChange={() => {
                  const d = adStreamRef.current?.duration;
                  if (typeof d === "number" && d > 0) setAdDuration(d);
                }}
                onPlaying={markAdStarted}
                onVolumeChange={() => {
                  // El navegador puede revertir el unmute: reflejamos el estado real.
                  if (adStreamRef.current) setAdMuted(Boolean(adStreamRef.current.muted));
                }}
                onError={() => {
                  // Anuncio roto: cerramos el bloque y seguimos con la lección.
                  adTrackingRef.current.remainingInBlock = 1;
                  adTrackingRef.current.isTransitioning = false;
                  handleAdEnd();
                }}
                onTimeUpdate={() => {
                  if (!adStreamRef.current) return;
                  const t = adStreamRef.current.currentTime;
                  setAdCurrentTime(t);
                  if (t > 0) markAdStarted();
                }}
                onEnded={() => handleAdEnd()}
              />
            </div>

            {/* Capa de tap: el iframe no recibe eventos, así que un toque en cualquier
                parte del anuncio destraba reproducción y sonido dentro del gesto real. */}
            <button
              type="button"
              onClick={handleAdTap}
              aria-label={adStarted ? "Activar sonido del anuncio" : "Reproducir anuncio"}
              className="absolute inset-0 z-[45] cursor-default"
            />

            {!adStarted && (
              <div className="absolute inset-0 z-[46] flex flex-col items-center justify-center gap-4 bg-black px-6 text-center pointer-events-none">
                <div className="w-10 h-10 rounded-full border-2 border-white/15 border-t-gold animate-spin" />
                {adStalled ? (
                  <>
                    <p className="text-sm text-white/70">El anuncio está tardando en cargar.</p>
                    <button
                      type="button"
                      onClick={handleAdTap}
                      className="pointer-events-auto bg-gold hover:bg-goldHover text-darker font-bold px-6 py-2.5 rounded-lg transition-all"
                    >
                      Tocá para reproducir
                    </button>
                    <button
                      type="button"
                      onClick={handleAdEnd}
                      className="pointer-events-auto text-xs text-white/50 hover:text-white underline underline-offset-4"
                    >
                      Continuar con la lección
                    </button>
                  </>
                ) : (
                  <p className="text-xs text-white/50">Cargando anuncio...</p>
                )}
              </div>
            )}

            {/* Fila de controles: sonido a la izquierda, omitir a la derecha. Compactos en
                móvil para no taparle la imagen al aliado. */}
            <div
              className={cn(
                "absolute left-2 right-2 sm:left-4 sm:right-4 z-50 flex items-center justify-between gap-2",
                adFullscreen
                  ? "bottom-[max(1.25rem,env(safe-area-inset-bottom))]"
                  : "bottom-3 sm:bottom-5"
              )}
            >
              {adStarted && adMuted ? (
                <button
                  type="button"
                  onClick={handleAdTap}
                  className="bg-white/10 hover:bg-white/20 backdrop-blur-md border border-white/20 text-white text-[11px] sm:text-sm font-bold px-2.5 py-1.5 sm:px-4 sm:py-2 rounded-md sm:rounded-lg flex items-center gap-1.5 transition-colors shrink-0"
                >
                  <Volume2 size={14} />
                  <span className="hidden min-[380px]:inline">Activar sonido</span>
                </button>
              ) : (
                <span />
              )}

              {adCurrentTime >= adSkipAt ? (
                <button
                  onClick={handleAdEnd}
                  className="bg-gold hover:bg-goldHover text-darker font-bold text-xs sm:text-sm px-3 py-1.5 sm:px-6 sm:py-2 rounded-md sm:rounded-lg transition-all shadow-[0_0_15px_rgba(204,164,59,0.5)] animate-in fade-in zoom-in duration-300 shrink-0"
                >
                  Omitir ⏭
                </button>
              ) : (
                <div className="bg-black/50 backdrop-blur-md px-2.5 py-1.5 sm:px-4 sm:py-2 border border-white/10 text-[11px] sm:text-xs font-medium text-white/90 rounded-md sm:rounded-lg shrink-0">
                  Omitir en {Math.max(0, Math.ceil(adSkipAt - adCurrentTime))}s
                </div>
              )}
            </div>

            {/* Barra de progreso al ras del borde inferior — no roba área visible al anuncio */}
            <div className="absolute inset-x-0 bottom-0 z-50 h-1 bg-white/10">
              <div
                className="h-full bg-gold/80 transition-all duration-300"
                style={{ width: `${Math.min((adCurrentTime / adTotalDuration) * 100, 100)}%` }}
              ></div>
            </div>
          </div>
        )}

        {!playRequested && !showAd && (
          <div className="absolute inset-0 z-20 bg-darker flex items-center justify-center p-3 sm:p-4">
            {endedRef.current ? (
              // En móvil el contenedor es un aspect-video bajito: sin escalar, el botón
              // "Reproducir de nuevo" se salía de la caja.
              <div className="flex flex-col items-center gap-2 sm:gap-4 max-w-full">
                <div className="w-12 h-12 sm:w-20 sm:h-20 rounded-full bg-green-500/20 border-2 border-green-500 flex items-center justify-center shrink-0">
                  <Check className="text-green-500 w-6 h-6 sm:w-10 sm:h-10" />
                </div>
                <p className="text-white font-bold text-sm sm:text-lg text-center">Lección completada</p>
                <button
                  onClick={handlePlayRequest}
                  disabled={!videoSrc}
                  className="px-4 py-2 sm:px-6 sm:py-2.5 bg-gold hover:bg-goldHover text-darker font-bold text-xs sm:text-base rounded-lg transition-all flex items-center gap-2 shrink-0"
                >
                  <Play size={16} className="shrink-0" /> Reproducir de nuevo
                </button>
              </div>
            ) : (
              <button
                data-testid="main-play-button"
                onClick={handlePlayRequest}
                disabled={!videoSrc}
                className={cn("w-16 h-16 sm:w-20 sm:h-20 rounded-full flex items-center justify-center transition-transform hover:scale-105 shadow-[0_0_30px_rgba(204,164,59,0.4)]", videoSrc ? "bg-gold hover:bg-goldHover" : "bg-gray-600 cursor-not-allowed")}
              >
                <Play className="text-darker ml-1.5 sm:ml-2 w-8 h-8 sm:w-10 sm:h-10" />
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
