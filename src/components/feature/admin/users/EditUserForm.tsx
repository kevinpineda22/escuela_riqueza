import { useState, type FormEvent } from "react";
import { Loader2 } from "lucide-react";
import { updateAdminUser, type AdminUser } from "@/lib/api/admin/users";
import { diffUser } from "./diffUser";
import { EMAIL_RE, PlanPicker, RolePicker, inputClass, labelClass } from "./UserFields";

interface EditUserFormProps {
  user: AdminUser;
  /** El admin que está editando: no puede quitarse a sí mismo el rol. */
  currentUserId?: string;
  onSaved: (user: AdminUser) => void;
  onCancel: () => void;
}

export function EditUserForm({ user, currentUserId, onSaved, onCancel }: EditUserFormProps) {
  const [form, setForm] = useState({
    fullName: user.full_name,
    email: user.email ?? "",
    role: user.role,
    plan: user.plan,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isSelf = user.id === currentUserId;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const patch = diffUser(user, form);
    if (Object.keys(patch).length === 0) return onCancel();
    if (patch.fullName !== undefined && patch.fullName.length < 2) return setError("Escribe el nombre completo.");
    if (patch.email !== undefined && !EMAIL_RE.test(patch.email)) return setError("Revisa el correo: no parece válido.");

    setSaving(true);
    setError(null);
    try {
      onSaved(await updateAdminUser(user.id, patch));
    } catch (err) {
      setError((err as Error).message);
      setSaving(false);
    }
  };

  const emailChanged = form.email.trim().toLowerCase() !== (user.email ?? "").toLowerCase();

  return (
    <form onSubmit={handleSubmit} className="space-y-5" noValidate>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <label htmlFor="edit-user-name" className={labelClass}>Nombre completo</label>
          <input
            id="edit-user-name"
            type="text"
            value={form.fullName}
            onChange={(e) => setForm({ ...form, fullName: e.target.value })}
            disabled={saving}
            className={inputClass}
          />
        </div>
        <div className="space-y-2">
          <label htmlFor="edit-user-email" className={labelClass}>Correo de acceso</label>
          <input
            id="edit-user-email"
            type="email"
            inputMode="email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            disabled={saving}
            className={inputClass}
          />
          {emailChanged && (
            <p className="text-[11px] text-foreground-muted">
              Desde que guardes, la persona entra con el correo nuevo. Avísale.
            </p>
          )}
        </div>
      </div>
      <div className="space-y-2">
        <p className={labelClass}>Plan</p>
        <PlanPicker name="edit-user-plan" value={form.plan} onChange={(plan) => setForm({ ...form, plan })} disabled={saving} />
      </div>
      <div className="space-y-2">
        <p className={labelClass}>Rol</p>
        <RolePicker
          name="edit-user-role"
          value={form.role}
          onChange={(role) => setForm({ ...form, role })}
          disabled={saving || isSelf}
        />
        {isSelf && <p className="text-[11px] text-foreground-muted">No puedes cambiar tu propio rol.</p>}
      </div>

      {error && <p role="alert" className="text-sm text-danger">{error}</p>}

      <div className="flex flex-col-reverse sm:flex-row gap-2 justify-end">
        <button
          type="button"
          onClick={onCancel}
          disabled={saving}
          className="px-4 py-2.5 text-sm text-fg-70 hover:text-foreground-strong transition-colors"
        >
          Cancelar
        </button>
        <button
          type="submit"
          disabled={saving}
          className="px-5 py-2.5 bg-brand hover:bg-brand-hover text-on-brand font-bold rounded-xl text-sm transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {saving && <Loader2 size={14} className="animate-spin" />}
          Guardar cambios
        </button>
      </div>
    </form>
  );
}
