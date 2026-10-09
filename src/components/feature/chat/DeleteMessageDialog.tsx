import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

/** Characters of the message shown in the confirmation. */
const SNIPPET_LENGTH = 140;

interface DeleteMessageDialogProps {
  /** The message awaiting confirmation; null keeps the dialog closed. */
  message: { user_name: string; content: string } | null;
  onConfirm: () => void;
  onCancel: () => void;
}

/** Moderation confirm: shows who wrote what before the admin removes it for everyone. */
export function DeleteMessageDialog({ message, onConfirm, onCancel }: DeleteMessageDialogProps) {
  const snippet = message && message.content.length > SNIPPET_LENGTH ? `${message.content.slice(0, SNIPPET_LENGTH)}…` : message?.content;

  return (
    <Dialog open={message !== null} onOpenChange={(open) => !open && onCancel()}>
      <DialogContent className="bg-surface-page border-line-subtle sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-foreground-strong text-xl">Eliminar mensaje</DialogTitle>
          <DialogDescription>Se quitará del chat para todos los asistentes. Esta acción no se puede deshacer.</DialogDescription>
        </DialogHeader>
        {message && (
          <blockquote className="rounded-xl border-l-2 border-brand bg-ink/5 px-3 py-2 text-sm light:bg-surface-subtle">
            <span className="block text-[11px] font-bold text-accent truncate">{message.user_name}</span>
            <span className="block text-foreground break-words">{snippet}</span>
          </blockquote>
        )}
        <DialogFooter className="flex gap-2 sm:justify-end mt-0">
          <Button variant="secondary" onClick={onCancel}>
            Cancelar
          </Button>
          <Button variant="destructive" onClick={onConfirm}>
            Eliminar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
