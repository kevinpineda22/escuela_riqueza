/**
 * Drops the messages whose id is in `deletedIds` (the "tombstones" of a live
 * chat). Any async path that can bring messages back into state — a late
 * Realtime INSERT, a history load, a reconnect resync — filters through this
 * so a message deleted in the meantime can't reappear.
 *
 * Returns the SAME array when nothing is dropped.
 */
export function excludeDeleted<T extends { id: string }>(messages: T[], deletedIds: ReadonlySet<string>): T[] {
  if (deletedIds.size === 0) return messages;
  const kept = messages.filter((m) => !deletedIds.has(m.id));
  return kept.length === messages.length ? messages : kept;
}
