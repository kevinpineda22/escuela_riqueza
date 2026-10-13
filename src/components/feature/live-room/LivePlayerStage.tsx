import type { RefObject } from "react";
import { motion, AnimatePresence } from "motion/react";
import { VideoOff, Flag, X } from "lucide-react";
import { usePreferencesStore } from "@/stores/preferences.store";
import { toast } from "@/components/ui/toaster";
import LiveHLSPlayer, { type LiveHLSPlayerHandle } from "@/components/feature/LiveHLSPlayer";
import LivePlayerControls from "@/components/feature/LivePlayerControls";
import { CF_CUSTOMER_CODE } from "./constants";
import { LiveAudioPrompt } from "./LiveAudioPrompt";
import { LiveStageMessage } from "./LiveStageMessage";
import type { LivePlayback } from "./useLivePlayback";

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
}

/** Player HLS con sus controles y los overlays de audio, pausa y error. */
export function LivePlayerStage({ liveInputId, resumeKey, isPaused, streamEnded = false, onLeaveEnded, playerRef, playback }: LivePlayerStageProps) {
  const latencyMode = usePreferencesStore((s) => s.liveLatencyMode);
  const setLatencyMode = usePreferencesStore((s) => s.setLiveLatencyMode);

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

  // Cambiar de modo recrea el reproductor (otro manifest): se avisa para que
  // la carga breve no parezca un fallo. La posición de "Clase completa" queda
  // guardada y se retoma al volver a ese modo.
  const handleSelectLatencyMode = (mode: typeof latencyMode) => {
    if (mode === latencyMode) return;
    setLatencyMode(mode);
    toast(
      mode === "dvr"
        ? "Clase completa: ya puedes retroceder"
        : mode === "smooth"
          ? "Clase normal: vuelves al directo"
          : "Baja latencia: vuelves al directo",
    );
  };

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
        <LiveHLSPlayer
          key={playback.playerKey}
          ref={playerRef}
          liveInputId={liveInputId}
          customerCode={CF_CUSTOMER_CODE}
          muted={playback.isMuted}
          autoPlay
          latencyMode={latencyMode}
          roomPaused={isPaused}
          streamEnded={streamEnded}
          resumeKey={resumeKey}
          onResumed={handleDvrResumed}
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
          mediaKey={playback.playerKey}
          onTogglePlay={playback.togglePlay}
          onToggleMute={playback.toggleMute}
          onSelectLevel={playback.selectQualityLevel}
          onSelectLatencyMode={handleSelectLatencyMode}
        />

        {/* Clase finalizada con tramo pendiente: el alumno sabe por qué sigue
            viendo video y puede salir cuando quiera. */}
        {streamEnded && (
          <div className="absolute top-3 left-1/2 -translate-x-1/2 z-40 flex items-center gap-2 max-w-[calc(100%-1.5rem)] pl-3 pr-1 py-1 rounded-full bg-black/75 backdrop-blur-md border border-ink/15 text-foreground-strong shadow-lg">
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
                    {/* Salida operativa si "Clase completa" falla: la clase
                        normal usa otro manifest y no depende del DVR. */}
                    {latencyMode === "dvr" && (
                      <button
                        type="button"
                        onClick={() => {
                          setLatencyMode("smooth");
                          playback.retryPlayer();
                          toast("Cambiamos a Clase normal para recuperar la transmisión");
                        }}
                        className="px-6 py-3 rounded-full bg-ink/15 hover:bg-ink/25 text-foreground-strong font-black tracking-wide transition-colors"
                      >
                        Ver en Clase normal
                      </button>
                    )}
                  </div>
                }
              >
                No pudimos recuperar la transmisión automáticamente.
              </LiveStageMessage>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </>
  );
}
