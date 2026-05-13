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
  is_active: boolean;
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
    .neq("status", "ended")
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data || []) as LiveEvent[];
}

export async function fetchLivesForPlan(plan: string): Promise<LiveEvent[]> {
  const { data, error } = await supabase
    .from("lives")
    .select("*")
    .in("status", ["scheduled", "live"])
    .contains("allowed_plans", [plan])
    .order("starts_at", { ascending: true });

  if (error) throw error;
  return (data || []) as LiveEvent[];
}

export async function fetchActiveLive(): Promise<LiveEvent | null> {
  const { data, error } = await supabase
    .from("lives")
    .select("*")
    .eq("is_active", true)
    .in("status", ["live", "scheduled"])
    .order("starts_at", { ascending: true })
    .limit(1);

  if (error) throw error;
  if (data && data.length > 0) return data[0] as LiveEvent;
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

export async function setActiveLive(id: string): Promise<LiveEvent> {
  // Deactivate all others first
  await supabase
    .from("lives")
    .update({ is_active: false })
    .neq("id", id)
    .in("status", ["scheduled", "live"]);

  // Activate the selected one
  const { data, error } = await supabase
    .from("lives")
    .update({ is_active: true })
    .eq("id", id)
    .select()
    .single();

  if (error) {
    console.error("[setActiveLive] Supabase error:", error);
    throw error;
  }
  return data as LiveEvent;
}

export async function deleteLive(id: string): Promise<void> {
  const { error } = await supabase.from("lives").delete().eq("id", id);
  if (error) throw error;
}
