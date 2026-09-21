import { Users } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import type { ViewerInfo } from "@/types/live";

interface LiveViewersDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  viewers: ViewerInfo[];
  totalViewers: number;
  currentUserId?: string;
}

/**
 * Lista de conectados de un live — extraída de `VIPLiveRoom` para reutilizarla
 * también en `PublicLiveRoom` (link público). `viewers` solo trae registrados
 * (con `user_id`); la diferencia contra `totalViewers` son los espectadores
 * anónimos del link público, mostrados como fila agregada al final.
 */
const LiveViewersDialog = ({ open, onOpenChange, viewers, totalViewers, currentUserId }: LiveViewersDialogProps) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-surface-page border-line-subtle max-w-md">
        <DialogHeader>
          <DialogTitle className="text-foreground-strong flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-brand/15">
              <Users size={16} className="text-accent" />
            </div>
            Conectados
            <span className="text-accent font-black">({totalViewers})</span>
          </DialogTitle>
        </DialogHeader>
        <div className="max-h-[60vh] overflow-y-auto -mx-2 px-2 space-y-1">
          {viewers.length === 0 ? (
            <p className="text-foreground-muted text-sm text-center py-8">Cargando conectados...</p>
          ) : (
            viewers
              .slice()
              .sort((a, b) => a.full_name.localeCompare(b.full_name))
              .map(v => (
                <div
                  key={v.user_id}
                  className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-ink/[0.04] transition-colors"
                >
                  {v.avatar_url ? (
                    <img
                      src={v.avatar_url}
                      alt={v.full_name}
                      className="w-10 h-10 rounded-full object-cover ring-1 ring-ink/10 shrink-0"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-brand/30 to-brand/10 text-accent flex items-center justify-center font-black text-sm ring-1 ring-focus/30 shrink-0">
                      {v.full_name?.[0]?.toUpperCase() ?? "?"}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-foreground-strong truncate">
                      {v.full_name}
                      {v.user_id === currentUserId && (
                        <span className="ml-1.5 text-accent/70 light:text-accent font-normal text-xs">(Tú)</span>
                      )}
                    </p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                      <span
                        className={cn(
                          "text-[9px] font-black uppercase tracking-widest",
                          v.plan === "vip" && "text-accent",
                          v.plan === "individual" && "text-blue-300 light:text-info",
                          v.plan === "free" && "text-foreground-muted",
                        )}
                      >
                        {v.plan === "vip" ? "★ VIP" : v.plan === "individual" ? "Individual" : "Free"}
                      </span>
                    </div>
                  </div>
                </div>
              ))
          )}
          {totalViewers > viewers.length && (
            <div className="flex items-center gap-3 p-2.5 rounded-xl border-t border-ink/5 mt-1">
              <div className="w-10 h-10 rounded-full bg-ink/5 text-foreground-muted flex items-center justify-center ring-1 ring-ink/10 shrink-0">
                <Users size={16} />
              </div>
              <p className="text-sm text-foreground-muted">
                <span className="font-bold text-foreground-strong">{totalViewers - viewers.length}</span>{" "}
                {totalViewers - viewers.length === 1 ? "invitado" : "invitados"} por link público
              </p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default LiveViewersDialog;
