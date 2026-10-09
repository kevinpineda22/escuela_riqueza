import { useEffect, useState } from "react";
import { Radio, RotateCcw, Volume2, VolumeX, VideoOff } from "lucide-react";
import LiveHLSPlayer from "@/components/feature/LiveHLSPlayer";
import { CF_CUSTOMER_CODE } from "@/components/feature/live-room/constants";

/** Sin imagen pasado este tiempo con OBS conectado, se avisa al admin. */
const NO_VIDEO_TIMEOUT_MS = 20_000;

interface AdminLiveVideoPreviewProps {
  liveInputId: string | null;
  /** Resultado del sondeo que ya hace AdminLiveManager (no se vuelve a sondear acá). */
  obsConnected: boolean;
}

/**
 * Vista previa del en vivo para el admin. Sin señal de OBS NO monta el player
 * (no descarga nada); con señal lo monta SIEMPRE en silencio: el admin suele
 * emitir con micrófono desde el mismo equipo y el audio de la vista previa
 * (~8 s de retraso) volvería a entrar por el micrófono como eco.
 */
export function AdminLiveVideoPreview({ liveInputId, obsConnected }: AdminLiveVideoPreviewProps) {
  if (!obsConnected || !liveInputId) {
    return (
      <div className="flex aspect-video w-full flex-col items-center justify-center gap-2 rounded-xl border border-line-subtle bg-black/60 px-4 text-center">
        <Radio size={28} className="text-fg-30" />
        <p className="text-sm font-semibold text-fg-70">Esperando señal de OBS</p>
        <p className="text-xs text-fg-50">La vista previa aparece sola cuando OBS empieza a transmitir.</p>
      </div>
    );
  }
  return <ConnectedPreview liveInputId={liveInputId} />;
}

type PreviewFailure = "timeout" | "fatal" | null;

// El estado vive acá (no en el padre) a propósito: al perderse la señal este
// componente se desmonta y todo vuelve al inicio — en silencio otra vez.
function ConnectedPreview({ liveInputId }: { liveInputId: string }) {
  const [muted, setMuted] = useState(true);
  const [playing, setPlaying] = useState(false);
  const [failure, setFailure] = useState<PreviewFailure>(null);
  // Cambiarlo remonta el player (nuevo Hls, contadores de reintento en cero).
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (playing) return;
    const timer = window.setTimeout(() => setFailure((current) => current ?? "timeout"), NO_VIDEO_TIMEOUT_MS);
    return () => window.clearTimeout(timer);
  }, [playing, attempt]);

  const retry = () => {
    setFailure(null);
    setPlaying(false);
    setAttempt((current) => current + 1);
  };

  return (
    <div className="space-y-2">
      <div className="relative aspect-video w-full overflow-hidden rounded-xl bg-black">
        <LiveHLSPlayer
          key={attempt}
          liveInputId={liveInputId}
          customerCode={CF_CUSTOMER_CODE}
          muted={muted}
          autoPlay
          latencyMode="smooth"
          className="h-full w-full bg-black object-contain"
          onPlaying={() => {
            setPlaying(true);
            // Si el aviso era solo por tardar, ya llegó la imagen.
            setFailure((current) => (current === "timeout" ? null : current));
          }}
          onFatalError={() => setFailure("fatal")}
          onRecovered={() => setFailure(null)}
        />
      </div>

      {failure && (
        <div role="alert" className="flex flex-col gap-2 rounded-xl border border-red-500/30 bg-red-500/10 p-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="flex items-start gap-2 text-xs text-danger">
            <VideoOff size={14} className="mt-0.5 shrink-0" />
            OBS está conectado pero el video no llega. Revisa la configuración de OBS (keyframe 2 s, CBR 6000 kbps).
          </p>
          <button
            type="button"
            onClick={retry}
            className="flex shrink-0 items-center justify-center gap-1.5 rounded-lg border border-line-subtle bg-ink/5 px-3 py-1.5 text-xs font-bold text-foreground-strong transition-colors hover:bg-ink/10"
          >
            <RotateCcw size={13} /> Reintentar
          </button>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <button
          type="button"
          onClick={() => setMuted((current) => !current)}
          aria-pressed={!muted}
          className="flex items-center gap-1.5 rounded-lg border border-line-subtle bg-ink/5 px-3 py-1.5 text-xs font-bold text-foreground-strong transition-colors hover:bg-ink/10"
        >
          {muted ? <VolumeX size={13} /> : <Volume2 size={13} />}
          {muted ? "Activar audio" : "Silenciar"}
        </button>
        {muted ? (
          <span className="text-[11px] text-fg-50">Vista previa en silencio</span>
        ) : (
          <span role="note" className="text-[11px] text-yellow-500/80 light:text-warning">
            Si transmites desde este equipo, usa audífonos: el audio del preview puede colarse en el micrófono.
          </span>
        )}
      </div>
    </div>
  );
}
