import { useEffect, type RefObject } from "react";
import { motion, AnimatePresence } from "motion/react";
import { VideoOff, Flag, X, Headphones, Video } from "lucide-react";
import { SCHOOL_LOGO_URL } from "@/lib/media/mediaSession";
import { liveManifestUrl } from "@/lib/live/dvrWindow";
import { toast } from "@/components/ui/toaster";
import { describeMediaFailure } from "@/lib/errors/classifyError";
import LiveHLSPlayer, { type LiveHLSPlayerHandle } from "@/components/feature/LiveHLSPlayer";
import LivePlayerControls from "@/components/feature/LivePlayerControls";
import { CF_CUSTOMER_CODE } from "./constants";
import { LiveAudioPrompt } from "./LiveAudioPrompt";
import { LiveStageMessage } from "./LiveStageMessage";
import type { LivePlayback } from "./useLivePlayback";
import { useUnmuteOnFirstGesture } from "./useUnmuteOnFirstGesture";

interface LivePlayerStageProps {
  liveInputId: string;
  /** Id de la sala: clave para retomar la posición en "Clase completa" (dvr). */
  resumeKey: string;
  isPaused: boolean;
  /** La sala finalizó: el alumno termina lo que le faltaba, sin recargas. */
  streamEnded?: boolean;
  /** Sale de la continuación (fin del medio, traba o decisión del alumno). */
  onLeaveEnded?: () => void;
  playerRef: RefObject<LiveHLSPlayerHandle | null>;
  playback: LivePlayback;
  /** Título y portada de la clase: la tarjeta de Solo audio. */
  title: string;
  coverUrl?: string | null;
}

/** Player HLS con sus controles y los overlays de audio, pausa y error. */
export function LivePlayerStage({ liveInputId, resumeKey, isPaused, streamEnded = false, onLeaveEnded, playerRef, playback, title, coverUrl }: LivePlayerStageProps) {
  // El modo lo decide la sala (useLivePlayback): Fluidez y, al retroceder,
  // Clase completa. El alumno no elige "modos".
  const latencyMode = playback.latencyMode;

  // Modo "dvr": aviso único al retomar una posición guardada. "Ir al vivo" es
  // la misma operación que el botón de la barra (`goLive`): mismo margen
  // seguro, reanuda y respeta la pausa de sala.
  const handleDvrResumed = () => {
    toast("Retomamos donde lo dejaste", {
      action: {
        label: "Ir al vivo",
        onClick: () => playerRef.current?.goLive(),
      },
    });
  };

  // Bloqueó el celular (o cambió de app) mirando el video y el sistema lo
  // pausó: al volver, se ofrece Solo audio, que es lo que sigue sonando.
  // Una vez por visita a la sala.
  const { mediaKey, audioOnly, toggleAudioOnly } = playback;
  useUnmuteOnFirstGesture(playback.awaitingGesture, playback.enableAudio);
  useEffect(() => {
    if (audioOnly) return;
    const media = playerRef.current?.video;
    if (!media) return;
    let pausedWhileHidden = false;
    const handlePause = () => {
      if (document.visibilityState === "hidden") pausedWhileHidden = true;
    };
    const handleVisibility = () => {
      if (document.visibilityState !== "visible" || !pausedWhileHidden) return;
      pausedWhileHidden = false;
      if (sessionStorageFlag(AUDIO_ONLY_HINT_KEY)) return;
      toast("¿Quieres seguir escuchando con la pantalla apagada?", {
        description: "Activa Solo audio: la clase sigue sonando aunque bloquees el celular.",
        action: { label: "Solo audio", onClick: toggleAudioOnly },
      });
    };
    media.addEventListener("pause", handlePause);
    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      media.removeEventListener("pause", handlePause);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [playerRef, mediaKey, audioOnly, toggleAudioOnly]);

  // Durante la continuación, un fallo o el final del medio cierran la clase:
  // no hay nada que recargar (ver `streamEnded` en LiveHLSPlayer).
  const playerEvents = streamEnded
    ? {
        ...playback.playerEvents,
        onFatalError: () => {
          toast("La parte que faltaba ya no está disponible");
          onLeaveEnded?.();
        },
      }
    : playback.playerEvents;

  return (
    <>
      {/* Fade-in cinemático en una capa SEPARADA del player. El video siempre
          arranca visible para que Android Chrome no pierda la pista de video
          durante la transición. */}
      <motion.div
        aria-hidden
        initial={{ opacity: 1 }}
        animate={{ opacity: 0 }}
        transition={{ duration: 1, delay: 0.3 }}
        className="absolute inset-0 z-20 bg-black pointer-events-none"
      />
      <div className="w-full h-full absolute inset-0 z-0 bg-black">
        {/* Solo audio: en lugar de la imagen, la portada de la clase (como
            un podcast). El botón de volver al video también está en Ajustes. */}
        {audioOnly && (
          <div className="absolute inset-0 z-[5] flex flex-col items-center justify-center gap-4 px-6 pb-20 text-center bg-gradient-to-b from-surface-raised to-black">
            <img
              src={coverUrl || SCHOOL_LOGO_URL}
              alt=""
              className={coverUrl ? "w-40 sm:w-56 aspect-square object-cover rounded-2xl shadow-2xl" : "h-24 sm:h-32 object-contain"}
            />
            <div className="max-w-md">
              <p className="flex items-center justify-center gap-1.5 text-[11px] font-black uppercase tracking-widest text-accent">
                <Headphones size={14} aria-hidden />
                Solo audio
              </p>
              <p className="mt-1 text-lg sm:text-xl font-black text-foreground-strong line-clamp-2">{title}</p>
              <p className="mt-1 text-sm text-foreground-muted">Puedes bloquear el celular: la clase sigue sonando.</p>
            </div>
            <button
              type="button"
              onClick={toggleAudioOnly}
              className="relative z-[26] inline-flex items-center gap-2 min-h-11 px-5 rounded-full bg-ink/15 hover:bg-ink/25 text-sm font-bold text-foreground-strong transition-colors"
            >
              <Video size={16} aria-hidden />
              Volver al video
            </button>
          </div>
        )}
        <LiveHLSPlayer
          // Un elemento nuevo por "Reintentar" y por Solo audio ⇄ video.
          key={mediaKey}
          ref={playerRef}
          liveInputId={liveInputId}
          customerCode={CF_CUSTOMER_CODE}
          muted={playback.isMuted}
          autoPlay
          latencyMode={latencyMode}
          roomPaused={isPaused}
          streamEnded={streamEnded}
          resumeKey={resumeKey}
          audioOnly={audioOnly}
          preferredLevel={playback.currentQualityLevel}
          onResumed={handleDvrResumed}
          startBehindLive={playback.startBehindLive}
          onStartBehindApplied={playback.clearStartBehind}
          onEnded={streamEnded ? onLeaveEnded : undefined}
          className="w-full h-full object-contain bg-black"
          {...playerEvents}
        />
        <LivePlayerControls
          playerRef={playerRef}
          isPlaying={playback.isPlaying}
          isBuffering={playback.isBuffering}
          isMuted={playback.isMuted}
          levels={playback.qualityLevels}
          currentLevel={playback.currentQualityLevel}
          activeLevel={playback.activeQualityLevel}
          latencyMode={latencyMode}
          mediaKey={mediaKey}
          audioOnly={audioOnly}
          onToggleAudioOnly={toggleAudioOnly}
          dvrManifestUrl={liveManifestUrl(CF_CUSTOMER_CODE, liveInputId, "dvr")}
          onTogglePlay={playback.togglePlay}
          onToggleMute={playback.toggleMute}
          onSelectLevel={playback.selectQualityLevel}
          onRewindFromLive={playback.rewindFromLive}
          onReturnToLive={playback.returnToLive}
        />

        {/* Clase finalizada con tramo pendiente: el alumno sabe por qué sigue
            viendo video y puede salir cuando quiera. */}
        {streamEnded && (
          <div className="absolute top-3 left-1/2 -translate-x-1/2 z-40 flex items-center gap-2 max-w-[calc(100%-1.5rem)] pl-3 pr-1 py-1 rounded-full bg-black/85 border border-ink/15 text-foreground-strong shadow-lg">
            <Flag size={14} className="text-accent shrink-0" />
            <span className="text-xs font-bold truncate">La clase terminó · Sigues viendo lo que te faltaba</span>
            <button
              type="button"
              onClick={onLeaveEnded}
              className="inline-flex items-center gap-1 shrink-0 min-h-9 px-3 rounded-full bg-ink/15 hover:bg-ink/25 text-xs font-black transition-colors"
            >
              <X size={14} aria-hidden />
              Salir
            </button>
          </div>
        )}

        <LiveAudioPrompt
          visible={!playback.audioPromptDismissed && playback.isMuted && !isPaused && !playback.playerError && !streamEnded}
          retryHint={playback.audioRetryHint}
          onEnable={playback.enableAudio}
          onDismiss={playback.dismissAudioPrompt}
        />

        {/* H7: pausa de sala — el <video> sigue montado (y pausado por
            LiveHLSPlayer vía `roomPaused`); solo se tapa el último frame. */}
        <AnimatePresence>
          {isPaused && (
            <motion.div
              key="room-paused-overlay"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 z-[45] flex items-center justify-center bg-black/85"
            >
              <LiveStageMessage icon={VideoOff} iconClassName="text-yellow-500/50" title="Transmisión en Pausa">
                La transmisión se ha pausado temporalmente. Volveremos en breve.
              </LiveStageMessage>
            </motion.div>
          )}
        </AnimatePresence>

        {/* H8: se agotaron los reintentos automáticos — error manual con botón
            que remonta el player (key bump). */}
        <AnimatePresence>
          {playback.playerError && (
            <motion.div
              key="player-error-overlay"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 z-[46] flex items-center justify-center bg-black/90"
            >
              <LiveStageMessage
                icon={VideoOff}
                iconClassName="text-red-500/60"
                title="Error de reproducción"
                action={
                  <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                    <button
                      type="button"
                      onClick={playback.retryPlayer}
                      className="px-6 py-3 rounded-full bg-brand hover:bg-brand-hover text-on-brand font-black tracking-wide transition-colors"
                    >
                      Reintentar
                    </button>
                    {/* Salida operativa si falla mientras retrocedía: el vivo
                        (Fluidez) usa otro manifest y no depende del DVR. */}
                    {latencyMode === "dvr" && (
                      <button
                        type="button"
                        onClick={playback.recoverInSmooth}
                        className="px-6 py-3 rounded-full bg-ink/15 hover:bg-ink/25 text-foreground-strong font-black tracking-wide transition-colors"
                      >
                        Volver al vivo
                      </button>
                    )}
                  </div>
                }
              >
                No pudimos recuperar la transmisión automáticamente.
                {playback.playerFailure ? (
                  <span className="mt-2 block">
                    {describeMediaFailure(playback.playerFailure.kind, playback.playerFailure.code, { live: true })}
                  </span>
                ) : null}
              </LiveStageMessage>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </>
  );
}

const AUDIO_ONLY_HINT_KEY = "live-audio-only-hint";

/** true si la marca ya estaba; si no, la deja puesta. Sin almacenamiento, avisa siempre. */
function sessionStorageFlag(key: string): boolean {
  try {
    if (sessionStorage.getItem(key)) return true;
    sessionStorage.setItem(key, "1");
  } catch { /* modo privado o datos bloqueados */ }
  return false;
}
