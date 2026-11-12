import { useState } from "react";
import { Check, Copy, MailCheck, MailWarning } from "lucide-react";
import type { AccessDelivery } from "@/lib/api/admin/users";

interface AccessDeliveryNoticeProps {
  email: string;
  delivery: AccessDelivery;
}

/**
 * Resultado de un alta o de "Reenviar acceso": si salió el correo y la
 * contraseña temporal, que se muestra UNA sola vez para poder pasarla a mano
 * (WhatsApp, en persona) si el correo cae en spam o no llega.
 */
export function AccessDeliveryNotice({ email, delivery }: AccessDeliveryNoticeProps) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(delivery.tempPassword);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Sin permiso de portapapeles: la contraseña sigue visible para copiarla a mano.
    }
  };

  return (
    <div className="space-y-4">
      {delivery.emailSent ? (
        <p className="flex items-start gap-2 text-sm text-fg-85">
          <MailCheck size={18} className="text-green-400 light:text-success shrink-0 mt-0.5" />
          <span>
            Enviamos el correo de acceso a <strong className="text-foreground-strong break-all">{email}</strong>. Si no
            lo ve, que revise la carpeta de spam.
          </span>
        </p>
      ) : (
        <p role="alert" className="flex items-start gap-2 text-sm text-fg-85">
          <MailWarning size={18} className="text-amber-400 light:text-warning shrink-0 mt-0.5" />
          <span>
            {delivery.emailError
              ? <>No se pudo enviar el correo ({delivery.emailError}). </>
              : <>No se envió ningún correo. </>}
            Comparte estos datos directamente con la persona.
          </span>
        </p>
      )}

      <div className="rounded-xl border border-line-subtle bg-black/40 p-4 light:bg-surface-subtle">
        <p className="text-[11px] uppercase tracking-wider text-foreground-muted">Contraseña temporal</p>
        <div className="mt-1 flex items-center justify-between gap-3">
          <code className="text-lg font-bold tracking-wide text-accent break-all">{delivery.tempPassword}</code>
          <button
            type="button"
            onClick={copy}
            className="flex items-center gap-1.5 shrink-0 px-3 py-1.5 rounded-lg border border-line-subtle text-xs font-semibold text-fg-80 hover:text-foreground-strong hover:border-brand/40 transition-colors"
          >
            {copied ? <Check size={14} /> : <Copy size={14} />}
            {copied ? "Copiada" : "Copiar"}
          </button>
        </div>
        <p className="mt-2 text-[11px] text-foreground-muted">
          Solo se muestra ahora. Al entrar por primera vez, la plataforma le pide crear su propia contraseña.
        </p>
      </div>
    </div>
  );
}
