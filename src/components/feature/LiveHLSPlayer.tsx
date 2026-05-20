import { useEffect, useRef, forwardRef, useImperativeHandle, useState } from "react";
import Hls from "hls.js";

export interface QualityLevel {
  index: number;
  height: number;
  bitrate: number;
  label: string;
}

export interface LiveHLSPlayerHandle {
  video: HTMLVideoElement | null;
  enterFullscreen: () => Promise<void>;
  exitFullscreen: () => Promise<void>;
  setQualityLevel: (index: number) => void;
  getQualityLevels: () => QualityLevel[];
}

interface LiveHLSPlayerProps {
  liveInputId: string;
  customerCode: string;
  muted: boolean;
  autoPlay?: boolean;
  className?: string;
  onPlay?: () => void;
  onPause?: () => void;
  onWaiting?: () => void;
  onPlaying?: () => void;
  onError?: (err: string) => void;
  onLevelsChange?: (levels: QualityLevel[], currentLevel: number) => void;
}

const LiveHLSPlayer = forwardRef<LiveHLSPlayerHandle, LiveHLSPlayerProps>(
  function LiveHLSPlayer(
    {
      liveInputId,
      customerCode,
      muted,
      autoPlay = true,
      className,
      onPlay,
      onPause,
      onWaiting,
      onPlaying,
      onError,
      onLevelsChange,
    },
    ref,
  ) {
    const videoRef = useRef<HTMLVideoElement>(null);
    const hlsRef = useRef<Hls | null>(null);
    const [levels, setLevels] = useState<QualityLevel[]>([]);

    useImperativeHandle(ref, () => ({
      video: videoRef.current,
      enterFullscreen: async () => {
        const v = videoRef.current;
        if (!v) return;
        // iOS Safari: solo el <video> element soporta fullscreen, vía webkitEnterFullscreen
        const iosFs = (v as unknown as { webkitEnterFullscreen?: () => void }).webkitEnterFullscreen;
        if (typeof iosFs === "function") {
          iosFs.call(v);
          return;
        }
        // Resto: fullscreen estándar sobre el wrapper si existe, sino sobre el video
        const target = v.parentElement || v;
        const req =
          target.requestFullscreen ||
          (target as unknown as { webkitRequestFullscreen?: () => Promise<void> }).webkitRequestFullscreen;
        if (req) {
          await req.call(target);
        }
      },
      exitFullscreen: async () => {
        const exit =
          document.exitFullscreen ||
          (document as unknown as { webkitExitFullscreen?: () => Promise<void> }).webkitExitFullscreen;
        if (exit) await exit.call(document);
      },
      setQualityLevel: (index: number) => {
        if (hlsRef.current) {
          hlsRef.current.currentLevel = index;
        }
      },
      getQualityLevels: () => levels,
    }));

    useEffect(() => {
      const video = videoRef.current;
      if (!video || !liveInputId || !customerCode) return;

      const manifestUrl = `https://customer-${customerCode}.cloudflarestream.com/${liveInputId}/manifest/video.m3u8`;

      let hls: Hls | null = null;
      let mediaErrorRetries = 0;

      if (Hls.isSupported()) {
        hls = new Hls({
          enableWorker: true,
          lowLatencyMode: true,
          backBufferLength: 30,
          maxBufferLength: 30,
          maxMaxBufferLength: 60,
          liveSyncDuration: 4,
          liveMaxLatencyDuration: 10,
          liveDurationInfinity: true,
          startLevel: -1,
        });
        hlsRef.current = hls;

        hls.loadSource(manifestUrl);
        hls.attachMedia(video);

        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          if (autoPlay) {
            video.play().catch(() => {
              // Autoplay con sonido bloqueado por el browser — el overlay "Activar sonido" lo resuelve
            });
          }
          const parsed: QualityLevel[] = hls!.levels.map((lvl, i) => ({
            index: i,
            height: lvl.height || 0,
            bitrate: lvl.bitrate || 0,
            label: lvl.height ? `${lvl.height}p` : `${Math.round((lvl.bitrate || 0) / 1000)} kbps`,
          }));
          setLevels(parsed);
          onLevelsChange?.(parsed, hls!.currentLevel);
        });

        hls.on(Hls.Events.LEVEL_SWITCHED, (_, data) => {
          onLevelsChange?.(levels, data.level);
        });

        hls.on(Hls.Events.ERROR, (_, data) => {
          if (!data.fatal) return;
          if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
            console.warn("[LiveHLSPlayer] network error, recovering...", data.details);
            hls!.startLoad();
          } else if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
            mediaErrorRetries++;
            if (mediaErrorRetries > 2) {
              console.error("[LiveHLSPlayer] media error, unrecoverable", data.details);
              onError?.(`Error de reproducción: ${data.details}`);
              return;
            }
            console.warn("[LiveHLSPlayer] media error, recovering...", data.details);
            hls!.recoverMediaError();
          } else {
            console.error("[LiveHLSPlayer] fatal error", data);
            onError?.(`Error: ${data.details}`);
          }
        });
      } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
        // iOS Safari y desktop Safari: HLS nativo (no necesita hls.js)
        video.src = manifestUrl;
        if (autoPlay) {
          video.addEventListener(
            "loadedmetadata",
            () => {
              video.play().catch(() => {});
            },
            { once: true },
          );
        }
      } else {
        onError?.("HLS no soportado en este navegador");
      }

      return () => {
        if (hls) {
          hls.destroy();
          hlsRef.current = null;
        }
      };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [liveInputId, customerCode]);

    return (
      <video
        ref={videoRef}
        muted={muted}
        playsInline
        autoPlay={autoPlay}
        preload="auto"
        className={className}
        onPlay={onPlay}
        onPause={onPause}
        onWaiting={onWaiting}
        onPlaying={onPlaying}
      />
    );
  },
);

export default LiveHLSPlayer;
