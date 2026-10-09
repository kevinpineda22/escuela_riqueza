import { mergeMessagesById, type MergeableMessage } from "@/lib/chat/mergeMessagesById";

/**
 * Reconciles a polled, WINDOWED message list with what is already on screen.
 *
 * `mergeMessagesById` only ever adds, so a message deleted by an admin would
 * stay forever in the anonymous public chat (which polls instead of using
 * Realtime). Here the server response is authoritative for the time range it
 * covers:
 *
 * - The server returns the latest `limit` messages. If it returned fewer
 *   than `limit`, it returned the WHOLE history: every local message missing
 *   from the response was deleted.
 * - If it returned exactly `limit`, there may be older messages outside the
 *   window. Only local messages strictly newer than the oldest returned one
 *   are checked against the response; older ones are kept as they are.
 *   (Strictly newer, not "equal or newer": a local message with the same
 *   timestamp as the window edge may just be the one the `limit` cut off, and
 *   dropping it wrongly is worse than leaving a deleted one for a tick.)
 * - An EMPTY response with `limit > 0` falls in the first case: the live has
 *   no messages at all, so the chat is emptied. This also happens if the
 *   public link gets revoked (the RPC returns nothing without a valid
 *   token), which is fine — the room stops rendering anyway. A failed
 *   request never reaches this function (the fetch throws and the caller
 *   keeps its state).
 *
 * `keepIds` are local-only entries (the welcome message) that must survive
 * regardless of the window.
 *
 * Replies come with their reply_to_* columns already updated by the server, so
 * replacing the in-window messages with the fetched ones also refreshes a
 * reply whose original was deleted.
 */
export function reconcileWindowedMessages<T extends MergeableMessage>(
  current: T[],
  fetched: T[],
  limit: number,
  keepIds: readonly string[] = []
): T[] {
  const kept = new Set(keepIds);
  const windowIsComplete = fetched.length < limit;
  const oldestFetchedAt = fetched.length > 0 ? Math.min(...fetched.map((m) => new Date(m.created_at).getTime())) : null;

  const survivors = current.filter((m) => {
    if (kept.has(m.id)) return true;
    if (windowIsComplete || oldestFetchedAt === null) return false;
    return new Date(m.created_at).getTime() <= oldestFetchedAt;
  });

  return mergeMessagesById(survivors, fetched);
}
