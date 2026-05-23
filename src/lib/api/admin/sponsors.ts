import { supabase } from "@/lib/supabase";

// ---------- Types ----------
export interface Sponsor {
  id: string;
  name: string;
  logo_url: string | null;
  weight: number;
  is_active: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface AdVideo {
  id: string;
  sponsor_id: string;
  title: string;
  stream_uid: string;
  duration_seconds: number | null;
  is_active: boolean;
  impression_count: number;
  created_at: string;
  updated_at: string;
}

export interface SponsorWithVideos extends Sponsor {
  videos: AdVideo[];
}

export type SponsorPatch = Partial<Omit<Sponsor, "id" | "created_at" | "updated_at">>;
export type AdVideoPatch = Partial<Omit<AdVideo, "id" | "sponsor_id" | "stream_uid" | "created_at" | "updated_at" | "impression_count">>;

// ---------- Sponsors CRUD ----------
export async function fetchSponsors(): Promise<SponsorWithVideos[]> {
  const { data: sponsors, error: sErr } = await supabase
    .from("ad_sponsors")
    .select("*")
    .order("weight", { ascending: false });
  if (sErr) throw sErr;

  const { data: videos, error: vErr } = await supabase
    .from("ad_videos")
    .select("*")
    .order("created_at", { ascending: false });
  if (vErr) throw vErr;

  return (sponsors ?? []).map((s) => ({
    ...(s as Sponsor),
    videos: (videos ?? []).filter((v) => v.sponsor_id === s.id) as AdVideo[],
  }));
}

export async function createSponsor(input: {
  name: string;
  weight?: number;
  logo_url?: string | null;
  notes?: string | null;
}): Promise<Sponsor> {
  const { data, error } = await supabase
    .from("ad_sponsors")
    .insert({
      name: input.name,
      weight: input.weight ?? 10,
      logo_url: input.logo_url ?? null,
      notes: input.notes ?? null,
    })
    .select("*")
    .single();
  if (error) throw error;
  return data as Sponsor;
}

export async function updateSponsor(id: string, patch: SponsorPatch): Promise<Sponsor> {
  const { data, error } = await supabase
    .from("ad_sponsors")
    .update(patch)
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw error;
  return data as Sponsor;
}

export async function deleteSponsor(id: string): Promise<void> {
  const { error } = await supabase.from("ad_sponsors").delete().eq("id", id);
  if (error) throw error;
}

// ---------- Ad Videos CRUD ----------
export async function createAdVideo(input: {
  sponsor_id: string;
  title: string;
  stream_uid: string;
  duration_seconds?: number | null;
}): Promise<AdVideo> {
  const { data, error } = await supabase
    .from("ad_videos")
    .insert({
      sponsor_id: input.sponsor_id,
      title: input.title,
      stream_uid: input.stream_uid,
      duration_seconds: input.duration_seconds ?? null,
    })
    .select("*")
    .single();
  if (error) throw error;
  return data as AdVideo;
}

export async function updateAdVideo(id: string, patch: AdVideoPatch): Promise<AdVideo> {
  const { data, error } = await supabase
    .from("ad_videos")
    .update(patch)
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw error;
  return data as AdVideo;
}

export async function deleteAdVideo(id: string): Promise<void> {
  const { error } = await supabase.from("ad_videos").delete().eq("id", id);
  if (error) throw error;
}
