import { supabase } from "@/lib/supabase";
import { authedFetch } from "@/lib/api/client";

export type LiveStatus = "scheduled" | "live" | "ended";
export type PlanType = "free" | "individual" | "vip";

export interface LiveEvent {
  id: string;
  title: string;
  description: string | null;
  starts_at: string;
  duration_minutes: number | null;
  stream_live_input_id: string | null;
  recording_stream_uid: string | null;
  recording_r2_key: string | null;
  recording_storage: "stream" | "r2" | null;
  recording_bytes: number | null;
  recording_duration_seconds: number | null;
  archived_at: string | null;
  required_plan: PlanType;
  status: LiveStatus;
  is_active: boolean;
  is_paused: boolean;
  background_image_url: string | null;
  allowed_plans: string[];
  created_at: string;
  is_public: boolean;
  share_token: string | null;
}

function sanitize(live: Record<string, unknown>): Record<string, unknown> {
  const out = { ...live };
  for (const key of ["starts_at", "stream_live_input_id", "recording_stream_uid", "background_image_url", "description"] as const) {
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

export async function deactivateAllLives(): Promise<void> {
  const { error } = await supabase
    .from("lives")
    .update({ is_active: false })
    .in("status", ["scheduled", "live"]);
  if (error) {
    console.error("[deactivateAllLives] Supabase error:", error);
    throw error;
  }
}

export async function fetchEndedLives(): Promise<LiveEvent[]> {
  const { data, error } = await supabase
    .from("lives")
    .select("*")
    .eq("status", "ended")
    .order("starts_at", { ascending: false });
  if (error) throw error;
  return (data || []) as LiveEvent[];
}

let liveInputStatusDisabled = false;

export async function checkLiveInputStatus(liveInputId: string): Promise<{ connected: boolean; isError?: boolean; disabled?: boolean }> {
  if (liveInputStatusDisabled) {
    return { connected: false, disabled: true };
  }
  if (import.meta.env.DEV) {
    // Vite dev no ejecuta Functions de /api. Apagamos el polling para evitar 502s.
    liveInputStatusDisabled = true;
    return { connected: false, disabled: true };
  }
  try {
    const res = await authedFetch("/api/stream/live-input-status", {
      method: "POST",
      body: JSON.stringify({ live_input_id: liveInputId }),
    });
    if (!res.ok) {
      if (res.status >= 500) liveInputStatusDisabled = true;
      return { connected: false, isError: true };
    }
    const data = await res.json();
    if (data?.disabled) liveInputStatusDisabled = true;
    return data;
  } catch {
    return { connected: false, isError: true };
  }
}

/** Una de las transmisiones grabadas de un Live Input. */
export interface StreamRecording {
  uid: string;
  created: string | null;
  duration: number;
  name: string | null;
}

export interface RecordingLookup {
  recording_uid: string | null;
  /** Todas las grabaciones listas, de la más larga a la más corta. */
  recordings?: StreamRecording[];
  duration?: number;
  message?: string;
}

/**
 * Busca la grabación de un Live Input. Con `startsAt` (fecha del vivo) sugiere la más
 * larga DE ESE DÍA — sin eso se mezclan las grabaciones de todos los sábados y puede
 * sugerir un vivo viejo. Con `videoUid` confirma la que el admin eligió de la lista
 * y le habilita la descarga MP4.
 */
export async function fetchRecording(
  liveInputId: string,
  opts: { videoUid?: string; startsAt?: string | null } = {}
): Promise<RecordingLookup> {
  try {
    const res = await authedFetch("/api/stream/recording", {
      method: "POST",
      body: JSON.stringify({
        live_input_id: liveInputId,
        ...(opts.videoUid ? { video_uid: opts.videoUid } : {}),
        ...(opts.startsAt ? { starts_at: opts.startsAt } : {}),
      }),
    });
    if (!res.ok) throw new Error("Error al consultar grabación");
    return await res.json();
  } catch (err) {
    console.error("Error fetching recording:", err);
    return { recording_uid: null, message: "Error de conexión con el servidor" };
  }
}

/** Genera un token de 32 chars hex para el link público (sin guiones, URL-safe). */
function generateShareToken(): string {
  return crypto.randomUUID().replace(/-/g, "");
}

/**
 * Activa/desactiva el link público de una sala.
 * Al activar: si la sala ya tiene `share_token`, se conserva (el link no cambia
 * al reactivar). Al desactivar: se mantiene el token guardado, solo se apaga
 * `is_public`, así el admin puede reactivar sin generar un link nuevo.
 */
export async function setLivePublic(id: string, isPublic: boolean, currentToken?: string | null): Promise<LiveEvent> {
  const updates: Partial<LiveEvent> = { is_public: isPublic };
  if (isPublic && !currentToken) {
    updates.share_token = generateShareToken();
  }

  const { data, error } = await supabase
    .from("lives")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    console.error("[setLivePublic] Supabase error:", error);
    throw error;
  }
  return data as LiveEvent;
}

/** Arma la URL pública compartible a partir del token de la sala. */
export function buildPublicLiveUrl(token: string): string {
  return `${window.location.origin}/live/${token}`;
}

export async function getPublicLive(token: string): Promise<LiveEvent | null> {
  const { data, error } = await supabase.rpc("get_public_live", { p_token: token });
  if (error) {
    console.error("[getPublicLive] Supabase error:", error);
    throw error;
  }
  if (Array.isArray(data) && data.length > 0) return data[0] as LiveEvent;
  return null;
}

/**
 * Indica si una sala pública ya tiene grabación vinculada, sin revelar el id
 * (Stream) ni la key (R2) de esa grabación. `get_public_live` anula esas
 * columnas para quien no tiene plan pago, así que el frontend no puede
 * distinguir "sin grabación todavía" de "grabación bloqueada por plan" salvo
 * con este boolean — ver sql/migrate-public-live-has-recording.sql.
 */
export async function publicLiveHasRecording(token: string): Promise<boolean> {
  try {
    const { data, error } = await supabase.rpc("public_live_has_recording", { p_token: token });
    if (error) {
      console.error("[publicLiveHasRecording] Supabase error:", error);
      return false;
    }
    return Boolean(data);
  } catch (err) {
    console.error("[publicLiveHasRecording] error:", err);
    return false;
  }
}

export interface PublicChatMessage {
  id: string;
  user_id: string;
  message: string;
  created_at: string;
  user_name: string;
}

export async function getPublicLiveMessages(token: string, limit = 100): Promise<PublicChatMessage[]> {
  const { data, error } = await supabase.rpc("get_public_live_messages", { p_token: token, p_limit: limit });
  if (error) {
    console.error("[getPublicLiveMessages] Supabase error:", error);
    throw error;
  }
  return (data || []) as PublicChatMessage[];
}

export async function deleteLive(id: string): Promise<void> {
  const { error } = await supabase.from("lives").delete().eq("id", id);
  if (error) throw error;
}

export type ArchiveResult =
  | { status: "archived"; key: string; bytes: number | null; durationSeconds: number | null }
  | { status: "processing"; percent: number }
  /** El video se reproduce, pero Stream no puede convertirlo a MP4 (supera la duración máxima). */
  | { status: "unarchivable"; message: string }
  | { status: "error"; message: string };

/**
 * Dispara el archivado de la grabación a R2 (copia desde Stream + borrado de Stream).
 * Devuelve 'processing' si el MP4 todavía se está generando en Cloudflare.
 */
export async function archiveRecording(liveId: string, streamVideoUid: string): Promise<ArchiveResult> {
  try {
    const res = await authedFetch("/api/stream/archive-recording", {
      method: "POST",
      body: JSON.stringify({ live_id: liveId, stream_video_uid: streamVideoUid }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return { status: "error", message: data?.error || "Error al archivar la grabación" };
    }
    return data as ArchiveResult;
  } catch (err) {
    console.error("Error archiving recording:", err);
    return { status: "error", message: "Error de conexión con el servidor" };
  }
}

/** Pide una URL firmada de vida corta para reproducir/descargar una grabación en R2. */
export async function fetchRecordingUrl(liveId: string): Promise<string | null> {
  try {
    const res = await authedFetch("/api/stream/recording-url", {
      method: "POST",
      body: JSON.stringify({ live_id: liveId }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data?.url || null;
  } catch (err) {
    console.error("Error fetching recording URL:", err);
    return null;
  }
}

