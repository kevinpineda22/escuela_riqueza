import type { LiveEvent } from "@/lib/api/stream/lives";

/**
 * Aviso antes de reactivar una sala que ya tiene grabación. Reactivar no la
 * desvincula, y el webhook nunca pisa una grabación existente ni toca salas
 * archivadas: la grabación de la clase nueva no se vincularía sola
 * (incidente 2026-10-31). `null` = no hay nada que avisar.
 */
export function reactivateWarning(
  live: Pick<LiveEvent, "recording_stream_uid" | "recording_r2_key">,
): string | null {
  if (!live.recording_stream_uid && !live.recording_r2_key) return null;
  return (
    "Esta sala ya tiene la grabación de su clase anterior. Si la reactivas para una clase nueva, " +
    "la grabación nueva NO se vinculará sola: tendrás que elegirla a mano al finalizar.\n\n" +
    "Para una clase nueva es mejor crear una sala nueva. ¿Reactivar de todos modos?"
  );
}
