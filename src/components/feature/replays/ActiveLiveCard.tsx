import { Link } from "react-router-dom";
import { Radio } from "lucide-react";
import { cn } from "@/lib/utils";
import type { LiveEvent } from "@/lib/api/stream/lives";

interface ActiveLiveCardProps {
  live: LiveEvent;
  /** true cuando el plan del usuario (o el rol admin) puede entrar a la sala. */
  canEnter: boolean;
}

/** Sala activa o próxima: acceso a /vip-live si el plan lo permite, informativa si no. */
export function ActiveLiveCard({ live, canEnter }: ActiveLiveCardProps) {
  const isLive = live.status === "live";
  const when = live.starts_at
    ? new Date(live.starts_at).toLocaleDateString("es-CO", {
        day: "numeric",
        month: "long",
        hour: "2-digit",
        minute: "2-digit",
      })
    : null;

  return (
    <section
      aria-label="Sala en vivo"
      className="rounded-2xl border border-brand/20 bg-gradient-to-r from-brand/5 via-brand/10 to-brand/5 p-4 md:p-5"
    >
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <span
            aria-hidden="true"
            className={cn(
              "h-3 w-3 shrink-0 rounded-full",
              isLive ? "animate-pulse bg-red-500 shadow-[0_0_10px_red]" : "bg-brand",
            )}
          />
          <div>
            <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-accent">
              {isLive ? "En vivo ahora" : "Próximo en vivo"}
            </span>
            <h3 className="mt-0.5 text-sm font-bold text-foreground-strong md:text-base">{live.title}</h3>
            {when && !isLive && <p className="mt-0.5 text-xs text-foreground-muted">{when}</p>}
          </div>
        </div>
        {canEnter ? (
          <Link
            to="/vip-live"
            className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-red-600 px-4 py-2.5 text-xs font-bold text-white shadow-lg shadow-red-900/40 transition-colors hover:bg-red-700"
          >
            Entrar a la sala <Radio size={14} aria-hidden="true" />
          </Link>
        ) : (
          <p className="max-w-xs text-xs text-foreground-muted">
            Esta transmisión es para otros planes.
          </p>
        )}
      </div>
    </section>
  );
}
