import { useState, type Dispatch, type SetStateAction } from "react";
import { toast } from "@/components/ui/toaster";
import { deleteLiveMessage } from "@/lib/api/stream/messages";
import { removeMessage, restoreMessage, type RemovableMessage } from "@/lib/chat/removeMessage";

interface UseMessageModerationParams<T extends RemovableMessage> {
  messages: T[];
  setMessages: Dispatch<SetStateAction<T[]>>;
  /** Called as soon as the message is removed locally, to drop UI that points at it (open picker, reply composer). */
  onRemoved: (messageId: string) => void;
}

export interface UseMessageModerationResult<T extends RemovableMessage> {
  /** Message waiting for the admin's confirmation, if any. */
  pending: T | null;
  requestDelete: (message: T) => void;
  cancelDelete: () => void;
  confirmDelete: () => Promise<void>;
}

/**
 * Admin delete flow for a live chat: ask for confirmation, remove the message
 * optimistically (everyone else gets it through the Realtime DELETE event),
 * and roll back with a toast if the server refuses.
 */
export function useMessageModeration<T extends RemovableMessage>({
  messages,
  setMessages,
  onRemoved,
}: UseMessageModerationParams<T>): UseMessageModerationResult<T> {
  const [pending, setPending] = useState<T | null>(null);

  const confirmDelete = async () => {
    if (!pending) return;
    const target = pending;
    const snapshot = messages;
    setPending(null);
    setMessages((prev) => removeMessage(prev, target.id));
    onRemoved(target.id);

    try {
      await deleteLiveMessage(target.id);
      toast.success("Mensaje eliminado");
    } catch (err) {
      console.error("[useMessageModeration] error al eliminar el mensaje:", err);
      setMessages((prev) => restoreMessage(prev, snapshot, target.id));
      toast.error("No se pudo eliminar el mensaje");
    }
  };

  return { pending, requestDelete: setPending, cancelDelete: () => setPending(null), confirmDelete };
}
