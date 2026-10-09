import { useEffect, useState } from "react";
import { Radio, RotateCcw, VideoOff } from "lucide-react";
import LiveHLSPlayer, { type LiveLatencyMode } from "@/components/feature/LiveHLSPlayer";
import { CF_CUSTOMER_CODE } from "@/components/feature/live-room/constants";
import { PausedOverlay, PeekBadge } from "./PreviewPauseLayer";

/** Sin imagen pasado este tiempo con OBS conectado, se avisa al admin. */
const NO_VIDEO_TIMEOUT_MS = 20_000;

interface AdminLiveVideoPreviewProps {
  liveInputId: string | null;
  /** Si se monta el player: OBS conectado o sala en vivo (el sondeo puede estar apagado). */
  enabled: boolean;
  /** El audio lo controla el panel: arranca siempre en silencio. */
  muted: boolean;
  /** La sala está en pausa para los alumnos (`lives.is_paused`). */
  roomPaused: boolean;
  /** Modo con el que se reproduce, para revisar lo que ve un alumno en cada uno. */
  latencyMode: LiveLatencyMode;
}

/**
 * Vista previa del en vivo para el admin. Si no corresponde mostrarla NO monta
 * el player (no descarga nada). El panel la deja en silencio por defecto: el
 * admin suele emitir con micrófono desde el mismo equipo y el audio de la vista
 * previa (~8 s de retraso) volvería a entrar por el micrófono como eco.
 */
export function AdminLiveVideoPreview({ liveInputId, enabled, muted, roomPaused, latencyMode }: AdminLiveVideoPreviewProps) {
  if (!enabled || !liveInputId) {
    return (
      <div className="flex aspect-video w-full flex-col items-center justify-center gap-2 rounded-xl border border-line-subtle bg-black/60 px-4 text-center">
        <Radio size={28} className="text-fg-30" />
        <p className="text-sm font-semibold text-fg-70">Esperando señal de OBS</p>
        <p className="text-xs text-fg-50">La vista previa aparece sola cuando OBS empieza a transmitir.</p>
      </div>
    );
  }
  return <ConnectedPreview liveInputId={liveInputId} muted={muted} roomPaused={roomPaused} latencyMode={latencyMode} />;
}

type PreviewFailure = "timeout" | "fatal" | null;

// El estado de reproducción vive acá: al desmontarse el player todo vuelve al inicio.
interface ConnectedPreviewProps {
  liveInputId: string;
  muted: boolean;
  roomPaused: boolean;
  latencyMode: LiveLatencyMode;
}

function ConnectedPreview({ liveInputId, muted, roomPaused, latencyMode }: ConnectedPreviewProps) {
  const [playing, setPlaying] = useState(false);
  const [failure, setFailure] = useState<PreviewFailure>(null);
  // Cambiarlo remonta el player (nuevo Hls, contadores de reintento en cero).
  const [attempt, setAttempt] = useState(0);
  // "Ver señal de OBS": solo la vista previa deja de estar en pausa. Se
  // descarta sola cuando la sala se reanuda o se vuelve a pausar.
  const [peek, setPeek] = useState(false);
  const [lastRoomPaused, setLastRoomPaused] = useState(roomPaused);
  if (lastRoomPaused !== roomPaused) {
    setLastRoomPaused(roomPaused);
    setPeek(false);
  }
  const previewPaused = roomPaused && !peek;

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
          roomPaused={previewPaused}
          // Cambiar de modo reinicializa el Hls dentro del player (igual que en la
          // sala del alumno). Sin `resumeKey`: en "dvr" no guarda `live-position:*`,
          // que pisaría la posición del alumno en este mismo navegador.
          latencyMode={latencyMode}
          className="h-full w-full bg-black object-contain"
          onPlaying={() => {
            setPlaying(true);
            // Si el aviso era solo por tardar, ya llegó la imagen.
            setFailure((current) => (current === "timeout" ? null : current));
          }}
          onFatalError={() => setFailure("fatal")}
          onRecovered={() => setFailure(null)}
        />
        {previewPaused && <PausedOverlay onPeek={() => setPeek(true)} />}
        {roomPaused && peek && <PeekBadge onBack={() => setPeek(false)} />}
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
    </div>
  );
}
