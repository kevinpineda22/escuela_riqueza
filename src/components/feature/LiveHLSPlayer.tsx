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

        // iOS Safari: el único path posible es webkitEnterFullscreen sobre el <video>.
        // El iframe/wrapper NO soporta requestFullscreen en iOS Safari < 17.
        const iosFs = (v as unknown as { webkitEnterFullscreen?: () => void }).webkitEnterFullscreen;
        if (typeof iosFs === "function") {
          try { iosFs.call(v); return; } catch (e) { console.warn("[LiveHLSPlayer] iOS fs failed", e); }
        }

        // Defensivo: probar wrapper → video, con todos los prefijos legacy.
        const wrapper = v.parentElement;
        const candidates: Array<{ el: Element; methods: string[] }> = [];
        if (wrapper) candidates.push({ el: wrapper, methods: ["requestFullscreen", "webkitRequestFullscreen", "mozRequestFullScreen", "msRequestFullscreen"] });
        candidates.push({ el: v, methods: ["requestFullscreen", "webkitRequestFullscreen", "mozRequestFullScreen", "msRequestFullscreen"] });

        for (const { el, methods } of candidates) {
          for (const m of methods) {
            const fn = (el as unknown as Record<string, unknown>)[m];
            if (typeof fn === "function") {
              try { await (fn as () => Promise<void>).call(el); return; }
              catch (e) { console.warn(`[LiveHLSPlayer] ${m} failed`, e); }
            }
          }
        }

        console.warn("[LiveHLSPlayer] No fullscreen API available");
      },
      exitFullscreen: async () => {
        const exits = ["exitFullscreen", "webkitExitFullscreen", "mozCancelFullScreen", "msExitFullscreen"];
        for (const m of exits) {
          const fn = (document as unknown as Record<string, unknown>)[m];
          if (typeof fn === "function") {
            try { await (fn as () => Promise<void>).call(document); return; }
            catch (e) { console.warn(`[LiveHLSPlayer] ${m} failed`, e); }
          }
        }
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

      // Perfil "fluidez primero" — HLS clásico (targetduration ~3s), sin
      // low-latency parts. Entramos a ~8s del live edge con buffer gordo
      // para absorber jitter de red, microcortes de OBS y reencodes lentos.
      // Latencia resultante ≈ 6-10s, equivalente a Twitch/YouTube sin LL.
      const manifestUrl = `https://customer-${customerCode}.cloudflarestream.com/${liveInputId}/manifest/video.m3u8`;

      let hls: Hls | null = null;
      let mediaErrorRetries = 0;

      if (Hls.isSupported()) {
        hls = new Hls({
          enableWorker: true,
          lowLatencyMode: false,
          backBufferLength: 10,
          maxBufferLength: 20,
          maxMaxBufferLength: 40,
          liveSyncDuration: 8,
          liveMaxLatencyDuration: 20,
          liveDurationInfinity: true,
          startLevel: -1,
          maxLiveSyncPlaybackRate: 1.0,
          abrBandWidthFactor: 0.8,
          abrBandWidthUpFactor: 0.7,
        });
        hlsRef.current = hls;

        hls.loadSource(manifestUrl);
        hls.attachMedia(video);

        // Mapea hls.levels[] a QualityLevel[]. Helper para reusar tanto en
        // MANIFEST_PARSED como en LEVEL_SWITCHED — éste último necesita recomputar
        // y NO leer del state React, porque la closure del useEffect captura el
        // `levels` inicial vacío (stale closure clásico).
        const computeLevels = (h: Hls): QualityLevel[] =>
          h.levels.map((lvl, i) => ({
            index: i,
            height: lvl.height || 0,
            bitrate: lvl.bitrate || 0,
            label: lvl.height ? `${lvl.height}p` : `${Math.round((lvl.bitrate || 0) / 1000)} kbps`,
          }));

        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          if (autoPlay) {
            video.play().catch(() => {
              // Autoplay con sonido bloqueado por el browser — el overlay "Activar sonido" lo resuelve
            });
          }
          const parsed = computeLevels(hls!);
          setLevels(parsed);
          onLevelsChange?.(parsed, hls!.currentLevel);
        });

        // Diagnóstico LL-HLS — TEMPORAL. Loggea una vez si el manifest expone los
        // tags de Low-Latency HLS. Si no, latencia se queda en 6-10s aunque el
        // cliente tenga lowLatencyMode: true.
        let llhlsLogged = false;
        hls.on(Hls.Events.LEVEL_LOADED, (_, data) => {
          if (llhlsLogged) return;
          llhlsLogged = true;
          const d = data.details;
          const isLLHLS = !!(d.partTarget || (d.partList && d.partList.length > 0));
          console.log("%c[LL-HLS Check]", "color:#CCA43B;font-weight:bold", {
            "✓ LL-HLS activo": isLLHLS ? "SÍ" : "NO",
            partTarget: d.partTarget,
            holdBack: d.holdBack,
            partHoldBack: d.partHoldBack,
            targetduration: d.targetduration,
            live: d.live,
            manifestUrl,
          });
        });

        hls.on(Hls.Events.LEVEL_SWITCHED, (_, data) => {
          if (!hlsRef.current) return;
          const parsed = computeLevels(hlsRef.current);
          onLevelsChange?.(parsed, data.level);
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
