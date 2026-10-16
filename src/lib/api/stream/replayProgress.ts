import { supabase } from "@/lib/supabase";

export interface ReplayProgress {
  position_seconds: number;
  duration_seconds: number | null;
}

/** Última posición guardada del usuario en la grabación; `null` si no hay o falla la lectura. */
export async function getReplayProgress(liveId: string): Promise<ReplayProgress | null> {
  // RLS limita la lectura a la fila del propio usuario: no hace falta filtrar por user_id.
  const { data, error } = await supabase
    .from("user_replay_progress")
    .select("position_seconds, duration_seconds")
    .eq("live_id", liveId)
    .maybeSingle();
  if (error) {
    console.error("Error fetching replay progress:", error);
    return null;
  }
  return data;
}

/** Guarda (upsert por user_id + live_id) la posición actual. Sin sesión no hace nada. */
export async function saveReplayProgress(
  liveId: string,
  positionSeconds: number,
  durationSeconds?: number | null,
): Promise<void> {
  // getSession lee el almacenamiento local: es lo bastante rápido para el cierre de pestaña.
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) return;

  const duration = durationSeconds != null && Number.isFinite(durationSeconds) ? Math.floor(durationSeconds) : null;
  const { error } = await supabase.from("user_replay_progress").upsert({
    user_id: session.user.id,
    live_id: liveId,
    position_seconds: Math.max(0, Math.floor(positionSeconds)),
    duration_seconds: duration,
    updated_at: new Date().toISOString(),
  });
  if (error) console.error("Error saving replay progress:", error);
}
