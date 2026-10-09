import { useCallback, useEffect, useRef, type Dispatch, type SetStateAction, type RefObject } from "react";
import { removeMessage, type RemovableMessage } from "@/lib/chat/removeMessage";

interface UseLiveMessageDeletionsParams<T extends RemovableMessage> {
  /** Tombstones belong to one live: they are cleared whenever it changes. */
  liveId: string;
  setMessages: Dispatch<SetStateAction<T[]>>;
  /** Drops UI that points at the deleted message (open picker, reply composer). */
  onDeleted: (messageId: string) => void;
}

export interface UseLiveMessageDeletionsResult {
  /**
   * Ids deleted during this live. Read it (never copy it) from the async paths
   * that can bring messages back — late INSERT, history load, reconnect resync
   * — and filter with `excludeDeleted` right before setting state.
   */
  tombstonesRef: RefObject<Set<string>>;
  /**
   * The single place a message deletion is applied, whether it came from a
   * Realtime DELETE or from the local moderator: tombstone it, remove it
   * (re-pointing its replies) and clean up the dependent UI.
   * Identity is stable, so it is safe inside the Realtime effect.
   */
  markDeleted: (messageId: string) => void;
  /** Takes the tombstone back when a delete is rolled back (the server refused it). */
  unmarkDeleted: (messageId: string) => void;
}

/**
 * Deletion bookkeeping for a live chat. Without tombstones a delete is lost
 * whenever it overtakes the thing that would add the message: an INSERT still
 * resolving the author's name, a history query that started before the
 * delete, or a reconnect gap. See docs/CHANGELOG.md 2026-10-09.
 */
export function useLiveMessageDeletions<T extends RemovableMessage>({
  liveId,
  setMessages,
  onDeleted,
}: UseLiveMessageDeletionsParams<T>): UseLiveMessageDeletionsResult {
  const tombstonesRef = useRef<Set<string>>(new Set());
  // `onDeleted` cambia en cada render; se lee por ref para que `markDeleted`
  // pueda ser estable y vivir dentro del efecto de Realtime.
  const onDeletedRef = useRef(onDeleted);

  useEffect(() => {
    onDeletedRef.current = onDeleted;
  }, [onDeleted]);

  // Declarado antes que los efectos que consumen el set (los hooks corren en
  // orden): al cambiar de live el set ya está vacío cuando ellos arrancan.
  useEffect(() => {
    tombstonesRef.current.clear();
  }, [liveId]);

  // useCallback es necesario: el efecto de Realtime de LiveChat lo usa como
  // dependencia y no debe reabrir la suscripción en cada render.
  const markDeleted = useCallback(
    (messageId: string) => {
      tombstonesRef.current.add(messageId);
      setMessages((prev) => removeMessage(prev, messageId));
      onDeletedRef.current(messageId);
    },
    [setMessages]
  );

  const unmarkDeleted = useCallback((messageId: string) => {
    tombstonesRef.current.delete(messageId);
  }, []);

  return { tombstonesRef, markDeleted, unmarkDeleted };
}
