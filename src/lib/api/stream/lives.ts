import { supabase } from "@/lib/supabase";

export interface LiveEvent {
  id: string;
  title: string;
  description: string | null;
  stream_uid: string | null;
  scheduled_for: string | null;
  is_active: boolean;
  background_image_url: string | null;
  allowed_plans: ("free" | "individual" | "vip")[];
  created_at: string;
}

export async function fetchLives(): Promise<LiveEvent[]> {
  const { data, error } = await supabase
    .from("lives")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data || [];
}

export async function fetchActiveLive(): Promise<LiveEvent | null> {
  const { data, error } = await supabase
    .from("lives")
    .select("*")
    .eq("is_active", true)
    .single();

  // If 0 rows found, return null instead of throwing
  if (error && error.code !== "PGRST116") throw error;
  return data || null;
}

export async function createLive(live: Partial<LiveEvent>): Promise<LiveEvent> {
  const { data, error } = await supabase
    .from("lives")
    .insert([live])
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateLive(id: string, updates: Partial<LiveEvent>): Promise<LiveEvent> {
  const { data, error } = await supabase
    .from("lives")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function deleteLive(id: string): Promise<void> {
  const { error } = await supabase.from("lives").delete().eq("id", id);
  if (error) throw error;
}
