// Cuánto dura la clase hasta ahora, sin cargar el modo "Clase completa".
//
// En Fluidez el reproductor solo conoce los últimos segundos del vivo, pero la
// barra muestra la clase entera (como YouTube). La duración sale de la playlist
// DVR de Cloudflare: se lee como texto (no se reproduce) solo cuando el alumno
// toca la barra, y se estima hacia adelante con el reloj.

export type LiveManifestMode = "smooth" | "low" | "dvr";

/** Manifiesto HLS de un Live Input de Cloudflare Stream según el modo. */
export function liveManifestUrl(customerCode: string, liveInputId: string, mode: LiveManifestMode): string {
  const base = `https://customer-${customerCode}.cloudflarestream.com/${liveInputId}/manifest/video.m3u8`;
  // `?protocol=llhls&dvrEnabled=true` da 500: DVR y LL-HLS son excluyentes.
  if (mode === "low") return `${base}?protocol=llhls`;
  if (mode === "dvr") return `${base}?dvrEnabled=true`;
  return base;
}

/** Suma de los `#EXTINF` de una playlist de medios: cuántos segundos cubre. */
export function playlistDuration(text: string): number {
  let total = 0;
  for (const match of text.matchAll(/^#EXTINF:([\d.]+)/gm)) total += parseFloat(match[1]);
  return total;
}

/** Primera variante de una playlist maestra, resuelta contra su URL. Null si ya es de medios. */
export function firstVariantUrl(masterText: string, masterUrl: string): string | null {
  if (!/#EXT-X-STREAM-INF/.test(masterText)) return null;
  const lines = masterText.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    if (!lines[i].startsWith("#EXT-X-STREAM-INF")) continue;
    const uri = lines.slice(i + 1).find((l) => l.trim() && !l.startsWith("#"));
    if (uri) return new URL(uri.trim(), masterUrl).toString();
  }
  return null;
}

/** Duración de la ventana DVR (segundos) o null si no se pudo leer. */
export async function probeDvrDuration(dvrManifestUrl: string, fetchFn: typeof fetch = fetch): Promise<number | null> {
  try {
    const master = await fetchFn(dvrManifestUrl);
    if (!master.ok) return null;
    const masterText = await master.text();
    const variant = firstVariantUrl(masterText, dvrManifestUrl);
    const mediaText = variant ? await fetchFn(variant).then((r) => (r.ok ? r.text() : "")) : masterText;
    const duration = playlistDuration(mediaText);
    return duration > 0 ? duration : null;
  } catch {
    return null;
  }
}
