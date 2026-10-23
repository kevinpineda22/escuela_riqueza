import { CF_CUSTOMER_HOST } from "@/components/feature/live-room/constants";
import { SIGNATURE_HEIGHT, SIGNATURE_WIDTH, frameStats, type FrameSample } from "@/lib/breakDetection";

/**
 * Alto único para TODAS las miniaturas (tira, lupa y detección). Cloudflare
 * genera cada combinación tiempo+tamaño la primera vez (~4,5 s, medido) y después
 * la sirve de caché: con un solo tamaño, lo que bajó la detección ya está listo
 * para la tira y viceversa.
 */
export const THUMB_HEIGHT = 108;

/** Las miniaturas se piden a múltiplos de este paso: así se reaprovechan. */
export const THUMB_GRID_SECONDS = 10;

export function snapToGrid(seconds: number): number {
  return Math.max(0, Math.round(seconds / THUMB_GRID_SECONDS) * THUMB_GRID_SECONDS);
}

export function thumbnailUrl(videoUid: string, seconds: number): string {
  return `https://${CF_CUSTOMER_HOST}/${videoUid}/thumbnails/thumbnail.jpg?time=${Math.round(seconds)}s&height=${THUMB_HEIGHT}`;
}

/**
 * Baja una miniatura y la reduce a la firma de 8×4 que usa la detección.
 * Cloudflare responde con CORS abierto (verificado 2026-10-23), así que el canvas
 * no queda "contaminado" y se pueden leer los píxeles. Ante cualquier falla, null.
 */
export function loadFrameSample(videoUid: string, seconds: number): Promise<FrameSample | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.decoding = "async";
    img.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = SIGNATURE_WIDTH;
        canvas.height = SIGNATURE_HEIGHT;
        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        if (!ctx) return resolve(null);
        ctx.drawImage(img, 0, 0, SIGNATURE_WIDTH, SIGNATURE_HEIGHT);
        const { luma, sig } = frameStats(ctx.getImageData(0, 0, SIGNATURE_WIDTH, SIGNATURE_HEIGHT).data);
        resolve({ time: seconds, luma, sig });
      } catch {
        resolve(null);
      }
    };
    img.onerror = () => resolve(null);
    img.src = thumbnailUrl(videoUid, seconds);
  });
}
