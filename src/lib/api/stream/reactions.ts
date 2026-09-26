import { supabase } from "@/lib/supabase";

/** The 4 reactions approved by the client — see docs/CHANGELOG.md 2026-09-26. */
export const REACTIONS = [
  { key: "heart", emoji: "❤️", label: "corazón" },
  { key: "fire", emoji: "🔥", label: "fuego" },
  { key: "clap", emoji: "👏", label: "aplausos" },
  { key: "raised_hands", emoji: "🙌", label: "manos arriba" },
] as const;

export type ReactionKey = (typeof REACTIONS)[number]["key"];

const REACTION_KEYS = new Set<string>(REACTIONS.map((r) => r.key));

export function isReactionKey(value: string): value is ReactionKey {
  return REACTION_KEYS.has(value);
}

export interface ReactionRow {
  message_id: string;
  user_id: string;
  emoji: ReactionKey;
}

/** Per-emoji count and whether the current user is one of the reactors. */
export type ReactionCell = { count: number; mine: boolean };

/** Only keys with count > 0 are present — the UI renders a chip per entry. */
export type ReactionSummary = Partial<Record<ReactionKey, ReactionCell>>;

export type ReactionsByMessage = Map<string, ReactionSummary>;

/** Builds the full per-message summary from scratch (used after loading history). */
export function aggregateReactions(rows: ReactionRow[], currentUserId: string | null): ReactionsByMessage {
  const byMessage: ReactionsByMessage = new Map();
  for (const row of rows) {
    const summary = { ...(byMessage.get(row.message_id) || {}) };
    const cell = summary[row.emoji];
    summary[row.emoji] = {
      count: (cell?.count || 0) + 1,
      mine: cell?.mine || row.user_id === currentUserId,
    };
    byMessage.set(row.message_id, summary);
  }
  return byMessage;
}

/**
 * Applies one INSERT (a reaction was added) to an existing summary map.
 * Returns a NEW map (React-state friendly); ignores a duplicate of a row
 * already counted (same message+user+emoji can't happen per the DB's
 * primary key, but a Realtime echo of our own optimistic update could
 * re-deliver the same insert).
 */
export function applyReactionAdded(
  current: ReactionsByMessage,
  row: ReactionRow,
  currentUserId: string | null
): ReactionsByMessage {
  const next = new Map(current);
  const summary = { ...(next.get(row.message_id) || {}) };
  const cell = summary[row.emoji];
  const isMine = row.user_id === currentUserId;

  // Our own optimistic update already counted this exact reaction — a
  // Realtime echo of it must not double-count.
  if (cell?.mine && isMine) {
    next.set(row.message_id, summary);
    return next;
  }

  summary[row.emoji] = { count: (cell?.count || 0) + 1, mine: cell?.mine || isMine };
  next.set(row.message_id, summary);
  return next;
}

/**
 * Applies one DELETE (a reaction was removed) to an existing summary map.
 * `row` only needs to carry the primary-key columns — that's all Postgres
 * Realtime guarantees in the `old` record for a DELETE with the table's
 * default replica identity (primary key). Never lets a count go negative;
 * a delete for a message we have no record of is a no-op.
 */
export function applyReactionRemoved(
  current: ReactionsByMessage,
  row: Pick<ReactionRow, "message_id" | "user_id" | "emoji">,
  currentUserId: string | null
): ReactionsByMessage {
  const existing = current.get(row.message_id);
  if (!existing) return current;
  const cell = existing[row.emoji];
  if (!cell) return current;

  const isMine = row.user_id === currentUserId;
  // Our own optimistic removal already applied this exact delete — a Realtime
  // echo of it must not decrement again. A user holds at most one row per
  // (message, emoji) (primary key), so "it's mine but I no longer have it"
  // can only mean "already removed locally". Without this, with count > 1
  // the echo also wiped ANOTHER viewer's reaction from every screen.
  if (isMine && !cell.mine) return current;

  const next = new Map(current);
  const summary = { ...existing };
  const nextCount = Math.max(0, cell.count - 1);
  if (nextCount === 0) {
    delete summary[row.emoji];
  } else {
    summary[row.emoji] = { count: nextCount, mine: cell.mine && !isMine };
  }
  next.set(row.message_id, summary);
  return next;
}

/** Reactions for the whole live in one query — never one query per message. */
export async function fetchLiveReactions(liveId: string): Promise<ReactionRow[]> {
  const { data, error } = await supabase
    .from("live_message_reactions")
    .select("message_id, user_id, emoji")
    .eq("live_id", liveId);
  if (error) throw error;
  return (data || []) as ReactionRow[];
}

export async function addReaction(messageId: string, liveId: string, key: ReactionKey, userId: string): Promise<void> {
  const { error } = await supabase.from("live_message_reactions").insert({
    message_id: messageId,
    live_id: liveId,
    user_id: userId,
    emoji: key,
  });
  // 23505 (unique_violation): the reaction is already there (e.g. a retried
  // tap) — not an error from the caller's point of view.
  if (error && error.code !== "23505") throw error;
}

export async function removeReaction(messageId: string, key: ReactionKey, userId: string): Promise<void> {
  const { error } = await supabase
    .from("live_message_reactions")
    .delete()
    .eq("message_id", messageId)
    .eq("emoji", key)
    .eq("user_id", userId);
  if (error) throw error;
}

/** Aggregated counts for a public (anonymous) live link — no per-user rows. */
export async function fetchPublicLiveReactions(token: string): Promise<ReactionsByMessage> {
  const { data, error } = await supabase.rpc("get_public_live_reactions", { p_token: token });
  if (error) throw error;

  const byMessage: ReactionsByMessage = new Map();
  for (const row of (data || []) as { message_id: string; emoji: string; total: number }[]) {
    if (!isReactionKey(row.emoji)) continue;
    const summary = { ...(byMessage.get(row.message_id) || {}) };
    summary[row.emoji] = { count: Number(row.total), mine: false };
    byMessage.set(row.message_id, summary);
  }
  return byMessage;
}
