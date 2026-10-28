/**
 * Pantalla de bloqueo y centro de control (Media Session API): imagen, título
 * y botones, como Spotify o YouTube. Lo comparten el podcast y el vivo.
 */
export const SCHOOL_LOGO_URL =
  "https://imagedelivery.net/HGkLNfdVjFNAti8ZHHgxtQ/18dc9190-6625-4b89-8f1e-3f221e96b500/public";

const LOGO_SIZES = ["96x96", "192x192", "256x256", "384x384", "512x512"];

export function hasMediaSession(): boolean {
  return typeof navigator !== "undefined" && "mediaSession" in navigator && typeof MediaMetadata !== "undefined";
}

/**
 * Imagen para la pantalla de bloqueo. La portada de la clase va primero; el
 * logo queda de respaldo. Sin `sizes` en la portada: no se sabe su tamaño y el
 * sistema la recorta al cuadrado.
 */
export function mediaArtwork(coverUrl?: string | null): MediaImage[] {
  const logo = LOGO_SIZES.map((sizes) => ({ src: SCHOOL_LOGO_URL, sizes, type: "image/png" }));
  return coverUrl ? [{ src: coverUrl }, ...logo] : logo;
}
