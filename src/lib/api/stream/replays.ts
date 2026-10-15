import { supabase } from "@/lib/supabase";
import type { ReplayVisibility } from "@/lib/replayVisibility";

/**
 * Repetición visible para el alumno, tal como la devuelven las RPC
 * `list_school_replays` / `get_school_replay`. `recording_stream_uid` llega en
 * null si `can_watch` es false, y la key de R2 nunca viaja: la URL firmada se
 * pide por `live_id` a /api/stream/recording-url.
 */
export interface SchoolReplay {
  id: string;
  title: string;
  description: string | null;
  starts_at: string;
  background_image_url: string | null;
  recording_duration_seconds: number | null;
  replay_visibility: ReplayVisibility;
  can_watch: boolean;
  recording_storage: "stream" | "r2" | null;
  recording_stream_uid: string | null;
}

export async function listSchoolReplays(): Promise<SchoolReplay[]> {
  const { data, error } = await supabase.rpc("list_school_replays");
  if (error) {
    console.error("[listSchoolReplays] Supabase error:", error);
    throw error;
  }
  return (data || []) as SchoolReplay[];
}

/** Devuelve null si no existe, no está finalizada o está oculta para este usuario. */
export async function getSchoolReplay(liveId: string): Promise<SchoolReplay | null> {
  const { data, error } = await supabase.rpc("get_school_replay", { p_live_id: liveId });
  if (error) {
    console.error("[getSchoolReplay] Supabase error:", error);
    throw error;
  }
  return Array.isArray(data) && data.length > 0 ? (data[0] as SchoolReplay) : null;
}
