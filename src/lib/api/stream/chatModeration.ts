import { supabase } from "@/lib/supabase";

/** Cuánto dura el silencio desde el menú del mensaje. */
export const DEFAULT_MUTE_MINUTES = 10;

/** Errores del chat que vienen del servidor (sql/migrate-live-chat-safety.sql) con texto para el alumno. */
const CHAT_ERROR_HINTS = new Set(["chat_suspended", "chat_closed", "chat_muted", "chat_rate"]);

/**
 * Si el error es una regla del chat (largo, ritmo, silenciado, clase
 * finalizada, cuenta suspendida), su mensaje está escrito para el alumno y se
 * muestra tal cual. Cualquier otro error devuelve null: lo decide quien llama.
 */
export function chatRuleMessage(error: unknown): string | null {
  if (!error || typeof error !== "object") return null;
  const { hint, message, code } = error as { hint?: unknown; message?: unknown; code?: unknown };
  if (typeof hint === "string" && CHAT_ERROR_HINTS.has(hint) && typeof message === "string") return message;
  // 23514 = check_violation: el largo del mensaje.
  if (code === "23514") return "El mensaje es muy largo: máximo 300 caracteres.";
  return null;
}

/** Silencia a alguien en esta clase. `minutes` null = toda la clase. Solo admins (RLS). */
export async function muteChatUser(liveId: string, userId: string, minutes: number | null = DEFAULT_MUTE_MINUTES): Promise<void> {
  const { data: { session } } = await supabase.auth.getSession();
  const { error } = await supabase.from("live_chat_mutes").upsert(
    {
      live_id: liveId,
      user_id: userId,
      muted_until: minutes == null ? null : new Date(Date.now() + minutes * 60_000).toISOString(),
      muted_by: session?.user.id ?? null,
    },
    { onConflict: "live_id,user_id" },
  );
  if (error) throw error;
}

export async function unmuteChatUser(liveId: string, userId: string): Promise<void> {
  const { error } = await supabase.from("live_chat_mutes").delete().eq("live_id", liveId).eq("user_id", userId);
  if (error) throw error;
}
