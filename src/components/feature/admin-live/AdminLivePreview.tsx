import { ChevronDown, ExternalLink, MonitorPlay } from "lucide-react";
import { cn } from "@/lib/utils";
import LiveChat from "@/components/feature/LiveChat";
import type { LiveEvent } from "@/lib/api/stream/lives";
import { AdminLiveVideoPreview } from "./AdminLiveVideoPreview";
import { usePreviewCollapsed } from "./usePreviewCollapsed";

/** Ruta de la sala que ven los alumnos (src/routes.tsx). */
const STUDENT_ROOM_PATH = "/vip-live";

interface AdminLivePreviewProps {
  live: Pick<LiveEvent, "id" | "status" | "stream_live_input_id">;
  /** Estado de OBS del sondeo de AdminLiveManager. */
  obsConnected: boolean;
}

/**
 * Vista previa del en vivo + chat moderable, para operar la clase sin salir
 * del panel. Plegado desmonta TODO (player y suscripción del chat): no deja
 * video descargándose en segundo plano.
 */
export function AdminLivePreview({ live, obsConnected }: AdminLivePreviewProps) {
  const [collapsed, toggleCollapsed] = usePreviewCollapsed();

  // Sala finalizada: ya no hay nada que previsualizar.
  if (live.status === "ended") return null;

  return (
    <section aria-label="Vista previa del en vivo" className="bg-surface-page border border-line-subtle rounded-2xl p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="flex items-center gap-2 text-lg font-bold text-foreground-strong">
          <MonitorPlay size={18} className="text-accent" /> Vista previa y chat
        </h3>
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
            onClick={toggleCollapsed}
            aria-expanded={!collapsed}
            className="flex items-center gap-1.5 rounded-lg border border-line-subtle bg-ink/5 px-3 py-1.5 text-xs font-bold text-foreground-strong transition-colors hover:bg-ink/10"
          >
            {collapsed ? "Mostrar" : "Ocultar"}
            <ChevronDown size={14} className={cn("transition-transform", !collapsed && "rotate-180")} />
          </button>
        </div>
      </div>

      {!collapsed && (
        <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_380px]">
          <div className="self-start">
            <AdminLiveVideoPreview key={live.id} liveInputId={live.stream_live_input_id} obsConnected={obsConnected} />
          </div>
          <div className="relative h-96 overflow-hidden rounded-xl border border-line-subtle lg:h-auto lg:min-h-[22rem]">
            <div className="absolute inset-0">
              <LiveChat key={live.id} liveId={live.id} canModerate showWelcome={false} />
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
