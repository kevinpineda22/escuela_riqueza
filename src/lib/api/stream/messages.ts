import { supabase } from "@/lib/supabase";

/**
 * Deletes a live chat message (admin moderation). The real guard is the RLS
 * DELETE policy in sql/migrate-live-messages-admin-delete.sql.
 *
 * With RLS a blocked DELETE is NOT an error: PostgREST answers 204/200 with
 * zero rows. Asking for the deleted rows back (`select`) is the only way to
 * tell "deleted" from "silently refused" (non-admin, policy not applied yet,
 * or the message no longer exists), so zero rows is reported as a failure.
 */
export async function deleteLiveMessage(messageId: string): Promise<void> {
  const { data, error } = await supabase.from("live_messages").delete().eq("id", messageId).select("id");
  if (error) throw error;
  if (!data || data.length === 0) {
    throw new Error("No se eliminó ninguna fila (sin permiso o el mensaje ya no existe)");
  }
}
