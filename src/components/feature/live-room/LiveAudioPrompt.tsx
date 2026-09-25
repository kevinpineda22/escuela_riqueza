import { motion, AnimatePresence } from "motion/react";
import { Volume2, X } from "lucide-react";

interface LiveAudioPromptProps {
  visible: boolean;
  retryHint: boolean;
  onEnable: () => void;
  onDismiss: () => void;
}

/**
 * Invitación compacta a activar el sonido (F01). Antes era una capa con blur
 * sobre todo el player: no se podía mirar la clase sin sonido ni cerrarla.
 * Ahora ocupa una esquina, deja ver el video y permite seguir sin sonido.
 * Cada botón tiene una sola acción (F02: el contenedor ya no repite el clic).
 */
export function LiveAudioPrompt({ visible, retryHint, onEnable, onDismiss }: LiveAudioPromptProps) {
  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          key="audio-prompt"
          role="group"
          aria-label="Sonido del en vivo"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 8 }}
          transition={{ duration: 0.2 }}
          className="absolute left-3 sm:left-5 bottom-16 sm:bottom-20 z-[33] flex flex-col items-start gap-1.5 max-w-[calc(100%-7rem)]"
        >
          <div className="flex items-center gap-1 p-1 rounded-full bg-black/75 backdrop-blur-md border border-brand/40 shadow-lg">
            <button
              type="button"
              onClick={onEnable}
              className="flex items-center gap-2 min-h-10 pl-3 pr-4 rounded-full bg-brand hover:bg-brand-hover text-on-brand text-sm font-bold whitespace-nowrap active:scale-95 transition-all"
            >
              <Volume2 size={18} strokeWidth={2.5} />
              Activar sonido
            </button>
            <button
              type="button"
              onClick={onDismiss}
              aria-label="Seguir sin sonido"
              title="Seguir sin sonido"
              className="flex items-center justify-center w-10 h-10 rounded-full text-fg-80 hover:text-foreground-strong hover:bg-ink/10 transition-colors"
            >
              <X size={18} />
            </button>
          </div>
          {retryHint && (
            <p role="alert" className="text-xs text-danger font-bold px-2 py-1 rounded-lg bg-black/75">
              No se pudo activar el sonido. Toca «Activar sonido» de nuevo.
            </p>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
