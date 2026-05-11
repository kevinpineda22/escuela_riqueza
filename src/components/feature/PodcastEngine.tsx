/**
 * PodcastEngine — Motor de audio del modo podcast.
 *
 * Diseñado para montarse en la raíz del árbol React (main.tsx) y NUNCA
 * desmontarse hasta que el usuario recargue la página.
 *
 * Principio clave: una vez que el engine se activa (track ≠ null por
 * primera vez), el contenedor y el iframe de Cloudflare Stream se
 * mantienen montados para SIEMPRE. Cerrar el podcast (closePlayer)
 * solo limpia el src del iframe, no lo destruye.
 *
 * Esto garantiza que ninguna navegación SPA, flash de auth o
 * re-render de providers interrumpa el audio.
 */
import { useEffect, useRef, useState } from "react";
import { Stream } from "@cloudflare/stream-react";
import { usePlayerStore } from "@/stores/player.store";

// Ref global para que LessonPlayer y GlobalPodcastPlayer puedan
// leer currentTime / duration sin necesitar su propio iframe.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export let podcastStreamRef: { current: any } = { current: null };

const CONTAINER_STYLE: React.CSSProperties = {
  position: "fixed",
  // 320×180 — dimensiones reales para que el browser NO clasifique
  // el iframe como "background element" y lo suspenda (Chromium).
  width: 320,
  height: 180,
  top: 0,
  left: 0,
  // opacity 0.01 (no 0) evita que Chromium lo considere invisible
  opacity: 0.01,
  pointerEvents: "none",
  zIndex: -9999,
  // Lo desplazamos fuera del viewport manteniendo sus dimensiones reales
  transform: "translateX(-9999px)",
  overflow: "hidden",
};

const PodcastEngine = () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const internalRef = useRef<any>(null);

  // Refs sincronizadas con el store para evitar stale closures
  const isPlayingRef = useRef(false);
  const isPodcastModeRef = useRef(false);
  const initializedRef = useRef(false);

  // Una vez que el engine se activa (primer track), NUNCA se desactiva.
  // El Stream se monta y no se desmonta jamás.
  const [everActivated, setEverActivated] = useState(false);

  const {
    track,
    isPlaying,
    isPodcastMode,
    volume,
    lastKnownTime,
    lastVideoId,
    setIsPlaying,
    setPlaybackProgress,
  } = usePlayerStore();

  // Mantener refs sincronizadas
  useEffect(() => { isPlayingRef.current = isPlaying; }, [isPlaying]);
  useEffect(() => { isPodcastModeRef.current = isPodcastMode; }, [isPodcastMode]);

  // Sincronizar ref global
  useEffect(() => {
    podcastStreamRef = internalRef;
  }, []);

  // Activar el engine permanentemente al primer track
  useEffect(() => {
    if (track && !everActivated) {
      setEverActivated(true);
    }
  }, [track, everActivated]);

  // Sincronizar volumen
  useEffect(() => {
    if (internalRef.current) {
      internalRef.current.volume = volume;
    }
  }, [volume]);

  // Sincronizar play / pause
  useEffect(() => {
    if (!internalRef.current || !isPodcastMode || !track) return;
    if (isPlaying) {
      setTimeout(() => {
        internalRef.current?.play().catch(() => {});
      }, 50);
    } else {
      internalRef.current?.pause();
    }
  }, [isPlaying, isPodcastMode, track]);

  // Resetear posición cuando cambia el track
  useEffect(() => {
    initializedRef.current = false;
  }, [track?.videoId]);

  // ── Watchdog ─────────────────────────────────────────────────────────────
  // Cada 1s verifica si el audio debería estar sonando pero está pausado.
  // El navegador puede suspender iframes sin evento "pause" (especialmente
  // en navegación SPA). Este watchdog asegura que se retome en ≤1s.
  useEffect(() => {
    const id = setInterval(() => {
      const el = internalRef.current;
      if (!el || !isPlayingRef.current || !isPodcastModeRef.current) return;
      if (el.paused) {
        el.play().catch(() => {});
      }
    }, 1000);
    return () => clearInterval(id);
  }, []);

  // visibilitychange: reanudar al volver a la pestaña
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === "visible" && isPlayingRef.current && isPodcastModeRef.current) {
        setTimeout(() => {
          internalRef.current?.play().catch(() => {});
        }, 200);
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, []);

  // ── Handlers del Stream ──────────────────────────────────────────────────

  const handleCanPlay = () => {
    if (!initializedRef.current && internalRef.current && track) {
      if (lastVideoId === track.videoId && lastKnownTime > 0) {
        internalRef.current.currentTime = lastKnownTime;
      }
      initializedRef.current = true;
    }
    if (isPlayingRef.current && isPodcastModeRef.current) {
      internalRef.current?.play().catch(() => {});
    }
  };

  const handleTimeUpdate = () => {
    if (!internalRef.current || !track) return;
    setPlaybackProgress(track.videoId, internalRef.current.currentTime);
  };

  const handlePause = () => {
    if (isPlayingRef.current && isPodcastModeRef.current) {
      setTimeout(() => {
        internalRef.current?.play().catch(() => {});
      }, 200);
    }
  };

  const handleEnded = () => setIsPlaying(false);

  // ── Render ───────────────────────────────────────────────────────────────

  // Mientras no se haya activado nunca, no renderizar nada (no hay necesidad)
  if (!everActivated) return null;

  return (
    <div aria-hidden="true" style={CONTAINER_STYLE}>
      {track && (
        <Stream
          streamRef={internalRef}
          src={track.videoId}
          controls={false}
          preload="auto"
          onCanPlay={handleCanPlay}
          onTimeUpdate={handleTimeUpdate}
          onPause={handlePause}
          onEnded={handleEnded}
        />
      )}
    </div>
  );
};

export default PodcastEngine;
