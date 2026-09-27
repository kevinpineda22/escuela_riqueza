/**
 * Reply quote attached to a chat message (rendered by QuotedMessage). The
 * author name and excerpt are always DB-derived — see the trigger in
 * sql/migrate-live-message-replies.sql — never trust client input for these.
 */
export interface ReplyTo {
  /** Id of the original message, or null once it was deleted (FK ON DELETE SET NULL). */
  id: string | null;
  user_id: string | null;
  user_name: string;
  /** null means the original message was deleted. */
  excerpt: string | null;
}

/** The message currently being replied to, tracked while composing. */
export interface ReplyTarget {
  id: string;
  userName: string;
  excerpt: string;
}
