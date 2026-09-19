import { useState, useEffect, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { motion, AnimatePresence } from "motion/react";
import { Clock, Tv, Radio, Loader2, VideoOff, ArrowLeft, Volume2, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/lib/supabase";
import { getPublicLive, type LiveEvent } from "@/lib/api/stream/lives";
import { useIsDesktop } from "@/hooks/useMediaQuery";
import LiveHLSPlayer, { type LiveHLSPlayerHandle, type QualityLevel } from "@/components/feature/LiveHLSPlayer";
import LivePlayerControls from "@/components/feature/LivePlayerControls";
import PublicLiveChat from "@/components/feature/PublicLiveChat";

const CF_CUSTOMER_CODE = (import.meta.env.VITE_CLOUDFLARE_STREAM_CUSTOMER_SUBDOMAIN || "").match(/customer-([^.]+)/)?.[1] || "";

const POLL_INTERVAL_MS = 3000;
const ANON_ID_STORAGE_KEY = "public-live-anon-id";

function getOrCreateAnonId(): string {
  try {
    const existing = sessionStorage.getItem(ANON_ID_STORAGE_KEY);
    if (existing) return existing;
    const generated = crypto.randomUUID();
    sessionStorage.setItem(ANON_ID_STORAGE_KEY, generated);
    return generated;
  } catch {
    // sessionStorage bloqueado (modo privado estricto) — id efímero por render.
    return crypto.randomUUID();
  }
}

/**
 * Sala pública de un live: sin login, sin verificación de plan. Replica los
 * estados visuales de VIPLiveRoom (countdown, en vivo, pausa, finalizado,
 * error de reproductor) pero SIN la lista de conectados (solo el contador) y
 * SIN llamadas a /api/stream/* (requieren auth). El estado de la sala se
 * obtiene únicamente vía polling de `get_public_live` — Realtime en `lives`
 * no está garantizado para clientes anónimos.
 */
const PublicLiveRoom = () => {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const [live, setLive] = useState<LiveEvent | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [timeLeft, setTimeLeft] = useState({ hours: 0, minutes: 0, seconds: 0 });
  const [audioPromptDismissed, setAudioPromptDismissed] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const [viewerCount, setViewerCount] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isBuffering, setIsBuffering] = useState(false);
  const [qualityLevels, setQualityLevels] = useState<QualityLevel[]>([]);
  const [currentQualityLevel, setCurrentQualityLevel] = useState(-1);
  const [audioRetryHint, setAudioRetryHint] = useState(false);
  const [playerError, setPlayerError] = useState(false);
  const [playerKey, setPlayerKey] = useState(0);
  const [isChatVisibleDesktop, setIsChatVisibleDesktop] = useState(true);
  const isDesktop = useIsDesktop();
  const livePlayerRef = useRef<LiveHLSPlayerHandle | null>(null);
  const anonIdRef = useRef<string>(getOrCreateAnonId());

  const isLive = live?.status === "live" && !live?.is_paused;
  const isEnded = live?.status === "ended";
  const isPaused = live?.is_paused === true;
  const startsAt = live?.starts_at ? new Date(live.starts_at).getTime() : 0;
  const showIframe = live?.status === "live";
  const hasStreamId = Boolean(live?.stream_live_input_id);

  const loginPath = token ? `/login?returnTo=${encodeURIComponent(`/live/${token}`)}` : "/login";

  const handleEnableAudio = async () => {
    const video = livePlayerRef.current?.video;
    if (!video) return;
    setAudioRetryHint(false);
    try {
      video.muted = false;
      video.volume = 1;
      await video.play();
      setIsMuted(false);
      setAudioPromptDismissed(true);
    } catch (e) {
      console.warn("[PublicLiveRoom] No se pudo activar el audio:", e);
      video.muted = true;
      setAudioRetryHint(true);
    }
  };

  const handleRetryPlayer = () => {
    setPlayerError(false);
    setPlayerKey((k) => k + 1);
  };

  const handleTogglePlay = () => {
    const video = livePlayerRef.current?.video;
    if (!video) return;
    try {
      if (isPlaying) {
        livePlayerRef.current?.setUserPaused(true);
        video.pause();
      } else {
        livePlayerRef.current?.setUserPaused(false);
        const result = video.play();
        if (result && typeof result.catch === "function") result.catch(() => {});
      }
    } catch (e) {
      console.warn("[PublicLiveRoom] play/pause error:", e);
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
      console.warn("[PublicLiveRoom] toggle mute error:", e);
    }
  };

  const handleSelectQualityLevel = (index: number) => {
    livePlayerRef.current?.setQualityLevel(index);
    setCurrentQualityLevel(index);
  };

  // Fetch inicial + polling: única fuente de verdad del estado de la sala.
  useEffect(() => {
    if (!token) return;
    let isActive = true;

    // Un poll fallido (4G inestable, timeout de Supabase bajo carga) NO expulsa
    // al espectador: conservamos la última sala conocida y seguimos intentando.
    // Solo mostramos "no disponible" cuando la RPC responde OK sin fila dos
    // veces seguidas (link desactivado por el admin), nunca por un error.
    let consecutiveMisses = 0;
    let consecutiveErrors = 0;

    const load = async () => {
      try {
        const result = await getPublicLive(token);
        if (!isActive) return;
        consecutiveErrors = 0;
        if (!result) {
          consecutiveMisses += 1;
          // Un primer vacío todavía no dice nada: el spinner sigue hasta
          // confirmarlo. Soltarlo aquí mostraba "No pudimos conectar" (problema
          // de red) durante un poll, aunque la red anduviera bien.
          if (consecutiveMisses >= 2) {
            setNotFound(true);
            setLoading(false);
          }
        } else {
          consecutiveMisses = 0;
          setNotFound(false);
          setLive(result);
          setLoading(false);
        }
      } catch (err) {
        console.error("[PublicLiveRoom] error fetching public live:", err);
        if (!isActive) return;
        consecutiveErrors += 1;
        // Sin sala cargada y muchos errores seguidos: soltamos el spinner para
        // que el usuario vea la pantalla de "no disponible" con su botón, pero
        // el polling sigue vivo y la recupera sola si la red vuelve.
        if (consecutiveErrors >= 5) setLoading(false);
      }
    };

    load();
    const poll = setInterval(load, POLL_INTERVAL_MS);
    return () => {
      isActive = false;
      clearInterval(poll);
    };
  }, [token]);

  // Countdown — solo si starts_at está en el futuro, no ended y no está al aire.
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
  }, [live?.id, live?.status, live?.starts_at, showIframe, isEnded, startsAt]);

  // Presencia anónima: cuenta junto con los viewers logueados de la misma sala
  // porque comparten el mismo canal `live_presence:${live.id}`.
  useEffect(() => {
    if (!live?.id) return;

    const anonKey = `anon-${anonIdRef.current}`;
    const channel = supabase.channel(`live_presence:${live.id}`, {
      config: { presence: { key: anonKey } },
    });

    channel
      .on("presence", { event: "sync" }, () => {
        const state = channel.presenceState();
        setViewerCount(Object.keys(state).length);
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await channel.track({ name: "Invitado", anonymous: true, online_at: new Date().toISOString() });
        }
      });

    return () => {
      channel.untrack().catch(() => {});
      supabase.removeChannel(channel);
    };
  }, [live?.id]);

  if (loading) {
    return (
      <div className="min-h-[100dvh] bg-black light:bg-surface-page flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-accent" />
      </div>
    );
  }

  if (notFound || !live) {
    // `notFound`: la RPC respondió sin fila (link desactivado). `!live` sin
    // notFound: nunca pudimos cargar por errores de red — ofrecer reintento.
    const isConnectionIssue = !notFound;
    return (
      <div className="min-h-screen bg-black light:bg-surface-page flex items-center justify-center p-6">
        <div className="text-center max-w-md">
          <Radio size={48} className="mx-auto text-fg-20 mb-6" />
          <h2 className="text-2xl font-bold text-foreground-strong mb-2">
            {isConnectionIssue ? "No pudimos conectar con el en vivo" : "Este en vivo no está disponible"}
          </h2>
          <p className="text-foreground-muted mb-6">
            {isConnectionIssue
              ? "Revisa tu conexión. Seguimos intentando en segundo plano."
              : "El link puede haber expirado o el en vivo ya no es público."}
          </p>
          <button
            onClick={() => (isConnectionIssue ? window.location.reload() : navigate("/"))}
            className="px-6 py-3 rounded-full bg-brand hover:bg-brand-hover text-on-brand font-black tracking-wide transition-colors"
          >
            {isConnectionIssue ? "Reintentar" : "Ir al inicio"}
          </button>
        </div>
      </div>
    );
  }

  const mobileVideoHeightClass = "h-[50dvh] shrink-0";

  return (
    <div className="h-[100dvh] bg-black light:bg-surface-page text-foreground flex flex-col md:flex-row overflow-hidden font-sans">
      {/* Isla oscura: escenario, intro, countdown y controles son iguales en ambos
          temas (spec §3.4). El chat y la lista de conectados, afuera, sí se adaptan. */}
      <div data-theme="dark" className={cn("flex flex-col relative", isDesktop ? "flex-1 md:h-screen" : mobileVideoHeightClass)}>
        {/* Header */}
        <motion.div
          initial={{ y: -100 }}
          animate={{ y: 0 }}
          className="absolute top-0 left-0 w-full p-3 sm:p-5 md:p-8 z-40 flex justify-between items-start gap-3 pointer-events-none"
        >
          <div className="flex items-center gap-2 sm:gap-4 pointer-events-auto min-w-0 flex-1">
            <button
              onClick={() => navigate("/")}
              aria-label="Volver al inicio"
              className="p-2 sm:p-2.5 bg-black/50 backdrop-blur-md border border-line-subtle rounded-xl sm:rounded-2xl text-fg-80 hover:text-foreground-strong hover:bg-black/70 transition-colors shrink-0"
            >
              <ArrowLeft size={18} />
            </button>
            <div className="p-2 sm:p-2.5 bg-black/40 backdrop-blur-md border border-line-subtle rounded-xl sm:rounded-2xl shrink-0">
              <img
                src="https://imagedelivery.net/HGkLNfdVjFNAti8ZHHgxtQ/18dc9190-6625-4b89-8f1e-3f221e96b500/public"
                alt="Logo"
                className="h-7 sm:h-10 object-contain"
              />
            </div>
            <div className="hidden md:block min-w-0">
              <h1 className="font-extrabold text-base lg:text-xl leading-tight text-foreground-strong tracking-tight drop-shadow-2xl truncate">
                {live.title || "Sesión de Riqueza"}
              </h1>
            </div>
          </div>

          <div className="flex flex-col items-end gap-2 sm:gap-3 pointer-events-auto shrink-0">
            {isEnded ? (
              <div className="flex items-center gap-1.5 sm:gap-2.5 bg-gray-600/20 backdrop-blur-md border border-gray-600/50 text-foreground-muted px-2.5 sm:px-4 py-1.5 sm:py-2 rounded-xl sm:rounded-2xl text-[9px] sm:text-[10px] font-black tracking-widest">
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
              <div className="flex items-center gap-1.5 sm:gap-2.5 bg-black/40 backdrop-blur-md border border-line-subtle text-fg-70 px-2.5 sm:px-4 py-1.5 sm:py-2 rounded-xl sm:rounded-2xl text-[9px] sm:text-[10px] font-bold tracking-wider">
                <Clock size={12} className="text-accent" />
                PRÓXIMAMENTE
              </div>
            )}

            {!isEnded && viewerCount > 0 && (
              <div className="flex items-center gap-1.5 sm:gap-2 bg-black/50 backdrop-blur-md border border-brand/20 text-fg-85 px-2.5 sm:px-3.5 py-1.5 sm:py-2 rounded-xl sm:rounded-2xl text-[10px] sm:text-xs font-black tracking-wide">
                <Users size={12} className="text-accent" />
                <span>{viewerCount}</span>
              </div>
            )}
          </div>
        </motion.div>

        {/* Content */}
        <div className="flex-1 flex items-center justify-center bg-[#050505] relative overflow-y-auto overflow-x-hidden">
          <div className="absolute inset-0 z-0">
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full bg-[radial-gradient(circle_at_center,rgba(204,164,59,0.05)_0%,transparent_70%)]" />
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
              <motion.div key="player" initial={false} className="w-full h-full relative bg-black flex items-center justify-center">
                <div className="w-full h-full absolute inset-0 z-0 bg-black">
                  <LiveHLSPlayer
                    key={playerKey}
                    ref={livePlayerRef}
                    liveInputId={live.stream_live_input_id!}
                    customerCode={CF_CUSTOMER_CODE}
                    muted={isMuted}
                    autoPlay
                    latencyMode="smooth"
                    roomPaused={isPaused}
                    className="w-full h-full object-contain bg-black"
                    onPlay={() => { setIsPlaying(true); setIsBuffering(false); }}
                    onPause={() => setIsPlaying(false)}
                    onWaiting={() => setIsBuffering(true)}
                    onPlaying={() => { setIsBuffering(false); setIsPlaying(true); }}
                    onLevelsChange={(lvls, current) => {
                      setQualityLevels(lvls);
                      setCurrentQualityLevel(current);
                    }}
                    onFatalError={() => setPlayerError(true)}
                  />
                  <LivePlayerControls
                    playerRef={livePlayerRef}
                    isPlaying={isPlaying}
                    isBuffering={isBuffering}
                    isMuted={isMuted}
                    levels={qualityLevels}
                    currentLevel={currentQualityLevel}
                    latencyMode="smooth"
                    onTogglePlay={handleTogglePlay}
                    onToggleMute={handleToggleMute}
                    onSelectLevel={handleSelectQualityLevel}
                    onSelectLatencyMode={() => {}}
                  />

                  <AnimatePresence>
                    {!audioPromptDismissed && !isPaused && (
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
                          className="relative flex items-center gap-3 px-7 py-4 sm:px-9 sm:py-5 rounded-full bg-gradient-to-br from-brand via-brand-hover to-brand text-on-brand font-black text-base sm:text-lg tracking-tight shadow-[0_25px_60px_-10px_rgba(204,164,59,0.7)] ring-1 ring-focus/50"
                        >
                          <span className="absolute inset-0 rounded-full bg-brand/50 animate-ping pointer-events-none" />
                          <span className="relative flex items-center justify-center w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-surface-page/15">
                            <Volume2 size={18} strokeWidth={2.5} className="text-on-brand" />
                          </span>
                          <span className="relative">Activar sonido</span>
                        </motion.button>
                        {audioRetryHint && (
                          <p className="absolute bottom-10 left-0 right-0 text-center text-xs text-danger font-bold px-4">
                            No se pudo activar el sonido. Toca de nuevo para reintentar.
                          </p>
                        )}
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <AnimatePresence>
                    {isPaused && (
                      <motion.div
                        key="room-paused-overlay"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="absolute inset-0 z-[45] flex items-center justify-center bg-black/85"
                      >
                        <div className="text-center p-8">
                          <VideoOff size={64} className="mx-auto text-yellow-500/50 mb-6" />
                          <h2 className="text-2xl font-bold text-foreground-strong mb-2">Transmisión en Pausa</h2>
                          <p className="text-foreground-muted max-w-md mx-auto">La transmisión se ha pausado temporalmente. Volveremos en breve.</p>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <AnimatePresence>
                    {playerError && (
                      <motion.div
                        key="player-error-overlay"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="absolute inset-0 z-[46] flex items-center justify-center bg-black/90"
                      >
                        <div className="text-center p-8">
                          <VideoOff size={64} className="mx-auto text-red-500/60 mb-6" />
                          <h2 className="text-2xl font-bold text-foreground-strong mb-2">Error de reproducción</h2>
                          <p className="text-foreground-muted max-w-md mx-auto mb-6">No pudimos recuperar la transmisión automáticamente.</p>
                          <button
                            type="button"
                            onClick={handleRetryPlayer}
                            className="px-6 py-3 rounded-full bg-brand hover:bg-brand-hover text-on-brand font-black tracking-wide transition-colors"
                          >
                            Reintentar
                          </button>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </motion.div>
            ) : isEnded ? (
              <motion.div key="ended" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="w-full h-full flex items-center justify-center bg-black/80 relative">
                <div className="text-center p-8 z-10">
                  <VideoOff size={64} className="mx-auto text-fg-20 mb-6" />
                  <h2 className="text-2xl font-bold text-foreground-strong mb-2">Transmisión finalizada</h2>
                  <p className="text-foreground-muted max-w-md mx-auto">Gracias por acompañarnos. Puedes seguir conversando en el chat.</p>
                </div>
              </motion.div>
            ) : isPaused ? (
              <motion.div key="paused" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="w-full h-full flex items-center justify-center bg-black/80 relative">
                <div className="text-center p-8 z-10">
                  <VideoOff size={64} className="mx-auto text-yellow-500/50 mb-6" />
                  <h2 className="text-2xl font-bold text-foreground-strong mb-2">Transmisión en Pausa</h2>
                  <p className="text-foreground-muted max-w-md mx-auto">La transmisión se ha pausado temporalmente. Volveremos en breve.</p>
                </div>
              </motion.div>
            ) : !hasStreamId ? (
              <motion.div key="no-stream" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="w-full h-full flex items-center justify-center z-10">
                <div className="text-foreground-strong text-center p-12 bg-surface-page rounded-3xl border border-ink/5">
                  <div className="w-16 h-16 bg-red-500/20 text-red-500 rounded-full flex items-center justify-center mx-auto mb-6">
                    <Tv size={32} />
                  </div>
                  <h3 className="text-2xl font-bold mb-2">Señal no configurada</h3>
                  <p className="text-foreground-muted max-w-sm mx-auto">Esta sala todavía no tiene una señal vinculada.</p>
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="waiting"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 1.1 }}
                transition={{ duration: 0.8 }}
                className="text-center z-10 px-4 sm:px-6 pt-20 sm:pt-24 md:pt-0 pb-24 md:pb-0 max-w-4xl mx-auto"
              >
                <h2 className="text-3xl sm:text-5xl md:text-7xl font-black mb-6 sm:mb-8 text-foreground-strong tracking-tight md:tracking-tighter leading-[1.1] text-balance">
                  {live.title || "Próximo encuentro"}
                </h2>

                {live.description && (
                  <p className="text-foreground-muted mb-10 sm:mb-16 text-sm sm:text-lg md:text-xl max-w-2xl mx-auto font-medium leading-relaxed text-balance">
                    {live.description}
                  </p>
                )}

                {live.starts_at ? (
                  <div className="flex justify-center gap-2 sm:gap-4 md:gap-10">
                    {[
                      { val: timeLeft.hours, label: "Horas" },
                      { val: timeLeft.minutes, label: "Minutos" },
                      { val: timeLeft.seconds, label: "Segundos", highlight: true },
                    ].map((unit, idx) => (
                      <div key={idx} className="flex flex-col items-center">
                        <div
                          className={cn(
                            "relative w-16 h-20 sm:w-24 sm:h-32 md:w-36 md:h-44 flex items-center justify-center rounded-2xl sm:rounded-3xl border border-line-subtle overflow-hidden shadow-2xl transition-all duration-500",
                            unit.highlight ? "bg-brand/10 border-brand/30" : "bg-ink/5"
                          )}
                        >
                          <span
                            className={cn(
                              "text-3xl sm:text-5xl md:text-8xl font-black font-mono tracking-tighter",
                              unit.highlight ? "text-accent" : "text-foreground-strong"
                            )}
                          >
                            {unit.val.toString().padStart(2, "0")}
                          </span>
                        </div>
                        <span className="text-[9px] sm:text-[10px] text-foreground-muted uppercase tracking-[0.25em] sm:tracking-[0.3em] mt-3 sm:mt-5 font-black">{unit.label}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xl sm:text-2xl text-fg-60 font-bold">Próximamente</p>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {isDesktop && (
          <button
            onClick={() => setIsChatVisibleDesktop((v) => !v)}
            aria-label={isChatVisibleDesktop ? "Ocultar chat" : "Mostrar chat"}
            className="absolute right-0 top-1/2 -translate-y-1/2 z-40 flex items-center gap-2 pl-3 pr-2.5 py-4 rounded-l-2xl bg-black/60 backdrop-blur-md border border-r-0 border-ink/15 text-fg-80 hover:text-accent hover:bg-black/80 transition-all"
          >
            {isChatVisibleDesktop ? "›" : "‹"}
          </button>
        )}
      </div>

      {isDesktop ? (
        <div
          className={cn(
            "md:h-screen bg-surface-page shrink-0 z-50 overflow-hidden transition-[width,opacity] duration-300 ease-in-out",
            isChatVisibleDesktop ? "w-80 lg:w-[400px] opacity-100" : "w-0 opacity-0"
          )}
        >
          {token && <PublicLiveChat token={token} loginPath={loginPath} />}
        </div>
      ) : (
        <div className="flex-1 min-h-0 bg-surface-page border-t border-brand/30 shadow-[0_-20px_40px_-15px_rgba(0,0,0,0.7)] light:shadow-[0_-16px_32px_-18px_rgba(60,45,15,0.3)]">
          {token && <PublicLiveChat token={token} loginPath={loginPath} />}
        </div>
      )}
    </div>
  );
};

export default PublicLiveRoom;
