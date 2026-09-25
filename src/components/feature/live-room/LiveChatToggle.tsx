import { motion, AnimatePresence } from "motion/react";
import { PanelRightClose, PanelRightOpen } from "lucide-react";

interface LiveChatToggleProps {
  chatVisible: boolean;
  unreadCount: number;
  onToggle: () => void;
}

/** Pestaña vertical para ocultar/mostrar el chat (solo escritorio). */
export function LiveChatToggle({ chatVisible, unreadCount, onToggle }: LiveChatToggleProps) {
  return (
    <button
      onClick={onToggle}
      aria-label={chatVisible ? "Ocultar chat" : "Mostrar chat"}
      className="absolute right-0 top-1/2 -translate-y-1/2 z-40 group flex items-center gap-2 pl-3 pr-2.5 py-4 rounded-l-2xl bg-black/60 backdrop-blur-md border border-r-0 border-ink/15 text-fg-80 hover:text-accent hover:bg-black/80 hover:pl-4 transition-all shadow-[-8px_0_25px_-5px_rgba(0,0,0,0.4)]"
    >
      {chatVisible ? <PanelRightClose size={20} /> : <PanelRightOpen size={20} />}
      <AnimatePresence>
        {!chatVisible && unreadCount > 0 && (
          <motion.span
            key={unreadCount}
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            transition={{ type: "spring", damping: 14, stiffness: 280 }}
            className="absolute -top-1.5 -left-1.5 min-w-[20px] h-5 px-1.5 rounded-full bg-red-500 text-white text-[10px] font-black flex items-center justify-center shadow-lg border-2 border-surface-page"
          >
            {unreadCount > 99 ? "99+" : unreadCount}
          </motion.span>
        )}
      </AnimatePresence>
    </button>
  );
}
