import { X } from "lucide-react";
import type { ReplyTarget } from "@/lib/chat/replyTo";

interface ReplyComposerPreviewProps {
  target: ReplyTarget;
  onCancel: () => void;
}

/** Bar shown above the chat input while composing a reply. */
export function ReplyComposerPreview({ target, onCancel }: ReplyComposerPreviewProps) {
  return (
    <div className="mb-2 flex items-center gap-2 rounded-lg border-l-2 border-brand bg-ink/5 px-3 py-2 light:bg-surface-subtle">
      <div className="min-w-0 flex-1">
        <p className="truncate text-[11px] font-bold text-accent">Respondiendo a {target.userName}</p>
        <p className="truncate text-xs text-foreground-muted">{target.excerpt}</p>
      </div>
      <button
        type="button"
        onClick={onCancel}
        aria-label="Cancelar respuesta"
        className="flex size-8 shrink-0 items-center justify-center rounded-full text-foreground-muted hover:bg-ink/10 hover:text-foreground"
      >
        <X size={16} />
      </button>
    </div>
  );
}
