import { mergeMessagesById } from "@/lib/chat/mergeMessagesById";
import type { ReplyTo } from "@/lib/chat/replyTo";

/** Minimal message shape the delete transitions need. */
export interface RemovableMessage {
  id: string;
  created_at: string;
  reply_to?: ReplyTo | null;
}

/**
 * Local equivalent of what the database does when a message is deleted: the
 * message disappears and every reply to it becomes a reply to a deleted
 * message — `reply_to.id` null and no excerpt, author attribution kept (same
 * state the FK ON DELETE SET NULL + trigger produce, see
 * sql/migrate-live-message-replies.sql). Realtime does not deliver those
 * child updates, so the client has to apply them itself.
 *
 * Returns the SAME array when the id is unknown, so a DELETE event for a
 * message that belongs to another live (events are not filtered by live_id)
 * causes no re-render.
 */
export function removeMessage<T extends RemovableMessage>(messages: T[], deletedId: string): T[] {
  const isAffected = messages.some((m) => m.id === deletedId || m.reply_to?.id === deletedId);
  if (!isAffected) return messages;

  return messages
    .filter((m) => m.id !== deletedId)
    .map((m) => (m.reply_to?.id === deletedId ? { ...m, reply_to: { ...m.reply_to, id: null, excerpt: null } } : m));
}

/**
 * Undoes an optimistic `removeMessage` after the server refused the delete:
 * puts the message back (from the `previous` snapshot taken before removing
 * it) and restores the quotes of its replies. Everything else in `current`
 * (messages that arrived meanwhile) is kept.
 */
export function restoreMessage<T extends RemovableMessage>(current: T[], previous: T[], deletedId: string): T[] {
  const original = previous.find((m) => m.id === deletedId);
  const originalQuotes = new Map<string, ReplyTo>();
  for (const m of previous) {
    if (m.reply_to?.id === deletedId) originalQuotes.set(m.id, m.reply_to);
  }

  const withQuotes = current.map((m) => {
    const quote = originalQuotes.get(m.id);
    return quote ? { ...m, reply_to: quote } : m;
  });
  return original ? mergeMessagesById(withQuotes, [original]) : withQuotes;
}
