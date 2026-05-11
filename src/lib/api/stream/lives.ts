import { supabase } from "@/lib/supabase";

export type LiveStatus = "scheduled" | "live" | "ended";
export type PlanType = "free" | "individual" | "vip";

export interface LiveEvent {
  id: string;
  title: string;
  description: string | null;
  starts_at: string;
  duration_minutes: number | null;
  stream_live_input_id: string | null;
  required_plan: PlanType;
  status: LiveStatus;
  background_image_url: string | null;
  allowed_plans: string[];
  created_at: string;
}

function sanitize(live: Record<string, unknown>): Record<string, unknown> {
  const out = { ...live };
  for (const key of ["starts_at", "stream_live_input_id", "background_image_url", "description"] as const) {
    if (key in out && out[key] === "") out[key] = null;
  }
  return out;
}

export async function fetchLives(): Promise<LiveEvent[]> {
  const { data, error } = await supabase
    .from("lives")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data || []) as LiveEvent[];
}

export async function fetchActiveLive(): Promise<LiveEvent | null> {
  // First: currently live room
  const { data: liveData, error: liveErr } = await supabase
    .from("lives")
    .select("*")
    .eq("status", "live")
    .limit(1);

  if (liveErr) throw liveErr;
  if (liveData && liveData.length > 0) return liveData[0] as LiveEvent;

  // Fallback: next scheduled room (closest starts_at)
  const { data: nextData, error: nextErr } = await supabase
    .from("lives")
    .select("*")
    .eq("status", "scheduled")
    .order("starts_at", { ascending: true })
    .limit(1);

  if (nextErr) throw nextErr;
  if (nextData && nextData.length > 0) return nextData[0] as LiveEvent;

  return null;
}

export async function createLive(live: Partial<LiveEvent>): Promise<LiveEvent> {
  const { data, error } = await supabase
    .from("lives")
    .insert([sanitize(live as Record<string, unknown>)])
    .select()
    .single();

  if (error) {
    console.error("[createLive] Supabase error:", error);
    throw error;
  }
  return data as LiveEvent;
}

export async function updateLive(id: string, updates: Partial<LiveEvent>): Promise<LiveEvent> {
  const { data, error } = await supabase
    .from("lives")
    .update(sanitize(updates as Record<string, unknown>))
    .eq("id", id)
    .select()
    .single();

  if (error) {
    console.error("[updateLive] Supabase error:", error);
    throw error;
  }
  return data as LiveEvent;
}

export async function deleteLive(id: string): Promise<void> {
  const { error } = await supabase.from("lives").delete().eq("id", id);
  if (error) throw error;
}
