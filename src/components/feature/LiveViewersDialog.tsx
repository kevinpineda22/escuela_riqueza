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
      <DialogContent className="bg-darker border-white/10 max-w-md">
        <DialogHeader>
          <DialogTitle className="text-white flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-gold/15">
              <Users size={16} className="text-gold" />
            </div>
            Conectados
            <span className="text-gold font-black">({totalViewers})</span>
          </DialogTitle>
        </DialogHeader>
        <div className="max-h-[60vh] overflow-y-auto -mx-2 px-2 space-y-1">
          {viewers.length === 0 ? (
            <p className="text-textMuted text-sm text-center py-8">Cargando conectados...</p>
          ) : (
            viewers
              .slice()
              .sort((a, b) => a.full_name.localeCompare(b.full_name))
              .map(v => (
                <div
                  key={v.user_id}
                  className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-white/[0.04] transition-colors"
                >
                  {v.avatar_url ? (
                    <img
                      src={v.avatar_url}
                      alt={v.full_name}
                      className="w-10 h-10 rounded-full object-cover ring-1 ring-white/10 shrink-0"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-gold/30 to-gold/10 text-gold flex items-center justify-center font-black text-sm ring-1 ring-gold/30 shrink-0">
                      {v.full_name?.[0]?.toUpperCase() ?? "?"}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-white truncate">
                      {v.full_name}
                      {v.user_id === currentUserId && (
                        <span className="ml-1.5 text-gold/70 font-normal text-xs">(Tú)</span>
                      )}
                    </p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                      <span
                        className={cn(
                          "text-[9px] font-black uppercase tracking-widest",
                          v.plan === "vip" && "text-gold",
                          v.plan === "individual" && "text-blue-300",
                          v.plan === "free" && "text-textMuted",
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
            <div className="flex items-center gap-3 p-2.5 rounded-xl border-t border-white/5 mt-1">
              <div className="w-10 h-10 rounded-full bg-white/5 text-textMuted flex items-center justify-center ring-1 ring-white/10 shrink-0">
                <Users size={16} />
              </div>
              <p className="text-sm text-textMuted">
                <span className="font-bold text-white">{totalViewers - viewers.length}</span>{" "}
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
