/**
 * Merges two message lists by `id`, keeping chronological order.
 * Used by the public live chat, which polls for new messages instead of
 * using a Realtime subscription (anon clients don't get one).
 */
export interface MergeableMessage {
  id: string;
  created_at: string;
}

export function mergeMessagesById<T extends MergeableMessage>(current: T[], incoming: T[]): T[] {
  const byId = new Map<string, T>();
  for (const msg of current) byId.set(msg.id, msg);
  for (const msg of incoming) byId.set(msg.id, msg);

  return [...byId.values()].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );
}
