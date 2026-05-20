import { supabase } from "@/lib/supabase";

export interface PlatformSettings {
  id: "global";
  platform_name: string;
  support_email: string;
  contact_phone: string | null;
  whatsapp_number: string | null;
  instagram_url: string | null;
  facebook_url: string | null;
  youtube_url: string | null;
  tiktok_url: string | null;
  footer_tagline: string | null;
  logo_url: string | null;

  maintenance_mode: boolean;
  maintenance_message: string | null;
  allow_signups: boolean;
  default_signup_plan: "free" | "individual" | "vip";

  currency: "USD" | "COP" | "MXN" | "EUR";
  price_individual_monthly: number;
  price_vip_monthly: number;
  trial_days: number;
  free_ad_frequency_seconds: number;

  notif_welcome_email: boolean;
  notif_new_module: boolean;
  notif_live_reminder: boolean;
  notif_marketing: boolean;

  updated_at: string;
  updated_by: string | null;
}

export type PlatformSettingsPatch = Partial<
  Omit<PlatformSettings, "id" | "updated_at" | "updated_by">
>;

export async function fetchPlatformSettings(): Promise<PlatformSettings> {
  const { data, error } = await supabase
    .from("platform_settings")
    .select("*")
    .eq("id", "global")
    .single();
  if (error) throw error;
  return data as PlatformSettings;
}

export async function updatePlatformSettings(
  patch: PlatformSettingsPatch
): Promise<PlatformSettings> {
  const { data, error } = await supabase
    .from("platform_settings")
    .update(patch)
    .eq("id", "global")
    .select("*")
    .single();
  if (error) throw error;
  return data as PlatformSettings;
}
