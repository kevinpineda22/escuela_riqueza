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

const LOGO_URL =
  "https://imagedelivery.net/HGkLNfdVjFNAti8ZHHgxtQ/18dc9190-6625-4b89-8f1e-3f221e96b500/public";

function setMediaMetadata(title: string, artist: string) {
  if (!("mediaSession" in navigator)) return;
  navigator.mediaSession.metadata = new MediaMetadata({
    title,
    artist,
    artwork: [{ src: LOGO_URL, sizes: "512x512", type: "image/png" }],
  });
}

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
  const userInteractedRef = useRef(false);
  const hijackerRef = useRef<HTMLAudioElement | null>(null);
  const mediaSessionIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Una vez que el engine se activa (primer track), NUNCA se desactiva.
  // El Stream se monta y no se desmonta jamǭs.
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
  
  const lastKnownTimeRef = useRef(lastKnownTime);
  useEffect(() => { lastKnownTimeRef.current = lastKnownTime; }, [lastKnownTime]);
  
  const lastVideoIdRef = useRef(lastVideoId);
  useEffect(() => { lastVideoIdRef.current = lastVideoId; }, [lastVideoId]);
  
  const trackRef = useRef(track);
  useEffect(() => { trackRef.current = track; }, [track]);

  // Sincronizar ref global
  useEffect(() => {
    podcastStreamRef = internalRef;
  }, []);

  // Activar el engine permanentemente
  useEffect(() => {
    setEverActivated(true);
  }, []);

  // Sincronizar volumen
  useEffect(() => {
    if (internalRef.current) {
      internalRef.current.volume = volume;
    }
  }, [volume]);

  // Sincronizar play / pause — sin timeout porque en móvil
  // el gesto del usuario se pierde si diferimos la llamada
  useEffect(() => {
    if (!internalRef.current || !isPodcastMode || !track) return;
    if (isPlaying) {
      internalRef.current?.play().catch(() => {});
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
          hijackerRef.current?.play().catch(() => {});
        }, 200);
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, []);

  // Unlock audio en móvil: la primera interacción del usuario con la página
  // crea un AudioContext que desbloquea la reproducción de audio para toda la sesión
  useEffect(() => {
    const unlock = () => {
      if (userInteractedRef.current) return;
      userInteractedRef.current = true;
      try {
        const ACtx = (window.AudioContext || (window as any).webkitAudioContext);
        if (ACtx) {
          const ctx = new ACtx();
          if (ctx.state === "suspended") ctx.resume();
          const src = ctx.createOscillator();
          src.connect(ctx.destination);
          src.start(0);
          src.stop(0.001);
          setTimeout(() => ctx.close(), 200);
        }
      } catch { /* not all browsers support Web Audio */ }
      document.removeEventListener("pointerdown", unlock);
      document.removeEventListener("touchstart", unlock);
    };
    document.addEventListener("pointerdown", unlock, { once: true });
    document.addEventListener("touchstart", unlock, { once: true });
    return () => {
      document.removeEventListener("pointerdown", unlock);
      document.removeEventListener("touchstart", unlock);
    };
  }, []);

  useEffect(() => {
    if (!track || !isPodcastMode || !("mediaSession" in navigator)) return;

    setMediaMetadata(track.title || "Lección", track.moduleTitle || "Escuela de la Riqueza");

    navigator.mediaSession.setActionHandler("play", () => setIsPlaying(true));
    navigator.mediaSession.setActionHandler("pause", () => setIsPlaying(false));
    navigator.mediaSession.setActionHandler("seekbackward", () => {
      if (internalRef.current) internalRef.current.currentTime = Math.max(0, internalRef.current.currentTime - 10);
    });
    navigator.mediaSession.setActionHandler("seekforward", () => {
      if (internalRef.current) internalRef.current.currentTime += 10;
    });
    navigator.mediaSession.setActionHandler("seekto", (details) => {
      if (details.seekTime && internalRef.current) internalRef.current.currentTime = details.seekTime;
    });

    return () => {
      navigator.mediaSession.metadata = null;
      navigator.mediaSession.setActionHandler("play", null);
      navigator.mediaSession.setActionHandler("pause", null);
      navigator.mediaSession.setActionHandler("seekbackward", null);
      navigator.mediaSession.setActionHandler("seekforward", null);
      navigator.mediaSession.setActionHandler("seekto", null);
    };
  }, [track, isPodcastMode, setIsPlaying]);

  // ── Secuestrador de MediaSession ─────────────────────────────────────────
  // Cada vez que cambia isPlaying, controlamos el audio silencioso
  useEffect(() => {
    const audioEl = hijackerRef.current;
    if (!audioEl) return;
    if (isPlaying && isPodcastMode) {
      audioEl.play().catch(() => {});
    } else {
      audioEl.pause();
    }
  }, [isPlaying, isPodcastMode]);

  // Intervalo periódico para re-afirmar el control del MediaSession.
  // iOS/Android pueden devolverle el control al iframe después de unos segundos;
  // este loop re-asserta nuestra metadata cada 5s.
  useEffect(() => {
    if (!isPlaying || !isPodcastMode || !track) {
      if (mediaSessionIntervalRef.current) {
        clearInterval(mediaSessionIntervalRef.current);
        mediaSessionIntervalRef.current = null;
      }
      return;
    }

    mediaSessionIntervalRef.current = setInterval(() => {
      const audioEl = hijackerRef.current;
      if (audioEl && track) {
        audioEl.play().catch(() => {});
        setMediaMetadata(track.title || "Lección", track.moduleTitle || "Escuela de la Riqueza");
      }
    }, 5000);

    return () => {
      if (mediaSessionIntervalRef.current) {
        clearInterval(mediaSessionIntervalRef.current);
        mediaSessionIntervalRef.current = null;
      }
    };
  }, [isPlaying, isPodcastMode, track]);

  // ── Handlers del Stream ──────────────────────────────────────────────────

  const handleCanPlay = () => {
    const currentTrack = trackRef.current;
    if (!initializedRef.current && internalRef.current && currentTrack) {
      if (lastVideoIdRef.current === currentTrack.videoId && lastKnownTimeRef.current > 0) {
        internalRef.current.currentTime = lastKnownTimeRef.current;
      }
      initializedRef.current = true;
    }
    if (isPlayingRef.current && isPodcastModeRef.current) {
      internalRef.current?.play().catch(() => {});
    }
  };

  const handlePlayEvent = () => {
    setTimeout(() => {
      const audioEl = hijackerRef.current;
      const currentTrack = trackRef.current;
      if (audioEl && currentTrack) {
        audioEl.play().catch(() => {});
        setMediaMetadata(currentTrack.title || "Lección en Audio", currentTrack.moduleTitle || "Escuela de la Riqueza");
      }
    }, 100);
  };

  const handleTimeUpdate = () => {
    // No guardar progreso hasta que onCanPlay haya hecho el seek inicial.
    // Si guardamos antes, el onTimeUpdate del iframe recién cargado
    // (currentTime ≈ 0) pisaría lastKnownTime y arruinaría la restauración.
    if (!initializedRef.current) return;
    const currentTrack = trackRef.current;
    if (!internalRef.current || !currentTrack) return;
    setPlaybackProgress(currentTrack.videoId, internalRef.current.currentTime);
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

  // Renderizamos el Stream SIEMPRE para que el iframe exista antes del primer clic.
  // Si no hay track, usamos un AD_VIDEO_ID de placeholder para que Cloudflare no falle,
  // pero lo mantenemos silenciado y en pausa.
  const streamSrc = track?.videoId || "02b22da00a68753980615a8df8f06e96";

  return (
    <div aria-hidden="true" style={CONTAINER_STYLE}>
      <Stream
        streamRef={internalRef}
        src={streamSrc}
        title={track?.title || "Escuela de la Riqueza"}
        poster="https://imagedelivery.net/HGkLNfdVjFNAti8ZHHgxtQ/18dc9190-6625-4b89-8f1e-3f221e96b500/public"
        controls={false}
        autoplay={false}
        preload="auto"
        muted={!track} // Muted si es el placeholder
        onCanPlay={handleCanPlay}
        onPlay={handlePlayEvent}
        onTimeUpdate={handleTimeUpdate}
        onPause={handlePause}
        onEnded={handleEnded}
      />
      {/* Audio silencioso para secuestrar el MediaSession del OS y sobrescribir el del iframe */}
      <audio
        ref={hijackerRef}
        src="data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA"
        loop
        playsInline
      />
    </div>
  );
};

export default PodcastEngine;
