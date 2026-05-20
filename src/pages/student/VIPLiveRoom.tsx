import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "motion/react";
import LiveChat, { type ChatMessage } from "@/components/feature/LiveChat";
import { Sparkles, Calendar, Clock, Tv, Radio, Loader2, VideoOff, ArrowLeft, Volume2, PanelRightClose, PanelRightOpen, Users } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { usePlayerStore } from "@/stores/player.store";
import { useAuthStore } from "@/stores/auth.store";
import { supabase } from "@/lib/supabase";
import { fetchActiveLive, checkLiveInputStatus, type LiveEvent } from "@/lib/api/stream/lives";
import { useIsDesktop } from "@/hooks/useMediaQuery";
import LiveHLSPlayer, { type LiveHLSPlayerHandle, type QualityLevel } from "@/components/feature/LiveHLSPlayer";
import LivePlayerControls from "@/components/feature/LivePlayerControls";

// Extraer customer code del subdominio "customer-XXX.cloudflarestream.com"
// para construir el manifest URL de Cloudflare Stream.
const CF_CUSTOMER_CODE = (import.meta.env.VITE_CLOUDFLARE_STREAM_CUSTOMER_SUBDOMAIN || "").match(/customer-([^.]+)/)?.[1] || "";

interface ViewerInfo {
  user_id: string;
  full_name: string;
  avatar_url: string | null;
  plan: "free" | "individual" | "vip";
  online_at: string;
}

const VIPLiveRoom = () => {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [live, setLive] = useState<LiveEvent | null>(null);
  const [loading, setLoading] = useState(true);
  const [showIntro, setShowIntro] = useState(false);
  const [timeLeft, setTimeLeft] = useState({ hours: 0, minutes: 0, seconds: 0 });
  const [liveInputConnected, setLiveInputConnected] = useState(false);
  // Estados SEPARADOS de audio (antes estaban acoplados en `audioEnabled` y eso
  // hacía que al mutear desde los controles, el overlay reapareciera):
  //  - audioPromptDismissed: flag de "una vez". Una vez que el usuario clickea
  //    "Activar sonido", el overlay NUNCA vuelve a aparecer en esta sesión.
  //  - isMuted: estado actual de mute del player. Independiente del overlay.
  const [audioPromptDismissed, setAudioPromptDismissed] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const [isChatVisibleDesktop, setIsChatVisibleDesktop] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);
  const [viewers, setViewers] = useState<ViewerInfo[]>([]);
  const [showViewersList, setShowViewersList] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isBuffering, setIsBuffering] = useState(false);
  const [qualityLevels, setQualityLevels] = useState<QualityLevel[]>([]);
  const [currentQualityLevel, setCurrentQualityLevel] = useState(-1);
  const playerWrapperRef = useRef<HTMLDivElement>(null);
  const isDesktop = useIsDesktop();
  const { clearPlayer } = usePlayerStore();
  const livePlayerRef = useRef<LiveHLSPlayerHandle | null>(null);

  useEffect(() => { clearPlayer(); }, [clearPlayer]);

  // Resetea unreads al volver a mostrar el chat (solo aplica en desktop;
  // en mobile el chat siempre está visible — split fijo 50/50).
  useEffect(() => {
    if (!isDesktop || isChatVisibleDesktop) setUnreadCount(0);
  }, [isDesktop, isChatVisibleDesktop]);

  const handleIncomingMessage = (msg: ChatMessage) => {
    if (msg.isSystem) return;
    if (msg.user_id === user?.id) return;
    // Solo contamos unreads cuando el chat está oculto en desktop.
    // En mobile siempre está visible, así que no aplica.
    if (isDesktop && !isChatVisibleDesktop) setUnreadCount(c => c + 1);
  };

  const handleEnableAudio = () => {
    setAudioPromptDismissed(true);
    setIsMuted(false);
    const video = livePlayerRef.current?.video;
    if (!video) return;
    try {
      video.muted = false;
      video.volume = 1;
      const result = video.play();
      if (result && typeof result.catch === "function") {
        result.catch(() => {});
      }
    } catch (e) {
      console.warn("[VIPLiveRoom] No se pudo desmutear:", e);
    }
  };

  const handleTogglePlay = () => {
    const video = livePlayerRef.current?.video;
    if (!video) return;
    try {
      if (isPlaying) {
        video.pause();
      } else {
        const result = video.play();
        if (result && typeof result.catch === "function") result.catch(() => {});
      }
    } catch (e) {
      console.warn("[VIPLiveRoom] play/pause error:", e);
    }
  };

  const handleToggleMute = () => {
    const video = livePlayerRef.current?.video;
    if (!video) return;
    const next = !isMuted;
    setIsMuted(next);
    try {
      video.muted = next;
      if (!next && video.volume === 0) video.volume = 1;
    } catch (e) {
      console.warn("[VIPLiveRoom] toggle mute error:", e);
    }
  };

  const handleSelectQualityLevel = (index: number) => {
    livePlayerRef.current?.setQualityLevel(index);
    setCurrentQualityLevel(index);
  };

  const isLive = live?.status === "live" && !live?.is_paused;
  const isEnded = live?.status === "ended";
  const isPaused = live?.is_paused === true;
  const startsAt = live?.starts_at ? new Date(live.starts_at).getTime() : 0;
  const showIframe = !isPaused && (isLive || liveInputConnected);
  const hasStreamId = Boolean(live?.stream_live_input_id);

  // Fetch active live on mount + validate plan access
  useEffect(() => {
    if (!user) return;
    fetchActiveLive()
      .then(active => {
        setLive(active);
        if (active && !active.allowed_plans?.includes(user.plan)) {
          navigate("/dashboard", { replace: true });
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [user, navigate]);

  // Trigger intro when status transitions to live
  useEffect(() => {
    if (live?.status !== "live" || showIntro) return;
    setShowIntro(true);
    const t = setTimeout(() => setShowIntro(false), 3500);
    return () => clearTimeout(t);
  }, [live?.id, live?.status]);

  // Suscripción Realtime a TODA la tabla lives
  useEffect(() => {
    const channel = supabase
      .channel("vip-live-all-changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "lives" },
        async () => {
          const active = await fetchActiveLive();
          setLive(active);
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  // Polling 3s como fallback
  useEffect(() => {
    const poll = setInterval(async () => {
      const active = await fetchActiveLive();
      setLive(active);
    }, 3000);
    return () => clearInterval(poll);
  }, []);

  // Presencia en tiempo real: quién está viendo el live ahora.
  // Cada cliente se registra en un canal exclusivo del live; al cerrar pestaña
  // Supabase lo saca solo (~30s). Dedupe por user_id para evitar duplicados
  // cuando alguien abre la misma cuenta en dos pestañas.
  useEffect(() => {
    if (!live?.id || !user) return;

    const channel = supabase.channel(`live_presence:${live.id}`, {
      config: { presence: { key: user.id } },
    });

    const myPresence: ViewerInfo = {
      user_id: user.id,
      full_name: user.fullName || "Usuario",
      avatar_url: user.avatarUrl,
      plan: user.plan,
      online_at: new Date().toISOString(),
    };

    channel
      .on("presence", { event: "sync" }, () => {
        const state = channel.presenceState<ViewerInfo>();
        const unique = new Map<string, ViewerInfo>();
        Object.values(state).flat().forEach(v => {
          if (v?.user_id) unique.set(v.user_id, v);
        });
        setViewers([...unique.values()]);
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await channel.track(myPresence);
        }
      });

    return () => {
      channel.untrack().catch(() => {});
      supabase.removeChannel(channel);
    };
  }, [live?.id, user?.id, user?.fullName, user?.avatarUrl, user?.plan]);

  // Poll Cloudflare Live Input status: si OBS está transmitiendo, mostrar iframe aunque falte starts_at
  useEffect(() => {
    if (!live?.stream_live_input_id || isEnded) return;
    
    let failCount = 0;
    let poll: ReturnType<typeof setInterval>;
    
    const check = async () => {
      const { connected, isError, disabled } = await checkLiveInputStatus(live.stream_live_input_id!);
      if (disabled) { clearInterval(poll); return; }
      if (isError) {
        failCount++;
        if (failCount >= 3) {
          clearInterval(poll);
          return;
        }
      } else {
        failCount = 0;
      }
      setLiveInputConnected(prev => connected !== prev ? connected : prev);
    };
    
    check();
    poll = setInterval(check, 10000);
    return () => clearInterval(poll);
  }, [live?.id, live?.stream_live_input_id, isEnded]);

  // Countdown — solo si starts_at está en el futuro, no ended y OBS no conectado
  useEffect(() => {
    if (!live?.starts_at || showIframe || isEnded) return;
    const timer = setInterval(() => {
      const diff = Math.max(0, startsAt - Date.now());
      setTimeLeft({
        hours: Math.floor(diff / 3600000),
        minutes: Math.floor((diff % 3600000) / 60000),
        seconds: Math.floor((diff % 60000) / 1000),
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [live?.id, live?.status, live?.starts_at, showIframe]);

  if (loading) {
    return (
      <div className="min-h-[100dvh] bg-black flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-gold" />
      </div>
    );
  }

  if (!live) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center p-6">
        <div className="text-center max-w-md">
          <Radio size={48} className="mx-auto text-white/20 mb-6" />
          <h2 className="text-2xl font-bold text-white mb-2">No hay eventos programados</h2>
          <p className="text-textMuted">Los próximos encuentros VIP aparecerán aquí. Vuelve pronto.</p>
        </div>
      </div>
    );
  }

  // Mobile: split fijo 50/50 entre video y chat (estilo Twitch/Kick/YouTube).
  // El usuario expande a fullscreen landscape con el botón nativo de Cloudflare.
  const mobileVideoHeightClass = "h-[50dvh] shrink-0";

  return (
    <div className="h-[100dvh] bg-black text-textMain flex flex-col md:flex-row overflow-hidden font-sans">
      <div className={cn(
        "flex flex-col relative",
        isDesktop ? "flex-1 md:h-screen" : mobileVideoHeightClass
      )}>
        {/* Cinematic Intro Overlay */}
        <AnimatePresence>
          {showIntro && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[100] bg-black flex flex-col items-center justify-center overflow-hidden"
            >
              <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1.1, opacity: 1 }}
                transition={{ duration: 2, ease: "easeOut" }}
                className="relative"
              >
                <div className="absolute inset-0 bg-gold blur-[100px] opacity-20 animate-pulse" />
                <img
                  src="https://imagedelivery.net/HGkLNfdVjFNAti8ZHHgxtQ/18dc9190-6625-4b89-8f1e-3f221e96b500/public"
                  alt="Logo"
                  className="h-32 object-contain relative z-10"
                />
              </motion.div>
              <motion.div
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 1, duration: 1 }}
                className="mt-8 text-center z-10"
              >
                <h2 className="text-2xl font-bold text-gold tracking-[0.3em] uppercase mb-2">Conectando señal</h2>
                <div className="flex gap-1 justify-center">
                  {[1, 2, 3].map((i) => (
                    <motion.div
                      key={i}
                      animate={{ scaleY: [1, 2, 1], opacity: [0.3, 1, 0.3] }}
                      transition={{ repeat: Infinity, duration: 1, delay: i * 0.2 }}
                      className="w-1 h-4 bg-gold rounded-full"
                    />
                  ))}
                </div>
              </motion.div>
              <div className="absolute inset-0 pointer-events-none bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] bg-[length:100%_4px,3px_100%]" />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Header Overlay */}
        <motion.div
          initial={{ y: -100 }}
          animate={{ y: 0 }}
          className="absolute top-0 left-0 w-full p-3 sm:p-5 md:p-8 z-40 flex justify-between items-start gap-3 pointer-events-none"
        >
          <div className="flex items-center gap-2 sm:gap-4 pointer-events-auto min-w-0 flex-1">
            <button
              onClick={() => navigate("/dashboard")}
              aria-label="Volver al dashboard"
              className="p-2 sm:p-2.5 bg-black/50 backdrop-blur-md border border-white/10 rounded-xl sm:rounded-2xl text-white/80 hover:text-white hover:bg-black/70 transition-colors shrink-0"
            >
              <ArrowLeft size={18} />
            </button>
            <div className="p-2 sm:p-2.5 bg-black/40 backdrop-blur-md border border-white/10 rounded-xl sm:rounded-2xl shrink-0">
              <img
                src="https://imagedelivery.net/HGkLNfdVjFNAti8ZHHgxtQ/18dc9190-6625-4b89-8f1e-3f221e96b500/public"
                alt="Logo"
                className="h-7 sm:h-10 object-contain"
              />
            </div>
            <div className="hidden md:block min-w-0">
              <h1 className="font-extrabold text-base lg:text-xl leading-tight text-white tracking-tight drop-shadow-2xl truncate">
                {live.title || "Sesión de Riqueza"} <span className="text-gold">VIP</span>
              </h1>
              <div className="flex items-center gap-2 mt-1">
                <Sparkles size={12} className="text-gold" />
                <span className="text-[10px] text-white/60 uppercase font-black tracking-[0.2em]">Encuentro con Iván Mazo</span>
              </div>
            </div>
          </div>

          <div className="flex flex-col items-end gap-2 sm:gap-3 pointer-events-auto shrink-0">
            {isEnded ? (
              <div className="flex items-center gap-1.5 sm:gap-2.5 bg-gray-600/20 backdrop-blur-md border border-gray-600/50 text-textMuted px-2.5 sm:px-4 py-1.5 sm:py-2 rounded-xl sm:rounded-2xl text-[9px] sm:text-[10px] font-black tracking-widest">
                <VideoOff size={12} /> FINALIZADO
              </div>
            ) : isPaused ? (
              <div className="flex items-center gap-1.5 sm:gap-2.5 bg-yellow-600/20 backdrop-blur-md border border-yellow-600/50 text-yellow-500 px-2.5 sm:px-4 py-1.5 sm:py-2 rounded-xl sm:rounded-2xl text-[9px] sm:text-[10px] font-black tracking-widest">
                <VideoOff size={12} /> EN PAUSA
              </div>
            ) : isLive ? (
              <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="flex items-center gap-1.5 sm:gap-2.5 bg-red-600/20 backdrop-blur-md border border-red-600/50 text-red-500 px-2.5 sm:px-4 py-1.5 sm:py-2 rounded-xl sm:rounded-2xl text-[10px] sm:text-xs font-black tracking-widest shadow-[0_0_30px_rgba(220,38,38,0.2)]"
              >
                <motion.span
                  animate={{ scale: [1, 1.4, 1], opacity: [1, 0.5, 1] }}
                  transition={{ repeat: Infinity, duration: 2 }}
                  className="w-2 h-2 sm:w-2.5 sm:h-2.5 bg-red-500 rounded-full shadow-[0_0_10px_rgba(220,38,38,1)]"
                />
                EN VIVO
              </motion.div>
            ) : (
              <div className="flex items-center gap-1.5 sm:gap-2.5 bg-black/40 backdrop-blur-md border border-white/10 text-white/70 px-2.5 sm:px-4 py-1.5 sm:py-2 rounded-xl sm:rounded-2xl text-[9px] sm:text-[10px] font-bold tracking-wider">
                <Clock size={12} className="text-gold" />
                {showIframe ? "EN ESPERA" : "PRÓXIMAMENTE"}
              </div>
            )}

            {/* Viewers badge — quién está conectado al live ahora */}
            {!isEnded && viewers.length > 0 && (
              <button
                onClick={() => setShowViewersList(true)}
                aria-label={`${viewers.length} conectados`}
                className="flex items-center gap-1.5 sm:gap-2 bg-black/50 backdrop-blur-md border border-gold/20 text-white/85 hover:text-gold hover:border-gold/50 hover:bg-black/70 px-2.5 sm:px-3.5 py-1.5 sm:py-2 rounded-xl sm:rounded-2xl text-[10px] sm:text-xs font-black tracking-wide active:scale-95 transition-all"
              >
                <Users size={12} className="text-gold" />
                <span>{viewers.length}</span>
              </button>
            )}
          </div>
        </motion.div>

        {/* Content Area */}
        <div className="flex-1 flex items-center justify-center bg-[#050505] relative overflow-y-auto overflow-x-hidden">
          <div className="absolute inset-0 z-0">
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full bg-[radial-gradient(circle_at_center,rgba(204,164,59,0.05)_0%,transparent_70%)]" />
            <div className="absolute inset-0 opacity-[0.03] bg-[url('https://www.transparenttextures.com/patterns/stardust.png')]" />

            {!isLive && !isEnded && !isPaused && (
              <div
                className="absolute inset-0 bg-cover bg-center"
                style={{ backgroundImage: live.background_image_url ? `url('${live.background_image_url}')` : undefined }}
              >
                <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-black/80" />
              </div>
            )}
          </div>

          <AnimatePresence mode="wait">
            {showIframe && hasStreamId ? (
              <motion.div
                key="player"
                initial={false}
                className="w-full h-full relative bg-black flex items-center justify-center"
              >
                {/* Fade-in cinemático en una capa SEPARADA del player.
                    El <Stream> siempre arranca visible para que Android Chrome
                    no pierda la pista de video durante la transición. */}
                <motion.div
                  aria-hidden
                  initial={{ opacity: 1 }}
                  animate={{ opacity: 0 }}
                  transition={{ duration: 1, delay: 0.3 }}
                  className="absolute inset-0 z-20 bg-black pointer-events-none"
                />
                <div ref={playerWrapperRef} className="w-full h-full absolute inset-0 z-0 bg-black">
                  <LiveHLSPlayer
                    ref={livePlayerRef}
                    liveInputId={live.stream_live_input_id!}
                    customerCode={CF_CUSTOMER_CODE}
                    muted={isMuted}
                    autoPlay
                    className="w-full h-full object-contain bg-black"
                    onPlay={() => { setIsPlaying(true); setIsBuffering(false); }}
                    onPause={() => setIsPlaying(false)}
                    onWaiting={() => setIsBuffering(true)}
                    onPlaying={() => { setIsBuffering(false); setIsPlaying(true); }}
                    onLevelsChange={(lvls, current) => {
                      setQualityLevels(lvls);
                      setCurrentQualityLevel(current);
                    }}
                  />
                  <LivePlayerControls
                    playerRef={livePlayerRef}
                    isPlaying={isPlaying}
                    isBuffering={isBuffering}
                    isMuted={isMuted}
                    levels={qualityLevels}
                    currentLevel={currentQualityLevel}
                    onTogglePlay={handleTogglePlay}
                    onToggleMute={handleToggleMute}
                    onSelectLevel={handleSelectQualityLevel}
                  />
                  {/* Audio overlay — solo aparece UNA VEZ al ingresar al live.
                      Una vez dismissed, no reaparece aunque el usuario mutee o
                      ponga el volumen a 0 desde los controles. */}
                  <AnimatePresence>
                    {!audioPromptDismissed && (
                      <motion.div
                        key="enable-audio-overlay"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.3 }}
                        className="absolute inset-0 z-40 flex items-center justify-center bg-black/40 backdrop-blur-[3px] cursor-pointer"
                        onClick={handleEnableAudio}
                      >
                        <motion.button
                          onClick={handleEnableAudio}
                          aria-label="Activar sonido del live"
                          initial={{ scale: 0.85, opacity: 0, y: 12 }}
                          animate={{ scale: 1, opacity: 1, y: 0 }}
                          exit={{ scale: 0.9, opacity: 0 }}
                          transition={{ type: "spring", damping: 18, stiffness: 220 }}
                          whileHover={{ scale: 1.04 }}
                          whileTap={{ scale: 0.96 }}
                          className="relative flex items-center gap-3 px-7 py-4 sm:px-9 sm:py-5 rounded-full bg-gradient-to-br from-gold via-goldHover to-gold text-darker font-black text-base sm:text-lg tracking-tight shadow-[0_25px_60px_-10px_rgba(204,164,59,0.7)] ring-1 ring-gold/50"
                        >
                          {/* Pulse rings */}
                          <span className="absolute inset-0 rounded-full bg-gold/50 animate-ping pointer-events-none" />
                          <span className="absolute inset-0 rounded-full bg-gold/30 animate-ping pointer-events-none [animation-delay:0.6s]" />

                          {/* Content */}
                          <span className="relative flex items-center justify-center w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-darker/15">
                            <Volume2 size={18} strokeWidth={2.5} className="text-darker" />
                          </span>
                          <span className="relative">Activar sonido</span>
                        </motion.button>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </motion.div>
            ) : isEnded ? (
              <motion.div
                key="ended"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="w-full h-full flex items-center justify-center bg-black/80 relative"
              >
                <div className="text-center p-8 z-10">
                  <VideoOff size={64} className="mx-auto text-white/20 mb-6" />
                  <h2 className="text-2xl font-bold text-white mb-2">Transmisión finalizada</h2>
                  <p className="text-textMuted max-w-md mx-auto">Gracias por acompañarnos. Podés seguir conversando en el chat.</p>
                </div>
              </motion.div>
            ) : isPaused ? (
              <motion.div
                key="paused"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="w-full h-full flex items-center justify-center bg-black/80 relative"
              >
                <div className="text-center p-8 z-10">
                  <VideoOff size={64} className="mx-auto text-yellow-500/50 mb-6" />
                  <h2 className="text-2xl font-bold text-white mb-2">Transmisión en Pausa</h2>
                  <p className="text-textMuted max-w-md mx-auto">La transmisión se ha pausado temporalmente. Volveremos en breve.</p>
                </div>
              </motion.div>
            ) : !hasStreamId ? (
              <motion.div
                key="no-stream"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="w-full h-full flex items-center justify-center z-10"
              >
                <div className="text-white text-center p-12 bg-darker rounded-3xl border border-white/5">
                  <div className="w-16 h-16 bg-red-500/20 text-red-500 rounded-full flex items-center justify-center mx-auto mb-6">
                    <Tv size={32} />
                  </div>
                  <h3 className="text-2xl font-bold mb-2">Señal no configurada</h3>
                  <p className="text-textMuted max-w-sm mx-auto">El stream ID de Cloudflare no está vinculado a esta sala. Contactá al administrador.</p>
                </div>
              </motion.div>
            ) : !showIframe ? (
              <motion.div
                key="waiting"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 1.1 }}
                transition={{ duration: 0.8 }}
                className="text-center z-10 px-4 sm:px-6 pt-20 sm:pt-24 md:pt-0 pb-24 md:pb-0 max-w-4xl mx-auto"
              >
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mb-6 sm:mb-12 inline-flex items-center gap-2 sm:gap-3 px-4 sm:px-6 py-2 sm:py-2.5 bg-gold/5 border border-gold/20 rounded-full"
                >
                  <Calendar size={14} className="text-gold" />
                  <span className="text-[11px] sm:text-sm font-bold text-gold/80 tracking-widest uppercase">Próximo Encuentro VIP</span>
                </motion.div>

                <h2 className="text-3xl sm:text-5xl md:text-7xl font-black mb-6 sm:mb-8 text-white tracking-tight md:tracking-tighter leading-[1.1] text-balance">
                  {live.title ? (
                    live.title
                  ) : (
                    <>El conocimiento es la<br />
                    <span className="text-transparent bg-clip-text bg-gradient-to-r from-gold via-goldHover to-gold">
                      moneda definitiva
                    </span></>
                  )}
                </h2>

                {live.description && (
                  <p className="text-textMuted mb-10 sm:mb-16 text-sm sm:text-lg md:text-xl max-w-2xl mx-auto font-medium leading-relaxed text-balance">
                    {live.description}
                  </p>
                )}

                {live.starts_at && (
                  <div className="flex justify-center gap-2 sm:gap-4 md:gap-10">
                    {[
                      { val: timeLeft.hours, label: "Horas" },
                      { val: timeLeft.minutes, label: "Minutos" },
                      { val: timeLeft.seconds, label: "Segundos", highlight: true },
                    ].map((unit, idx) => (
                      <div key={idx} className="flex flex-col items-center">
                        <div
                          className={cn(
                            "relative w-16 h-20 sm:w-24 sm:h-32 md:w-36 md:h-44 flex items-center justify-center rounded-2xl sm:rounded-3xl border border-white/10 overflow-hidden shadow-2xl transition-all duration-500",
                            unit.highlight ? "bg-gold/10 border-gold/30" : "bg-white/5"
                          )}
                        >
                          <div className="absolute inset-0 bg-gradient-to-b from-white/5 to-transparent" />
                          <span
                            className={cn(
                              "text-3xl sm:text-5xl md:text-8xl font-black font-mono tracking-tighter",
                              unit.highlight ? "text-gold" : "text-white"
                            )}
                          >
                            {unit.val.toString().padStart(2, "0")}
                          </span>
                        </div>
                        <span className="text-[9px] sm:text-[10px] text-textMuted uppercase tracking-[0.25em] sm:tracking-[0.3em] mt-3 sm:mt-5 font-black">{unit.label}</span>
                      </div>
                    ))}
                  </div>
                )}

                {!live.starts_at && (
                  <p className="text-xl sm:text-2xl text-white/60 font-bold">Próximamente</p>
                )}
              </motion.div>
            ) : (
              <motion.div
                key="waiting-end"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="w-full h-full flex items-center justify-center z-10"
              >
                <div className="text-center">
                  <Clock size={48} className="mx-auto text-white/20 mb-4" />
                  <p className="text-xl text-white/60 font-bold">Esperando señal...</p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Toggle del chat — SOLO desktop. Pestaña vertical pegada al borde derecho del video */}
        {isDesktop && (
          <button
            onClick={() => setIsChatVisibleDesktop(v => !v)}
            aria-label={isChatVisibleDesktop ? "Ocultar chat" : "Mostrar chat"}
            className="absolute right-0 top-1/2 -translate-y-1/2 z-40 group flex items-center gap-2 pl-3 pr-2.5 py-4 rounded-l-2xl bg-black/60 backdrop-blur-md border border-r-0 border-white/15 text-white/80 hover:text-gold hover:bg-black/80 hover:pl-4 transition-all shadow-[-8px_0_25px_-5px_rgba(0,0,0,0.4)]"
          >
            {isChatVisibleDesktop ? (
              <PanelRightClose size={20} />
            ) : (
              <PanelRightOpen size={20} />
            )}
            <AnimatePresence>
              {!isChatVisibleDesktop && unreadCount > 0 && (
                <motion.span
                  key={unreadCount}
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0, opacity: 0 }}
                  transition={{ type: "spring", damping: 14, stiffness: 280 }}
                  className="absolute -top-1.5 -left-1.5 min-w-[20px] h-5 px-1.5 rounded-full bg-red-500 text-white text-[10px] font-black flex items-center justify-center shadow-lg border-2 border-darker"
                >
                  {unreadCount > 99 ? "99+" : unreadCount}
                </motion.span>
              )}
            </AnimatePresence>
          </button>
        )}
      </div>

      {/* Chat — sidebar colapsable en desktop. Siempre montado para mantener viva
          la suscripción Realtime (necesaria para contar mensajes no leídos).
          En mobile NO se monta acá para evitar duplicar la suscripción. */}
      {isDesktop && (
        <div
          className={cn(
            "md:h-screen bg-darker shrink-0 z-50 overflow-hidden transition-[width,opacity] duration-300 ease-in-out",
            isChatVisibleDesktop ? "w-80 lg:w-[400px] opacity-100" : "w-0 opacity-0"
          )}
        >
          <LiveChat liveId={live.id} onIncomingMessage={handleIncomingMessage} />
        </div>
      )}

      {/* Chat mobile — sibling permanente del video (split 50/50 fijo).
          Sin toggle, sin FAB. El fullscreen lo maneja el botón nativo del player. */}
      {!isDesktop && (
        <div className="flex-1 min-h-0 bg-darker border-t border-gold/30 shadow-[0_-20px_40px_-15px_rgba(0,0,0,0.7)]">
          <LiveChat liveId={live.id} onIncomingMessage={handleIncomingMessage} />
        </div>
      )}

      {/* Lista de viewers conectados al live */}
      <Dialog open={showViewersList} onOpenChange={setShowViewersList}>
        <DialogContent className="bg-darker border-white/10 max-w-md">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2.5">
              <div className="p-1.5 rounded-lg bg-gold/15">
                <Users size={16} className="text-gold" />
              </div>
              Conectados
              <span className="text-gold font-black">({viewers.length})</span>
            </DialogTitle>
          </DialogHeader>
          <div className="max-h-[60vh] overflow-y-auto -mx-2 px-2 space-y-1">
            {viewers.length === 0 ? (
              <p className="text-textMuted text-sm text-center py-8">Cargando conectados...</p>
            ) : (
              viewers
                .slice()
                .sort((a, b) => a.full_name.localeCompare(b.full_name))
                .map(v => (
                  <div
                    key={v.user_id}
                    className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-white/[0.04] transition-colors"
                  >
                    {v.avatar_url ? (
                      <img
                        src={v.avatar_url}
                        alt={v.full_name}
                        className="w-10 h-10 rounded-full object-cover ring-1 ring-white/10 shrink-0"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-gold/30 to-gold/10 text-gold flex items-center justify-center font-black text-sm ring-1 ring-gold/30 shrink-0">
                        {v.full_name?.[0]?.toUpperCase() ?? "?"}
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-white truncate">
                        {v.full_name}
                        {v.user_id === user?.id && (
                          <span className="ml-1.5 text-gold/70 font-normal text-xs">(Tú)</span>
                        )}
                      </p>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                        <span
                          className={cn(
                            "text-[9px] font-black uppercase tracking-widest",
                            v.plan === "vip" && "text-gold",
                            v.plan === "individual" && "text-blue-300",
                            v.plan === "free" && "text-textMuted",
                          )}
                        >
                          {v.plan === "vip" ? "★ VIP" : v.plan === "individual" ? "Individual" : "Free"}
                        </span>
                      </div>
                    </div>
                  </div>
                ))
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default VIPLiveRoom;
