import { Calendar, PauseCircle, PlayCircle, StopCircle, Volume2, VolumeX } from "lucide-react";
import { cn } from "@/lib/utils";
import type { LiveLatencyMode } from "@/components/feature/LiveHLSPlayer";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { ViewerInfo } from "@/types/live";
import { BroadcastViewers } from "./BroadcastViewers";

export type BroadcastPhase = "live" | "paused" | "scheduled";

interface BroadcastControlsProps {
  phase: BroadcastPhase;
  obsConnected: boolean;
  /** El sondeo de OBS está apagado (DEV o errores repetidos): no hay dato fiable. */
  obsUnavailable: boolean;
  startsAt: string | null;
  isSaving: boolean;
  /** Solo hay audio que controlar si el player está montado. */
  showAudio: boolean;
  muted: boolean;
  /** Presencia del en vivo: solo registrados en `viewers`, todos en `totalViewers`. */
  viewers: ViewerInfo[];
  totalViewers: number;
  /** Modo de latencia de la vista previa (estado local del panel, no la preferencia del alumno). */
  latencyMode: LiveLatencyMode;
  onLatencyModeChange: (mode: LiveLatencyMode) => void;
  onToggleMuted: () => void;
  onStart: () => void;
  onPause: () => void;
  onResume: () => void;
  onFinalize: () => void;
}

const PILL: Record<BroadcastPhase, { label: string; className: string }> = {
  live: { label: "EN VIVO", className: "border-red-500/50 bg-red-500/20 text-red-500 light:text-danger animate-pulse" },
  paused: { label: "EN PAUSA", className: "border-yellow-500/50 bg-yellow-500/20 text-yellow-500 light:text-warning" },
  scheduled: { label: "PROGRAMADO", className: "border-line-subtle bg-ink/5 text-foreground-muted" },
};

const SECONDARY_BUTTON =
  "flex items-center gap-1.5 rounded-lg border border-line-subtle bg-ink/5 px-3 py-1.5 text-xs font-bold text-foreground-strong transition-colors hover:bg-ink/10";
const ACTION_BUTTON =
  "flex flex-1 items-center justify-center gap-2 whitespace-nowrap rounded-xl px-4 py-2.5 text-sm font-bold transition-colors disabled:opacity-60 sm:flex-none";

const LATENCY_OPTIONS: { value: LiveLatencyMode; label: string }[] = [
  { value: "smooth", label: "Fluidez" },
  { value: "low", label: "Baja latencia" },
  { value: "dvr", label: "Clase completa" },
];

function obsLabel(obsConnected: boolean, obsUnavailable: boolean): string {
  if (obsConnected) return "OBS conectado";
  return obsUnavailable ? "Estado de OBS no disponible" : "OBS sin señal";
}

/** Barra de control del panel de transmisión: estado, OBS, audio y acciones. */
export function BroadcastControls(props: BroadcastControlsProps) {
  const { phase, obsConnected, obsUnavailable, startsAt, isSaving, showAudio, muted } = props;
  const pill = PILL[phase];

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <span className={cn("rounded-full border px-2.5 py-0.5 text-[11px] font-bold uppercase", pill.className)}>{pill.label}</span>
        <span className="flex items-center gap-1.5 text-xs text-foreground-muted">
          <span
            aria-hidden="true"
            className={cn("size-2 rounded-full", obsConnected ? "bg-green-500" : obsUnavailable ? "bg-fg-30" : "bg-red-500")}
          />
          {obsLabel(obsConnected, obsUnavailable)}
        </span>
        {phase === "scheduled" && startsAt && (
          <span className="flex items-center gap-1 text-xs text-accent">
            <Calendar size={12} /> Programado: {new Date(startsAt).toLocaleString("es-CO")}
          </span>
        )}
        {(phase !== "scheduled" || showAudio) && (
          <div className="flex items-center gap-2 sm:ml-auto">
            {phase !== "scheduled" && <BroadcastViewers viewers={props.viewers} totalViewers={props.totalViewers} />}
            {showAudio && (
              <Select value={props.latencyMode} onValueChange={(value) => props.onLatencyModeChange(value as LiveLatencyMode)}>
                <SelectTrigger
                  aria-label="Modo de latencia de la vista previa"
                  title="Así lo ve un alumno con este modo."
                  className="h-auto w-auto gap-1.5 rounded-lg bg-ink/5 px-3 py-1.5 text-xs font-bold text-foreground-strong"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {LATENCY_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            {showAudio && (
              <button type="button" onClick={props.onToggleMuted} aria-pressed={!muted} className={SECONDARY_BUTTON}>
                {muted ? <VolumeX size={13} /> : <Volume2 size={13} />}
                {muted ? "Activar audio" : "Silenciar"}
              </button>
            )}
          </div>
        )}
      </div>

      {showAudio && (
        <p className="text-[11px] text-foreground-muted">Así lo ve un alumno con este modo.</p>
      )}

      {showAudio && !muted && (
        <p role="note" className="text-[11px] text-yellow-500/80 light:text-warning">
          Si transmites desde este equipo, usa audífonos: el audio del preview puede colarse en el micrófono.
        </p>
      )}

      {phase === "scheduled" ? (
        <button
          type="button"
          onClick={props.onStart}
          disabled={isSaving}
          className={cn(ACTION_BUTTON, "w-full bg-red-600 text-white shadow-lg shadow-red-900/50 hover:bg-red-700 sm:w-auto")}
        >
          <PlayCircle size={18} /> {obsConnected ? "Iniciar Transmisión" : "Forzar EN VIVO"}
        </button>
      ) : (
        <div className="flex flex-col gap-2 sm:flex-row">
          {phase === "live" ? (
            <button
              type="button"
              onClick={props.onPause}
              disabled={isSaving}
              title="Los alumnos ven 'Transmisión en pausa'. OBS sigue emitiendo."
              className={cn(ACTION_BUTTON, "bg-yellow-600 text-white hover:bg-yellow-700")}
            >
              <PauseCircle size={18} /> Pausar
            </button>
          ) : (
            <button
              type="button"
              onClick={props.onResume}
              disabled={isSaving}
              className={cn(ACTION_BUTTON, "bg-yellow-600 text-white hover:bg-yellow-700")}
            >
              <PlayCircle size={18} /> Reanudar
            </button>
          )}
          <button
            type="button"
            onClick={props.onFinalize}
            title="Cierra la clase para los alumnos y la pasa a Finalizados."
            className={cn(ACTION_BUTTON, "border border-red-800/30 bg-red-800/50 text-danger hover:bg-red-800 light:bg-red-700 light:text-white light:hover:bg-red-800")}
          >
            <StopCircle size={18} /> Finalizar clase
          </button>
        </div>
      )}
    </div>
  );
}
