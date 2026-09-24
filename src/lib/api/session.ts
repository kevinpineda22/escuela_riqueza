import { supabase } from "@/lib/supabase";

/**
 * - `active`: esta sesión es la vigente del usuario.
 * - `superseded`: la cuenta se abrió en otro dispositivo más tarde; esta sesión ya fue revocada.
 * - `unknown`: no se pudo verificar (red, migración sin aplicar). Nunca expulsa: fail-open.
 */
export type ActiveSessionStatus = "active" | "superseded" | "unknown";

/** Reclama o confirma la sesión única del usuario. Ver `sql/migrate-single-session.sql`. */
export async function claimActiveSession(): Promise<ActiveSessionStatus> {
  try {
    const { data, error } = await supabase.rpc("claim_active_session");
    if (error) {
      console.warn("[claimActiveSession] No se pudo verificar la sesión:", error);
      return "unknown";
    }
    if (data === true) return "active";
    if (data === false) return "superseded";
    return "unknown";
  } catch (err) {
    console.warn("[claimActiveSession] Error de red:", err);
    return "unknown";
  }
}
