import { Eye } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuLabel, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import type { ViewerInfo } from "@/types/live";

const PLAN_LABEL: Record<ViewerInfo["plan"], string> = { vip: "VIP", individual: "Individual", free: "Free" };

interface BroadcastViewersProps {
  viewers: ViewerInfo[];
  totalViewers: number;
}

/** Contador "N viendo" con la lista de registrados; los invitados solo se cuentan. */
export function BroadcastViewers({ viewers, totalViewers }: BroadcastViewersProps) {
  const guests = Math.max(totalViewers - viewers.length, 0);
  const sorted = viewers.slice().sort((a, b) => a.full_name.localeCompare(b.full_name));

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={`${totalViewers} viendo. Ver lista de conectados`}
          className="flex items-center gap-1.5 rounded-lg border border-line-subtle bg-ink/5 px-3 py-1.5 text-xs font-bold text-foreground-strong transition-colors hover:bg-ink/10"
        >
          <Eye size={13} aria-hidden="true" /> {totalViewers} viendo
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="max-h-80 w-72 overflow-y-auto">
        <DropdownMenuLabel>Conectados ({totalViewers})</DropdownMenuLabel>
        {sorted.length === 0 && <p className="px-3 py-2 text-xs text-foreground-muted">Ningún usuario registrado conectado.</p>}
        <ul>
          {sorted.map((viewer) => (
            <li key={viewer.user_id} className="flex items-center gap-2.5 rounded-xl px-3 py-1.5">
              {viewer.avatar_url ? (
                <img src={viewer.avatar_url} alt="" className="size-8 shrink-0 rounded-full object-cover ring-1 ring-ink/10" />
              ) : (
                <span aria-hidden="true" className="flex size-8 shrink-0 items-center justify-center rounded-full bg-brand/15 text-xs font-black text-accent">
                  {viewer.full_name?.[0]?.toUpperCase() ?? "?"}
                </span>
              )}
              <span className="min-w-0 flex-1 truncate text-sm font-semibold text-foreground-strong">{viewer.full_name}</span>
              <span className="shrink-0 text-[10px] font-black uppercase tracking-wider text-foreground-muted">{PLAN_LABEL[viewer.plan]}</span>
            </li>
          ))}
        </ul>
        {guests > 0 && (
          <p className="mt-1 border-t border-ink/10 px-3 pt-2 text-xs text-foreground-muted">
            +{guests} {guests === 1 ? "invitado" : "invitados"} (se cuentan, pero no se listan)
          </p>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
