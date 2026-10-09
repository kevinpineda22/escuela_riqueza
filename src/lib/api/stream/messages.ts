import { supabase } from "@/lib/supabase";

/** What happened to a message the admin asked to delete. */
export type DeleteLiveMessageResult =
  /** This request removed the row. */
  | "deleted"
  /** The row was already gone (another admin, a double click, ...): the goal is met. */
  | "already-deleted";

/**
 * The DELETE affected no rows and the message still exists: the database
 * refused it (RLS policy missing or the user is not an admin). Callers must
 * roll back instead of treating it as success.
 */
export class MessageDeleteRefusedError extends Error {
  readonly messageId: string;

  constructor(messageId: string) {
    super("El mensaje no se eliminó: la base de datos rechazó la operación (sin permiso)");
    this.name = "MessageDeleteRefusedError";
    this.messageId = messageId;
  }
}

/**
 * Deletes a live chat message (admin moderation). The real guard is the RLS
 * DELETE policy in sql/migrate-live-messages-admin-delete.sql.
 *
 * With RLS a blocked DELETE is NOT an error: PostgREST answers 204/200 with
 * zero rows. Asking for the deleted rows back (`select`) is the only way to
 * tell "deleted" from "nothing happened", but zero rows is ambiguous on its
 * own: it also happens when somebody else already deleted the message, and
 * rolling back then would resurrect a ghost. So on zero rows the message is
 * looked up by id (SELECT is allowed to every authenticated user):
 *
 * - it no longer exists  -> "already-deleted" (success, nothing to roll back);
 * - it still exists      -> the DELETE was refused: MessageDeleteRefusedError;
 * - the lookup itself fails -> the error is thrown (caller rolls back).
 */
export async function deleteLiveMessage(messageId: string): Promise<DeleteLiveMessageResult> {
  const { data, error } = await supabase.from("live_messages").delete().eq("id", messageId).select("id");
  if (error) throw error;
  if (data && data.length > 0) return "deleted";

  const { data: stillThere, error: lookupError } = await supabase
    .from("live_messages")
    .select("id")
    .eq("id", messageId)
    .maybeSingle();
  if (lookupError) throw lookupError;
  if (stillThere) throw new MessageDeleteRefusedError(messageId);
  return "already-deleted";
}
