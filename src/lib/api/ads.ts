import { supabase } from "@/lib/supabase";

export interface ActiveAdVideo {
  videoId: string;        // PK en ad_videos (para incrementar impresiones)
  streamUid: string;      // UID del video en Cloudflare Stream (para reproducir)
  sponsorId: string;
  sponsorName: string;
  sponsorWeight: number;
}

/**
 * Trae el catálogo de anuncios activos (aliados activos + sus videos activos).
 * El frontend hace la selección ponderada en memoria — evita un roundtrip por anuncio.
 */
export async function fetchActiveAdsCatalog(): Promise<ActiveAdVideo[]> {
  const { data, error } = await supabase
    .from("ad_videos")
    .select("id, stream_uid, sponsor_id, ad_sponsors!inner(id, name, weight, is_active)")
    .eq("is_active", true)
    .eq("ad_sponsors.is_active", true);

  if (error) throw error;
  if (!data) return [];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data as any[]).map((row) => ({
    videoId: row.id,
    streamUid: row.stream_uid,
    sponsorId: row.sponsor_id,
    sponsorName: row.ad_sponsors?.name ?? "",
    sponsorWeight: Number(row.ad_sponsors?.weight ?? 0),
  }));
}

/**
 * Selección ponderada de un anuncio del catálogo.
 * - Primero elige un aliado proporcional a su peso.
 * - Luego elige un video aleatorio de ese aliado.
 *
 * Retorna `null` si el catálogo está vacío o todos los pesos son 0.
 *
 * @param catalog Lista de anuncios activos.
 * @param rng    Función de aleatoriedad (default Math.random). Inyectable para tests.
 */
export function pickWeightedAd(
  catalog: ActiveAdVideo[],
  rng: () => number = Math.random,
): ActiveAdVideo | null {
  if (catalog.length === 0) return null;

  // Agrupar por sponsor → mapa sponsorId -> { weight, videos[] }
  const bySponsor = new Map<string, { weight: number; videos: ActiveAdVideo[] }>();
  for (const ad of catalog) {
    const entry = bySponsor.get(ad.sponsorId);
    if (entry) {
      entry.videos.push(ad);
    } else {
      bySponsor.set(ad.sponsorId, { weight: ad.sponsorWeight, videos: [ad] });
    }
  }

  const sponsors = Array.from(bySponsor.values());
  const totalWeight = sponsors.reduce((sum, s) => sum + Math.max(0, s.weight), 0);
  if (totalWeight <= 0) {
    // Todos peso 0 — fallback a uniforme
    const flat = catalog;
    return flat[Math.floor(rng() * flat.length)] ?? null;
  }

  // Pick aliado ponderado
  let r = rng() * totalWeight;
  let chosen = sponsors[0];
  for (const s of sponsors) {
    r -= Math.max(0, s.weight);
    if (r <= 0) {
      chosen = s;
      break;
    }
  }

  // Pick video uniforme dentro del aliado elegido
  return chosen.videos[Math.floor(rng() * chosen.videos.length)] ?? null;
}

/**
 * Incrementa atómicamente el contador de impresiones de un anuncio.
 * Fire-and-forget: errores se loguean pero no rompen la UX del player.
 */
export async function incrementAdImpression(videoId: string): Promise<void> {
  const { error } = await supabase.rpc("increment_ad_impression", { p_video_id: videoId });
  if (error) console.error("[ads] increment impression failed:", error);
}
