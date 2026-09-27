import { cn } from "@/lib/utils";

interface QuotedMessageProps {
  userName: string;
  /** null means the original message was deleted. */
  excerpt: string | null;
  /** Renders as a button that jumps to the original when it is currently loaded in the chat. */
  onJumpToOriginal?: () => void;
  /** Adjusts contrast so the quote reads on the sender's own brand-colored bubble. */
  isOwnBubble?: boolean;
}

/**
 * Quote rendered at the top of a reply bubble. Clicking it never opens the
 * reaction picker of the bubble it's nested in (stopPropagation) — it either
 * scrolls to the original message (when still loaded) or does nothing.
 */
export function QuotedMessage({ userName, excerpt, onJumpToOriginal, isOwnBubble = false }: QuotedMessageProps) {
  const content = (
    <>
      <span className={cn("block text-[11px] font-bold truncate", isOwnBubble ? "text-on-brand/90" : "text-accent")}>
        {userName}
      </span>
      {excerpt === null ? (
        <span className={cn("block text-[11px] italic", isOwnBubble ? "text-on-brand/70" : "text-foreground-muted")}>
          Mensaje eliminado
        </span>
      ) : (
        <span className={cn("block text-[11px] line-clamp-2", isOwnBubble ? "text-on-brand/80" : "text-foreground-muted")}>
          {excerpt}
        </span>
      )}
    </>
  );

  const sharedClassName = cn(
    "mb-1.5 block w-full rounded-lg border-l-2 px-2 py-1 text-left",
    isOwnBubble ? "border-on-brand/50 bg-on-brand/10" : "border-brand bg-ink/10 light:bg-surface-subtle"
  );

  if (onJumpToOriginal) {
    return (
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onJumpToOriginal();
        }}
        aria-label="Ir al mensaje original"
        className={cn(sharedClassName, "cursor-pointer transition-opacity hover:opacity-80")}
      >
        {content}
      </button>
    );
  }

  return (
    <div className={sharedClassName} onClick={(e) => e.stopPropagation()}>
      {content}
    </div>
  );
}
