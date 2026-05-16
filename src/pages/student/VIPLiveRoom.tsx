import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "motion/react";
import LiveChat, { type ChatMessage } from "@/components/feature/LiveChat";
import { Sparkles, Calendar, Clock, Tv, Radio, Loader2, VideoOff, ArrowLeft, MessageSquare, X, Volume2, PanelRightClose, PanelRightOpen } from "lucide-react";
import { cn } from "@/lib/utils";
import { usePlayerStore } from "@/stores/player.store";
import { useAuthStore } from "@/stores/auth.store";
import { supabase } from "@/lib/supabase";
import { fetchActiveLive, checkLiveInputStatus, type LiveEvent } from "@/lib/api/stream/lives";
import { useIsDesktop } from "@/hooks/useMediaQuery";

const CF_SUBDOMAIN = import.meta.env.VITE_CLOUDFLARE_STREAM_CUSTOMER_SUBDOMAIN || "";
const STREAM_SDK_URL = "https://embed.cloudflarestream.com/embed/sdk.latest.js";

const VIPLiveRoom = () => {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [live, setLive] = useState<LiveEvent | null>(null);
  const [loading, setLoading] = useState(true);
  const [showIntro, setShowIntro] = useState(false);
  const [timeLeft, setTimeLeft] = useState({ hours: 0, minutes: 0, seconds: 0 });
  const [liveInputConnected, setLiveInputConnected] = useState(false);
  const [isChatOpenMobile, setIsChatOpenMobile] = useState(false);
  const [audioEnabled, setAudioEnabled] = useState(false);
  const [isChatVisibleDesktop, setIsChatVisibleDesktop] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);
  const isDesktop = useIsDesktop();
  const { clearPlayer } = usePlayerStore();
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const streamPlayerRef = useRef<{ muted: boolean; volume: number; play: () => Promise<void> } | null>(null);

  useEffect(() => { clearPlayer(); }, [clearPlayer]);

  // Cargar el SDK de Cloudflare Stream una sola vez (necesario para controlar el iframe sin remount)
  useEffect(() => {
    if (document.querySelector(`script[src="${STREAM_SDK_URL}"]`)) return;
    const script = document.createElement("script");
    script.src = STREAM_SDK_URL;
    script.defer = true;
    document.head.appendChild(script);
  }, []);

  const attachStreamPlayer = () => {
    const w = window as unknown as { Stream?: (el: HTMLIFrameElement) => typeof streamPlayerRef.current };
    if (!iframeRef.current || !w.Stream) {
      // SDK todavía no terminó de cargar — reintenta en breve
      setTimeout(attachStreamPlayer, 200);
      return;
    }
    streamPlayerRef.current = w.Stream(iframeRef.current);
  };

  // Resetea unreads al volver a mostrar el chat
  useEffect(() => {
    if (isChatVisibleDesktop) setUnreadCount(0);
  }, [isChatVisibleDesktop]);

  const handleIncomingMessage = (msg: ChatMessage) => {
    if (msg.isSystem) return;
    if (msg.user_id === user?.id) return;
    if (isDesktop && !isChatVisibleDesktop) {
      setUnreadCount(c => c + 1);
    }
  };

  const handleEnableAudio = () => {
    setAudioEnabled(true);
    const player = streamPlayerRef.current;
    if (!player) return;
    try {
      player.muted = false;
      player.volume = 1;
      const result = player.play();
      if (result && typeof (result as Promise<void>).catch === "function") {
        (result as Promise<void>).catch(() => {});
      }
    } catch (e) {
      console.warn("[VIPLiveRoom] No se pudo desmutear via SDK:", e);
    }
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

  return (
    <div className="min-h-[100dvh] bg-black text-textMain flex flex-col md:flex-row overflow-hidden font-sans">
      <div className="flex-1 flex flex-col relative h-[100dvh] md:h-screen">
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
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 1, delay: 0.5 }}
                className="w-full h-full relative bg-black flex items-center justify-center"
              >
                <iframe
                  ref={iframeRef}
                  onLoad={attachStreamPlayer}
                  src={`https://${CF_SUBDOMAIN}/${live.stream_live_input_id}/iframe?mode=webrtc&autoplay=true&preferLowLatency=true&muted=true&playsinline=true`}
                  allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture; camera; microphone"
                  className="w-full h-full border-none absolute inset-0 z-0"
                  allowFullScreen
                  title="VIP Live Room"
                />
                <AnimatePresence>
                  {!audioEnabled && (
                    <motion.div
                      key="enable-audio-overlay"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.3 }}
                      className="absolute inset-0 z-30 flex items-center justify-center bg-black/40 backdrop-blur-[3px] cursor-pointer"
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

      {/* FAB y drawer del chat — SOLO en mobile */}
      {!isDesktop && (
        <>
          <button
            onClick={() => setIsChatOpenMobile(true)}
            aria-label="Abrir chat"
            className="fixed bottom-5 right-5 z-40 w-14 h-14 rounded-full bg-gold hover:bg-goldHover text-darker flex items-center justify-center shadow-[0_10px_30px_-5px_rgba(204,164,59,0.6)] active:scale-95 transition-transform"
          >
            <MessageSquare size={22} />
            <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full animate-pulse border-2 border-darker" />
          </button>

          <AnimatePresence>
            {isChatOpenMobile && (
              <>
                <motion.div
                  key="chat-overlay"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  onClick={() => setIsChatOpenMobile(false)}
                  className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[60]"
                />
                <motion.div
                  key="chat-drawer"
                  initial={{ y: "100%" }}
                  animate={{ y: 0 }}
                  exit={{ y: "100%" }}
                  transition={{ type: "spring", damping: 30, stiffness: 280 }}
                  className="fixed bottom-0 left-0 right-0 h-[85dvh] z-[70] bg-darker rounded-t-3xl overflow-hidden shadow-[0_-20px_40px_-10px_rgba(0,0,0,0.8)] flex flex-col"
                >
                  <div className="relative flex items-center justify-between px-4 py-3 pt-5 border-b border-white/10 bg-black/40 shrink-0">
                    <div className="w-10 h-1 bg-white/20 rounded-full absolute left-1/2 -translate-x-1/2 top-2" />
                    <h3 className="text-sm font-bold text-white">Comunidad VIP</h3>
                    <button
                      onClick={() => setIsChatOpenMobile(false)}
                      aria-label="Cerrar chat"
                      className="p-2.5 rounded-lg text-white/60 hover:text-white hover:bg-white/10 transition-colors"
                    >
                      <X size={20} />
                    </button>
                  </div>
                  <div className="flex-1 min-h-0">
                    <LiveChat liveId={live.id} onIncomingMessage={handleIncomingMessage} />
                  </div>
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </>
      )}
    </div>
  );
};

export default VIPLiveRoom;
