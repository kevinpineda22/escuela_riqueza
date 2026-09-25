import { motion, AnimatePresence } from "motion/react";
import { ArrowDown } from "lucide-react";

interface ChatJumpToLatestProps {
  count: number;
  onClick: () => void;
}

/** Aviso flotante de mensajes nuevos mientras se lee el historial del chat. */
export function ChatJumpToLatest({ count, onClick }: ChatJumpToLatestProps) {
  return (
    <div className="absolute inset-x-0 bottom-3 z-10 flex justify-center pointer-events-none">
      <AnimatePresence>
        {count > 0 && (
          <motion.button
            type="button"
            onClick={onClick}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            transition={{ duration: 0.15 }}
            className="pointer-events-auto flex items-center gap-1.5 min-h-9 px-3.5 rounded-full bg-brand hover:bg-brand-hover text-on-brand text-xs font-bold shadow-lg active:scale-95 transition-colors"
          >
            <ArrowDown size={14} strokeWidth={2.5} />
            {count === 1 ? "1 mensaje nuevo" : `${count > 99 ? "99+" : count} mensajes nuevos`}
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
}
