/** Presencia de un espectador conectado a un live (canal `live_presence:${liveId}`). */
export interface ViewerInfo {
  user_id: string;
  full_name: string;
  avatar_url: string | null;
  plan: "free" | "individual" | "vip";
  online_at: string;
}
