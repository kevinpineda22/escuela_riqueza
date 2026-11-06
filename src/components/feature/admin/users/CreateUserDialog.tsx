import { useState, type FormEvent } from "react";
import { Loader2, UserPlus } from "lucide-react";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { createAdminUser, type AccessDelivery, type AdminUser } from "@/lib/api/admin/users";
import type { Plan, UserRole } from "@/types/user";
import { AccessDeliveryNotice } from "./AccessDeliveryNotice";
import { EMAIL_RE, PlanPicker, RolePicker, inputClass, labelClass } from "./UserFields";

interface CreateUserDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (user: AdminUser) => void;
}

const INITIAL = { fullName: "", email: "", plan: "vip" as Plan, role: "student" as UserRole, sendEmail: true };

export function CreateUserDialog({ open, onOpenChange, onCreated }: CreateUserDialogProps) {
  const [form, setForm] = useState(INITIAL);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ email: string; delivery: AccessDelivery } | null>(null);

  const reset = () => {
    setForm(INITIAL);
    setError(null);
    setResult(null);
  };

  const handleOpenChange = (next: boolean) => {
    if (submitting) return;
    if (!next) reset();
    onOpenChange(next);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const fullName = form.fullName.trim();
    const email = form.email.trim().toLowerCase();
    if (fullName.length < 2) return setError("Escribe el nombre completo.");
    if (!EMAIL_RE.test(email)) return setError("Revisa el correo: no parece válido.");

    setSubmitting(true);
    setError(null);
    try {
      const { user, ...delivery } = await createAdminUser({ ...form, fullName, email });
      onCreated(user);
      setResult({ email, delivery });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-lg bg-surface-page border-line-subtle text-foreground-strong max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl flex items-center gap-2">
            <UserPlus className="text-accent" size={22} /> {result ? "Usuario creado" : "Nuevo usuario"}
          </DialogTitle>
          <DialogDescription className="text-foreground-muted">
            {result
              ? "La cuenta ya puede entrar con estos datos."
              : "La cuenta queda lista para entrar con una contraseña temporal."}
          </DialogDescription>
        </DialogHeader>

        {result ? (
          <div className="space-y-5">
            <AccessDeliveryNotice email={result.email} delivery={result.delivery} />
            <div className="flex flex-col-reverse sm:flex-row gap-2 sm:justify-end">
              <button
                type="button"
                onClick={reset}
                className="px-4 py-2.5 text-sm font-semibold text-fg-70 hover:text-foreground-strong transition-colors"
              >
                Crear otro
              </button>
              <button
                type="button"
                onClick={() => handleOpenChange(false)}
                className="px-5 py-2.5 bg-brand hover:bg-brand-hover text-on-brand font-bold rounded-xl text-sm transition-colors"
              >
                Listo
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5" noValidate>
            <div className="space-y-2">
              <label htmlFor="new-user-name" className={labelClass}>Nombre completo</label>
              <input
                id="new-user-name"
                type="text"
                autoComplete="off"
                value={form.fullName}
                onChange={(e) => setForm({ ...form, fullName: e.target.value })}
                disabled={submitting}
                className={inputClass}
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="new-user-email" className={labelClass}>Correo</label>
              <input
                id="new-user-email"
                type="email"
                autoComplete="off"
                inputMode="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                disabled={submitting}
                className={inputClass}
              />
            </div>
            <div className="space-y-2">
              <p className={labelClass}>Plan</p>
              <PlanPicker name="new-user-plan" value={form.plan} onChange={(plan) => setForm({ ...form, plan })} disabled={submitting} />
            </div>
            <div className="space-y-2">
              <p className={labelClass}>Rol</p>
              <RolePicker name="new-user-role" value={form.role} onChange={(role) => setForm({ ...form, role })} disabled={submitting} />
            </div>
            <label className="flex items-start gap-3 text-sm text-fg-85 cursor-pointer">
              <input
                type="checkbox"
                checked={form.sendEmail}
                onChange={(e) => setForm({ ...form, sendEmail: e.target.checked })}
                disabled={submitting}
                className="accent-gold mt-1"
              />
              <span>
                Enviar el correo de acceso
                <span className="block text-[11px] text-foreground-muted">
                  Con el correo y la contraseña temporal. Igual podrás copiarla al terminar.
                </span>
              </span>
            </label>

            {error && <p role="alert" className="text-sm text-danger">{error}</p>}

            <div className="flex flex-col-reverse sm:flex-row gap-2 sm:justify-end">
              <button
                type="button"
                onClick={() => handleOpenChange(false)}
                disabled={submitting}
                className="px-4 py-2.5 text-sm font-semibold text-fg-70 hover:text-foreground-strong transition-colors"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="px-5 py-2.5 bg-brand hover:bg-brand-hover text-on-brand font-bold rounded-xl text-sm transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {submitting && <Loader2 size={14} className="animate-spin" />}
                Crear usuario
              </button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
