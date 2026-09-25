import { motion } from "motion/react";
import { Clock, Video, VideoOff } from "lucide-react";
import type { LiveRoomStatus } from "./liveRoomStatus";

interface LiveStatusBadgeProps {
  status: LiveRoomStatus;
  hasReplay: boolean;
}

/** Badge de estado del header: grabación, finalizado, pausa, en vivo o espera. */
export function LiveStatusBadge({ status, hasReplay }: LiveStatusBadgeProps) {
  const { isEnded, isPaused, isLive, showPlayer } = status;

  if (isEnded && hasReplay) {
    return (
      <div className="flex items-center gap-1.5 sm:gap-2.5 bg-brand/15 backdrop-blur-md border border-brand/40 text-accent px-2.5 sm:px-4 py-1.5 sm:py-2 rounded-xl sm:rounded-2xl text-[9px] sm:text-[10px] font-black tracking-widest">
        <Video size={12} /> GRABACIÓN DEL EN VIVO
      </div>
    );
  }

  if (isEnded) {
    return (
      <div className="flex items-center gap-1.5 sm:gap-2.5 bg-gray-600/20 backdrop-blur-md border border-gray-600/50 text-foreground-muted px-2.5 sm:px-4 py-1.5 sm:py-2 rounded-xl sm:rounded-2xl text-[9px] sm:text-[10px] font-black tracking-widest">
        <VideoOff size={12} /> FINALIZADO
      </div>
    );
  }

  if (isPaused) {
    return (
      <div className="flex items-center gap-1.5 sm:gap-2.5 bg-yellow-600/20 backdrop-blur-md border border-yellow-600/50 text-yellow-500 px-2.5 sm:px-4 py-1.5 sm:py-2 rounded-xl sm:rounded-2xl text-[9px] sm:text-[10px] font-black tracking-widest">
        <VideoOff size={12} /> EN PAUSA
      </div>
    );
  }

  if (isLive) {
    return (
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
    );
  }

  // Player montado sin estar "live": hay señal de OBS pero la sala todavía no
  // pasó a en vivo (F34 — depende de la sincronización del servidor, H3).
  return (
    <div className="flex items-center gap-1.5 sm:gap-2.5 bg-black/40 backdrop-blur-md border border-line-subtle text-fg-70 px-2.5 sm:px-4 py-1.5 sm:py-2 rounded-xl sm:rounded-2xl text-[9px] sm:text-[10px] font-bold tracking-wider">
      <Clock size={12} className="text-accent" />
      {showPlayer ? "EN ESPERA" : "PRÓXIMAMENTE"}
    </div>
  );
}
