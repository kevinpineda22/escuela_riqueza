import { useEffect, useRef } from "react";
import { hasMediaSession, mediaArtwork } from "@/lib/media/mediaSession";

interface LiveMediaSessionOptions {
  /** Solo mientras hay player en pantalla: sin él no hay nada que controlar. */
  enabled: boolean;
  title: string;
  coverUrl?: string | null;
  isPlaying: boolean;
  onPlay: () => void;
  onPause: () => void;
}

/**
 * La clase en la pantalla de bloqueo y el centro de control, como Spotify:
 * portada, título y Play/Pausa. Es lo que se ve con el celular bloqueado en
 * Solo audio, y lo que permite reanudar sin desbloquear.
 *
 * Sin adelantar/atrasar ni pistas: en un vivo no hay "siguiente", y dejarlos
 * sin manejador hace que el sistema no los muestre.
 */
export function useLiveMediaSession({ enabled, title, coverUrl, isPlaying, onPlay, onPause }: LiveMediaSessionOptions) {
  const handlersRef = useRef({ onPlay, onPause });
  useEffect(() => {
    handlersRef.current = { onPlay, onPause };
  });

  useEffect(() => {
    if (!enabled || !hasMediaSession()) return;
    const session = navigator.mediaSession;
    // Se vuelve a escribir en cada cambio de Play/Pausa: el podcast, al
    // cerrarse cuando se entra a la sala, borra los datos de la sesión.
    session.metadata = new MediaMetadata({
      title,
      artist: "Escuela de la Riqueza",
      album: "En vivo",
      artwork: mediaArtwork(coverUrl),
    });
    session.playbackState = isPlaying ? "playing" : "paused";
    const setHandler = (action: MediaSessionAction, handler: MediaSessionActionHandler | null) => {
      try {
        session.setActionHandler(action, handler);
      } catch { /* acción no soportada por este navegador */ }
    };
    setHandler("play", () => handlersRef.current.onPlay());
    setHandler("pause", () => handlersRef.current.onPause());
    return () => {
      session.metadata = null;
      session.playbackState = "none";
      setHandler("play", null);
      setHandler("pause", null);
    };
  }, [enabled, title, coverUrl, isPlaying]);
}
