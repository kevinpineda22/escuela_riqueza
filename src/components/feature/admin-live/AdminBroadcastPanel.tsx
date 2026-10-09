import { useState } from "react";
import { ChevronDown, ExternalLink, Radio } from "lucide-react";
import { cn } from "@/lib/utils";
import type { LiveLatencyMode } from "@/components/feature/LiveHLSPlayer";
import LiveChat from "@/components/feature/LiveChat";
import type { LiveEvent } from "@/lib/api/stream/lives";
import { AdminLiveVideoPreview } from "./AdminLiveVideoPreview";
import { BroadcastControls, type BroadcastPhase } from "./BroadcastControls";
import { useLivePresence } from "@/components/feature/live-room/useLivePresence";
import { usePreviewCollapsed } from "./usePreviewCollapsed";

/** Ruta de la sala que ven los alumnos (src/routes.tsx). */
const STUDENT_ROOM_PATH = "/vip-live";

interface AdminBroadcastPanelProps {
  live: Pick<LiveEvent, "id" | "title" | "status" | "is_paused" | "starts_at" | "stream_live_input_id">;
  /** Estado de OBS del sondeo de AdminLiveManager. */
  obsConnected: boolean;
  /** El sondeo está apagado (DEV o errores repetidos): "sin señal" no sería fiable. */
  obsUnavailable: boolean;
  isSaving: boolean;
  onStart: () => void;
  onPause: () => void;
  onResume: () => void;
  onFinalize: () => void;
}

function phaseOf(live: AdminBroadcastPanelProps["live"]): BroadcastPhase {
  if (live.status !== "live") return "scheduled";
  return live.is_paused ? "paused" : "live";
}

/**
 * Panel de transmisión: vista previa, chat moderable y controles en un solo
 * lugar. Plegado desmonta player y chat (no deja video descargándose en
 * segundo plano) pero los controles siguen a la vista.
 */
export function AdminBroadcastPanel({ live, obsConnected, obsUnavailable, isSaving, onStart, onPause, onResume, onFinalize }: AdminBroadcastPanelProps) {
  const [collapsed, toggleCollapsed] = usePreviewCollapsed();
  const [muted, setMuted] = useState(true);
  // Local al panel: no toca la preferencia del admin cuando mira como alumno.
  const [latencyMode, setLatencyMode] = useState<LiveLatencyMode>("smooth");
  const isOnAir = live.status === "live";
  // A nivel de panel (no en la parte plegable) para que el contador siga
  // visible al ocultar; solo escucha: el admin no cuenta como espectador.
  const { viewers, totalViewers } = useLivePresence({ liveId: live.id, user: null, enabled: isOnAir, observeOnly: true });

  // Sala finalizada: la pestaña Finalizados se encarga.
  if (live.status === "ended") return null;

  const phase = phaseOf(live);
  const showMedia = isOnAir && !collapsed;
  // Con la sala en vivo se monta aunque el sondeo de OBS esté apagado o caído:
  // el aviso de "el video no llega" cubre el caso de una señal que no existe.
  const playerEnabled = obsConnected || isOnAir;

  const handleToggleCollapsed = () => {
    setMuted(true); // al desmontar el player la próxima vista arranca en silencio
    toggleCollapsed();
  };

  return (
    <section
      aria-label="Panel de transmisión"
      className={cn(
        "space-y-4 rounded-2xl border p-4 transition-colors sm:p-6",
        phase === "live" ? "border-red-500/30 bg-red-500/5" : phase === "paused" ? "border-yellow-500/30 bg-yellow-500/5" : "border-line-subtle bg-surface-page"
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="flex min-w-0 items-center gap-2 text-lg font-bold text-foreground-strong">
          <Radio size={18} className="shrink-0 text-accent" />
          <span className="truncate">{live.title || "Panel de transmisión"}</span>
        </h3>
        {isOnAir && (
          <div className="flex items-center gap-2">
            <a
              href={STUDENT_ROOM_PATH}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold text-accent transition-colors hover:bg-brand/10"
            >
              Abrir vista del alumno <ExternalLink size={13} />
            </a>
            <button
              type="button"
              onClick={handleToggleCollapsed}
              aria-expanded={!collapsed}
              className="flex items-center gap-1.5 rounded-lg border border-line-subtle bg-ink/5 px-3 py-1.5 text-xs font-bold text-foreground-strong transition-colors hover:bg-ink/10"
            >
              {collapsed ? "Mostrar" : "Ocultar"}
              <ChevronDown size={14} className={cn("transition-transform", !collapsed && "rotate-180")} />
            </button>
          </div>
        )}
      </div>

      <div className={cn("grid gap-4", showMedia && "lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]")}>
        <div className="min-w-0 space-y-3 self-start">
          {showMedia && <AdminLiveVideoPreview key={live.id} liveInputId={live.stream_live_input_id} enabled={playerEnabled} muted={muted} roomPaused={live.is_paused} latencyMode={latencyMode} />}
          <BroadcastControls
            phase={phase}
            obsConnected={obsConnected}
            obsUnavailable={obsUnavailable}
            startsAt={live.starts_at}
            isSaving={isSaving}
            showAudio={showMedia && playerEnabled && !!live.stream_live_input_id}
            muted={muted}
            latencyMode={latencyMode}
            onLatencyModeChange={setLatencyMode}
            viewers={viewers}
            totalViewers={totalViewers}
            onToggleMuted={() => setMuted((current) => !current)}
            onStart={onStart}
            onPause={onPause}
            onResume={onResume}
            onFinalize={onFinalize}
          />
        </div>
        {showMedia && (
          <div className="relative h-96 overflow-hidden rounded-xl border border-line-subtle lg:h-auto lg:min-h-[22rem]">
            <div className="absolute inset-0">
              <LiveChat key={live.id} liveId={live.id} canModerate showWelcome={false} />
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
