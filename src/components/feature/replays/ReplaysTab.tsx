import { useCallback, useEffect, useState } from "react";
import { AlertCircle, Video } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { listSchoolReplays, type SchoolReplay } from "@/lib/api/stream/replays";
import type { LiveEvent } from "@/lib/api/stream/lives";
import type { Plan, UserRole } from "@/types/user";
import { ActiveLiveCard } from "./ActiveLiveCard";
import { ReplayCard } from "./ReplayCard";

interface ReplaysTabProps {
  plan: Plan | null | undefined;
  role: UserRole | null | undefined;
  /** Sala activa o programada, sin filtrar por plan (la pestaña decide si se puede entrar). */
  activeLive: LiveEvent | null;
}

type Status = "loading" | "ready" | "error";

/** Pestaña "En vivo y grabaciones" del dashboard del alumno. */
export function ReplaysTab({ plan, role, activeLive }: ReplaysTabProps) {
  const [replays, setReplays] = useState<SchoolReplay[]>([]);
  const [status, setStatus] = useState<Status>("loading");

  const run = useCallback((isCancelled: () => boolean) => {
    return listSchoolReplays()
      .then((rows) => {
        if (isCancelled()) return;
        setReplays(rows);
        setStatus("ready");
      })
      .catch(() => {
        if (!isCancelled()) setStatus("error");
      });
  }, []);

  useEffect(() => {
    let cancelled = false;
    void run(() => cancelled);
    return () => {
      cancelled = true;
    };
  }, [run]);

  const retry = () => {
    setStatus("loading");
    void run(() => false);
  };

  const canEnter =
    !!activeLive && (role === "admin" || (!!plan && (activeLive.allowed_plans ?? []).includes(plan)));

  return (
    <div className="space-y-6">
      <header>
        <h2 className="text-2xl font-bold text-foreground-strong">En vivo y grabaciones</h2>
        <p className="mt-1 text-sm text-foreground-muted">
          Entra a la sala cuando haya transmisión y revisa las clases anteriores.
        </p>
      </header>

      {activeLive && <ActiveLiveCard live={activeLive} canEnter={canEnter} />}

      {status === "loading" && (
        <div role="status" aria-label="Cargando grabaciones" className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="aspect-video h-auto w-full" />
          ))}
        </div>
      )}

      {status === "error" && (
        <div role="alert" className="flex flex-col items-center gap-3 rounded-2xl border border-danger-line bg-red-500/5 px-5 py-8 text-center">
          <AlertCircle size={28} className="text-danger" aria-hidden="true" />
          <p className="text-sm text-foreground-muted">No se pudieron cargar las grabaciones.</p>
          <button
            type="button"
            onClick={retry}
            className="rounded-xl border border-brand/30 bg-brand/10 px-4 py-2 text-xs font-bold text-accent transition-colors hover:bg-brand/20"
          >
            Reintentar
          </button>
        </div>
      )}

      {status === "ready" && replays.length === 0 && (
        <EmptyState
          icon={Video}
          title="Todavía no hay grabaciones disponibles"
          description="Cuando se publique una clase grabada, la verás aquí."
        />
      )}

      {status === "ready" && replays.length > 0 && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {replays.map((replay) => (
            <ReplayCard key={replay.id} replay={replay} />
          ))}
        </div>
      )}
    </div>
  );
}
