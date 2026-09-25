import type { ReactNode, RefObject } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Tv, VideoOff } from "lucide-react";
import { cn } from "@/lib/utils";
import { LiveCountdownView } from "./LiveCountdownView";
import { LivePlayerStage } from "./LivePlayerStage";
import { LiveStageMessage } from "./LiveStageMessage";
import type { LiveHLSPlayerHandle } from "@/components/feature/LiveHLSPlayer";
import type { LiveEvent } from "@/lib/api/stream/lives";
import type { LiveRoomStatus } from "./liveRoomStatus";
import type { LivePlayback } from "./useLivePlayback";

interface LiveStageProps {
  live: LiveEvent;
  status: LiveRoomStatus;
  playerRef: RefObject<LiveHLSPlayerHandle | null>;
  playback: LivePlayback;
  /** Grabación a mostrar una vez finalizada (solo la sala pública la ofrece). */
  replay?: ReactNode;
  /** Reemplaza el "Transmisión finalizada" (ej. el paywall de la repetición). */
  endedNotice?: ReactNode;
  waitingLabel?: string;
  waitingTitleFallback: ReactNode;
  /** El escenario toma la proporción 16:9 del video en vez de llenar el alto disponible. */
  fitToVideo?: boolean;
  /** Poca altura (horizontal): la espera usa tamaños de celular aunque el ancho sea de escritorio. */
  compact?: boolean;
}

/** Escenario de la sala: decide qué se ve según el estado del en vivo. */
export function LiveStage({ live, status, playerRef, playback, replay, endedNotice, waitingLabel, waitingTitleFallback, fitToVideo = false, compact = false }: LiveStageProps) {
  const { isLive, isEnded, isPaused, showPlayer } = status;
  const hasStreamId = Boolean(live.stream_live_input_id);

  return (
    <div
      className={cn(
        "flex items-center justify-center bg-[#050505] relative overflow-y-auto overflow-x-hidden",
        fitToVideo ? "w-full aspect-video max-h-[60dvh] shrink-0" : "flex-1"
      )}
    >
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
        {showPlayer && hasStreamId ? (
          <motion.div key="player" initial={false} className="w-full h-full relative bg-black flex items-center justify-center">
            <LivePlayerStage liveInputId={live.stream_live_input_id!} resumeKey={live.id} isPaused={isPaused} playerRef={playerRef} playback={playback} />
          </motion.div>
        ) : isEnded && replay ? (
          <motion.div key="replay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="w-full h-full relative bg-black flex items-center justify-center p-4 sm:p-8">
            {replay}
          </motion.div>
        ) : isEnded && endedNotice ? (
          <motion.div key="ended-notice" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="w-full h-full flex items-center justify-center bg-black/80 relative">
            {endedNotice}
          </motion.div>
        ) : isEnded ? (
          <motion.div key="ended" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="w-full h-full flex items-center justify-center bg-black/80 relative">
            <LiveStageMessage icon={VideoOff} iconClassName="text-fg-20" title="Transmisión finalizada">
              Gracias por acompañarnos. Puedes seguir conversando en el chat.
            </LiveStageMessage>
          </motion.div>
        ) : isPaused ? (
          <motion.div key="paused" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="w-full h-full flex items-center justify-center bg-black/80 relative">
            <LiveStageMessage icon={VideoOff} iconClassName="text-yellow-500/50" title="Transmisión en Pausa">
              La transmisión se ha pausado temporalmente. Volveremos en breve.
            </LiveStageMessage>
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
            className={cn("text-center z-10 px-4 sm:px-6 max-w-4xl mx-auto", compact ? "py-4 m-auto" : "py-8 md:py-0")}
          >
            <LiveCountdownView live={live} label={waitingLabel} titleFallback={waitingTitleFallback} compact={compact} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
