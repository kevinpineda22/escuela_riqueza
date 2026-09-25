import type { LiveEvent } from "@/lib/api/stream/lives";

export interface LiveRoomStatus {
  isLive: boolean;
  isEnded: boolean;
  isPaused: boolean;
  /** El player se monta: la sala está `live` o ya hay señal de OBS. */
  showPlayer: boolean;
}

/**
 * Estado visible de la sala, común a la sala VIP y a la pública.
 * `signalConnected` es la señal de OBS que consulta la sala VIP (Cloudflare);
 * la pública no la tiene y pasa `false`.
 */
export function getLiveRoomStatus(live: LiveEvent, signalConnected: boolean): LiveRoomStatus {
  const isEnded = live.status === "ended";
  const isPaused = live.is_paused === true;
  return {
    isLive: live.status === "live" && !isPaused,
    isEnded,
    isPaused,
    // H7: el player sigue montado mientras la sala esté "live", pausada o no —
    // desmontarlo en cada micro-pausa de OBS perdía buffer, volumen y audio.
    // F33: una sala finalizada muestra el cierre aunque OBS siga conectado.
    showPlayer: !isEnded && (live.status === "live" || signalConnected),
  };
}
