import type { RefObject } from "react";
import { motion, AnimatePresence } from "motion/react";
import { VideoOff } from "lucide-react";
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
  playerRef: RefObject<LiveHLSPlayerHandle | null>;
  playback: LivePlayback;
}

/** Player HLS con sus controles y los overlays de audio, pausa y error. */
export function LivePlayerStage({ liveInputId, resumeKey, isPaused, playerRef, playback }: LivePlayerStageProps) {
  const latencyMode = usePreferencesStore((s) => s.liveLatencyMode);
  const setLatencyMode = usePreferencesStore((s) => s.setLiveLatencyMode);

  // Modo "dvr": aviso único al retomar una posición guardada, con acción
  // rápida para volver al filo del vivo (mismo cálculo que el botón "EN VIVO").
  const handleDvrResumed = () => {
    toast("Retomamos donde lo dejaste", {
      action: {
        label: "Ir al vivo",
        onClick: () => {
          const range = playerRef.current?.getSeekableRange();
          if (range) playerRef.current?.seekTo(range.end - 8);
        },
      },
    });
  };

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
          resumeKey={resumeKey}
          onResumed={handleDvrResumed}
          className="w-full h-full object-contain bg-black"
          {...playback.playerEvents}
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
          onTogglePlay={playback.togglePlay}
          onToggleMute={playback.toggleMute}
          onSelectLevel={playback.selectQualityLevel}
          onSelectLatencyMode={setLatencyMode}
        />

        <LiveAudioPrompt
          visible={!playback.audioPromptDismissed && playback.isMuted && !isPaused && !playback.playerError}
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
                  <button
                    type="button"
                    onClick={playback.retryPlayer}
                    className="px-6 py-3 rounded-full bg-brand hover:bg-brand-hover text-on-brand font-black tracking-wide transition-colors"
                  >
                    Reintentar
                  </button>
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
