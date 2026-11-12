import { useEffect, useState } from "react";
import { Loader2, Mail, MailWarning, RefreshCw, ShieldOff } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "@/components/ui/toaster";
import {
  fetchEmailBlock, fetchUserEmails, removeEmailBlock,
  type EmailBlock, type EmailDelivery,
} from "@/lib/api/admin/emails";
import { EMAIL_STATUS_LABEL, describeEmailProblem, type EmailStatus } from "@/lib/emailDelivery";

const STATUS_STYLE: Record<EmailStatus, string> = {
  sent: "bg-ink/10 text-fg-70 border-ink/20",
  delivery_delayed: "bg-amber-500/10 text-amber-400 border-amber-500/20 light:text-amber-700",
  delivered: "bg-green-500/10 text-green-400 border-green-500/20 light:text-success",
  failed: "bg-red-500/10 text-danger border-red-500/20",
  suppressed: "bg-red-500/10 text-danger border-red-500/20",
  bounced: "bg-red-500/10 text-danger border-red-500/20",
  complained: "bg-red-500/10 text-danger border-red-500/20",
};

const formatDate = (value: string) =>
  new Date(value).toLocaleString("es-ES", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

interface EmailHistoryPanelProps {
  userId: string;
  /** Correo actual: solo un problema de ESTA dirección pide acción. */
  email?: string;
  /** Cambiarlo recarga el historial (al corregir el correo o reenviar el acceso). */
  reloadKey: number;
}

interface LoadedHistory {
  emails: EmailDelivery[];
  block: EmailBlock;
}

/**
 * Qué correos se le enviaron a esta persona y si llegaron. Nunca muestra el
 * contenido: el correo de acceso lleva la contraseña temporal.
 */
export function EmailHistoryPanel({ userId, email, reloadKey }: EmailHistoryPanelProps) {
  const [history, setHistory] = useState<LoadedHistory | null>(null);
  const [failed, setFailed] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [unblocking, setUnblocking] = useState(false);

  useEffect(() => {
    let active = true;
    Promise.all([
      fetchUserEmails(userId),
      // Sin este dato el historial igual sirve.
      fetchEmailBlock(userId).catch((): EmailBlock => ({ email: null, blocked: null })),
    ])
      .then(([emails, block]) => {
        if (!active) return;
        setHistory({ emails, block });
        setFailed(false);
      })
      .catch((err) => {
        console.error("Error cargando el historial de correos:", err);
        if (active) setFailed(true);
      });
    return () => {
      active = false;
    };
  }, [userId, reloadKey, refreshKey]);

  const handleUnblock = async () => {
    if (!history?.block.email) return;
    if (!window.confirm(`¿Quitar el bloqueo de ${history.block.email}? Hazlo solo si confirmaste que el correo es correcto.`)) return;
    try {
      setUnblocking(true);
      await removeEmailBlock(userId);
      toast.success("Bloqueo quitado", { description: "Ya puedes reenviarle el acceso." });
      setRefreshKey((k) => k + 1);
    } catch (err) {
      toast.error("No se pudo quitar el bloqueo", { description: (err as Error).message });
    } finally {
      setUnblocking(false);
    }
  };

  const latest = history?.emails[0];
  const isCurrentAddress = latest && latest.recipient === email?.trim().toLowerCase();
  const problem = latest && isCurrentAddress ? describeEmailProblem(latest, history?.block.blocked) : null;
  const blocked = history?.block.blocked === true;
  const temporary = problem?.temporary && !blocked;

  return (
    <div className="bg-black/30 border border-line-subtle rounded-2xl p-5 sm:p-6 light:bg-surface-panel light:shadow-panel">
      <div className="flex items-center justify-between gap-3 mb-4">
        <h2 className="text-lg font-bold text-foreground-strong flex items-center gap-2">
          <Mail size={18} className="text-accent" /> Correos enviados
        </h2>
        <button
          type="button"
          onClick={() => setRefreshKey((k) => k + 1)}
          className="flex items-center gap-1.5 text-xs font-semibold text-fg-60 hover:text-foreground-strong transition-colors"
        >
          <RefreshCw size={13} /> Actualizar
        </button>
      </div>

      {(problem || blocked) && (
        <div
          className={cn(
            "mb-4 rounded-xl border p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3",
            temporary ? "border-amber-500/25 bg-amber-500/5" : "border-red-500/20 bg-red-500/5",
          )}
        >
          <div className="flex items-start gap-2 min-w-0">
            <MailWarning size={18} className={cn("shrink-0 mt-0.5", temporary ? "text-amber-400 light:text-amber-700" : "text-danger")} />
            <div className="min-w-0">
              <p className="font-bold text-foreground-strong text-sm">{problem?.title ?? "Correo bloqueado"}</p>
              <p className="text-sm text-foreground-muted">
                {problem?.action ?? "No se le envía nada a esta dirección. Si el correo es correcto, quita el bloqueo."}
              </p>
              {problem && history?.block.blocked === null && (
                <p className="text-[11px] text-foreground-muted mt-1">No se pudo comprobar si la dirección está bloqueada.</p>
              )}
            </div>
          </div>
          {blocked && (
            <button
              type="button"
              onClick={handleUnblock}
              disabled={unblocking}
              className="flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold border border-line-subtle hover:border-brand/40 text-foreground-strong transition-colors disabled:opacity-50 shrink-0"
            >
              {unblocking ? <Loader2 size={14} className="animate-spin" /> : <ShieldOff size={14} />}
              Quitar bloqueo
            </button>
          )}
        </div>
      )}

      {failed ? (
        <p role="alert" className="text-sm text-danger">No se pudo cargar el historial de correos.</p>
      ) : !history ? (
        <div className="flex justify-center py-6">
          <Loader2 className="text-accent animate-spin" size={24} aria-label="Cargando correos" />
        </div>
      ) : history.emails.length === 0 ? (
        <p className="text-sm text-foreground-muted text-center py-6">Todavía no hay correos registrados para este usuario.</p>
      ) : (
        <ul className="divide-y divide-ink/5">
          {history.emails.map((item) => {
            const itemProblem = describeEmailProblem(item);
            return (
              <li key={item.email_id} className="py-3 first:pt-0 last:pb-0">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-foreground-strong">{item.subject || "Sin asunto"}</p>
                    <p className="text-xs text-foreground-muted break-all">
                      {formatDate(item.sent_at)} · {item.recipient}
                    </p>
                  </div>
                  <span className={cn("px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider border shrink-0", STATUS_STYLE[item.status])}>
                    {EMAIL_STATUS_LABEL[item.status]}
                  </span>
                </div>
                {itemProblem && <p className="mt-1 text-xs text-fg-80">{itemProblem.title}</p>}
                {item.detail && (
                  <details className="mt-1">
                    <summary className="text-[11px] text-foreground-muted cursor-pointer">Detalle técnico</summary>
                    <p className="mt-1 text-[11px] text-foreground-muted break-words">{item.detail}</p>
                  </details>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
