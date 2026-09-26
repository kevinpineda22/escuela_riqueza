import { cn } from "@/lib/utils";
import { REACTIONS, type ReactionKey, type ReactionSummary } from "@/lib/api/stream/reactions";

interface MessageReactionsProps {
  reactions: ReactionSummary;
  /** true for anonymous public-link visitors: chips are display-only. */
  readOnly?: boolean;
  onToggle?: (key: ReactionKey) => void;
}

/** Chips under a chat bubble — only reactions with count > 0 render. */
export function MessageReactions({ reactions, readOnly = false, onToggle }: MessageReactionsProps) {
  const entries = REACTIONS.filter((r) => (reactions[r.key]?.count || 0) > 0);
  if (entries.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-1 mt-1 px-1">
      {entries.map(({ key, emoji, label }) => {
        const cell = reactions[key]!;
        if (readOnly) {
          return (
            <span
              key={key}
              className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] bg-ink/5 border border-ink/5 text-foreground-muted light:bg-surface-panel light:border-line-subtle"
            >
              <span aria-hidden="true">{emoji}</span>
              <span className="tabular-nums">{cell.count}</span>
            </span>
          );
        }
        return (
          <button
            key={key}
            type="button"
            aria-pressed={cell.mine}
            aria-label={`${cell.mine ? "Quitar" : "Reaccionar con"} ${label} (${cell.count})`}
            onClick={() => onToggle?.(key)}
            className={cn(
              // El chip se ve compacto (~20px) pero el área táctil llega a ~44px con
              // un pseudo-elemento invisible: en celular es la forma de quitar tu
              // reacción y el botón de hover del escritorio no existe.
              "relative inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] border transition-colors",
              "before:absolute before:-inset-x-1 before:-inset-y-3 before:content-['']",
              cell.mine
                ? "bg-brand/15 border-brand/40 text-accent font-semibold"
                : "bg-ink/5 border-ink/5 text-foreground-muted hover:border-brand/30 light:bg-surface-panel light:border-line-subtle"
            )}
          >
            <span aria-hidden="true">{emoji}</span>
            <span className="tabular-nums">{cell.count}</span>
          </button>
        );
      })}
    </div>
  );
}
