import { useEffect, useRef } from "react";
import { motion } from "motion/react";
import { cn } from "@/lib/utils";
import { REACTIONS, type ReactionKey } from "@/lib/api/stream/reactions";

interface ReactionPickerProps {
  /** Reactions the current user already placed on this message — highlighted. */
  activeKeys: Set<ReactionKey>;
  /** Reactions with a toggle request in flight — disabled to ignore a double tap. */
  pendingKeys: Set<ReactionKey>;
  onSelect: (key: ReactionKey) => void;
  onClose: () => void;
}

/** Small inline bar with the 4 emojis. Closes itself on outside click or Escape. */
export function ReactionPicker({ activeKeys, pendingKeys, onSelect, onClose }: ReactionPickerProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handlePointerDown = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose]);

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 4, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 4, scale: 0.95 }}
      transition={{ duration: 0.12 }}
      role="menu"
      aria-label="Elegir reacción"
      className="flex items-center gap-1 mt-1 p-1.5 rounded-2xl bg-surface-popover border border-line-subtle shadow-panel w-fit"
    >
      {REACTIONS.map(({ key, emoji, label }) => {
        const isActive = activeKeys.has(key);
        const isPending = pendingKeys.has(key);
        return (
          <button
            key={key}
            type="button"
            role="menuitem"
            disabled={isPending}
            aria-pressed={isActive}
            aria-label={`${isActive ? "Quitar" : "Reaccionar con"} ${label}`}
            onClick={() => onSelect(key)}
            className={cn(
              "flex items-center justify-center min-w-11 min-h-11 rounded-xl text-lg transition-colors disabled:opacity-40",
              isActive ? "bg-brand/15 ring-1 ring-brand/40" : "hover:bg-ink/5"
            )}
          >
            <span aria-hidden="true">{emoji}</span>
          </button>
        );
      })}
    </motion.div>
  );
}
