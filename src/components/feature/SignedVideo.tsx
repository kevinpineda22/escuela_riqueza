import { useEffect, useRef, useState } from "react";
import type { SignedRecordingUrl } from "@/lib/api/stream/lives";

/** Si la URL vence en menos de este tiempo, un seek o una espera dispara la renovación. */
const EXPIRY_MARGIN_MS = 60_000;
/** Segundos seguidos sin avanzar (reproduciendo) antes de renovar la URL. */
const STALL_SECONDS = 8;
/** Renovaciones seguidas sin progreso real antes de rendirse y ofrecer «Reintentar». */
const MAX_REFRESHES_WITHOUT_PROGRESS = 3;
/** Segundos de reproducción tras una renovación que cuentan como progreso real. */
const PROGRESS_RESET_SECONDS = 5;

interface SignedVideoProps {
  /** URL ya obtenida por el reproductor (conserva sus estados de carga/error del primer pedido). */
  initial: SignedRecordingUrl;
  /** Pide una URL nueva; `null` = no se pudo. Se lee vía ref: no hace falta que sea estable. */
  getUrl: () => Promise<SignedRecordingUrl | null>;
  className?: string;
  autoPlay?: boolean;
  controls?: boolean;
  preload?: "none" | "metadata" | "auto";
}

interface PendingRestore {
  time: number;
  wasPlaying: boolean;
}

/**
 * <video> para URLs firmadas de vida corta (R2, 15 min). El navegador baja el MP4
 * con range requests; al vencer la URL cada pedido nuevo es rechazado y el video se
 * congela sin disparar `error`. Este componente renueva la URL antes (seek/espera
 * con la URL por vencer) o después (watchdog de 1 s, evento `error`) y retoma la
 * posición y el estado de reproducción.
 */
export function SignedVideo({ initial, getUrl, className, autoPlay, controls = true, preload }: SignedVideoProps) {
  const [src, setSrc] = useState(initial.url);
  const [generation, setGeneration] = useState(0);
  const [failed, setFailed] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const getUrlRef = useRef(getUrl);
  const expiresAtRef = useRef(0);
  const refreshingRef = useRef(false);
  const mountedRef = useRef(true);
  const retriesRef = useRef(0);
  const pendingRef = useRef<PendingRestore | null>(null);
  const progressBaseRef = useRef(0);
  const lastTimeRef = useRef(0);
  const stallSecondsRef = useRef(0);
  const refreshRef = useRef<() => void>(() => {});

  useEffect(() => {
    getUrlRef.current = getUrl;
  });

  useEffect(() => {
    mountedRef.current = true;
    expiresAtRef.current = Date.now() + initial.expiresIn * 1000;

    const refresh = () => {
      const video = videoRef.current;
      if (!video || refreshingRef.current) return;
      if (retriesRef.current >= MAX_REFRESHES_WITHOUT_PROGRESS) {
        setFailed(true);
        return;
      }
      retriesRef.current += 1;
      refreshingRef.current = true;
      stallSecondsRef.current = 0;
      const time = video.currentTime;
      const wasPlaying = !video.paused && !video.ended;

      const finish = (next: SignedRecordingUrl | null) => {
        refreshingRef.current = false;
        if (!mountedRef.current) return;
        stallSecondsRef.current = 0;
        if (!next) return; // el watchdog volverá a intentarlo (con tope)
        expiresAtRef.current = Date.now() + next.expiresIn * 1000;
        pendingRef.current = { time, wasPlaying };
        progressBaseRef.current = time;
        lastTimeRef.current = time;
        setGeneration((g) => g + 1);
        setSrc(next.url);
      };
      getUrlRef.current().then(finish, () => finish(null));
    };
    refreshRef.current = refresh;

    const timer = setInterval(() => {
      const video = videoRef.current;
      if (!video) return;
      if (video.paused || video.ended) {
        stallSecondsRef.current = 0;
        lastTimeRef.current = video.currentTime;
        return;
      }
      if (Math.abs(video.currentTime - lastTimeRef.current) > 0.01) {
        stallSecondsRef.current = 0;
        if (
          retriesRef.current > 0 &&
          video.currentTime - progressBaseRef.current >= PROGRESS_RESET_SECONDS
        ) {
          retriesRef.current = 0;
        }
        lastTimeRef.current = video.currentTime;
        return;
      }
      stallSecondsRef.current += 1;
      if (stallSecondsRef.current >= STALL_SECONDS) {
        stallSecondsRef.current = 0;
        refresh();
      }
    }, 1000);

    return () => {
      mountedRef.current = false;
      clearInterval(timer);
    };
  // `initial` solo fija el primer vencimiento; las renovaciones lo actualizan por ref.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const refreshIfExpiring = () => {
    if (expiresAtRef.current - Date.now() <= EXPIRY_MARGIN_MS) refreshRef.current();
  };

  const handleLoadedMetadata = () => {
    const video = videoRef.current;
    const pending = pendingRef.current;
    if (!video || !pending) return;
    pendingRef.current = null;
    if (pending.time > 0) video.currentTime = pending.time;
    if (pending.wasPlaying) {
      // play() puede rechazarse (autoplay bloqueado, src cambiado): el watchdog cubre el resto.
      Promise.resolve(video.play()).catch(() => {});
    }
  };

  const handleRetry = () => {
    retriesRef.current = 0;
    stallSecondsRef.current = 0;
    setFailed(false);
    refreshRef.current();
  };

  return (
    <div className="relative w-full h-full">
      <video
        ref={videoRef}
        src={src}
        controls={controls}
        // Tras una renovación no se reanuda sola: lo decide `handleLoadedMetadata`.
        autoPlay={autoPlay && generation === 0}
        preload={preload}
        className={className}
        onLoadedMetadata={handleLoadedMetadata}
        onSeeking={refreshIfExpiring}
        onWaiting={refreshIfExpiring}
        onStalled={refreshIfExpiring}
        onError={() => refreshRef.current()}
      />
      {failed && (
        <div
          role="alert"
          className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/80 text-center p-4"
        >
          <p className="text-sm text-foreground-muted">No se pudo continuar la reproducción.</p>
          <button
            type="button"
            onClick={handleRetry}
            className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-black"
          >
            Reintentar
          </button>
        </div>
      )}
    </div>
  );
}
