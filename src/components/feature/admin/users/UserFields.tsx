import { Crown, Shield, GraduationCap } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Plan, UserRole } from "@/types/user";

export const inputClass =
  "w-full bg-black/50 border border-line-subtle rounded-xl px-4 py-3 text-foreground-strong focus:outline-none focus:border-accent disabled:opacity-60 light:bg-surface-input light:border-line-control/50 light:placeholder:text-foreground-placeholder";

export const labelClass = "text-sm font-semibold text-foreground-muted";

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const PLAN_OPTIONS: { value: Plan; label: string; hint: string }[] = [
  { value: "free", label: "Free", hint: "Acceso básico con publicidad" },
  { value: "individual", label: "Individual", hint: "Catálogo completo, sin publicidad" },
  { value: "vip", label: "VIP", hint: "Formación presencial: todo incluido, sin vigencia ni cobro" },
];

const ROLE_OPTIONS: { value: UserRole; label: string; hint: string; icon: typeof Shield }[] = [
  { value: "student", label: "Estudiante", hint: "Ve el contenido de su plan", icon: GraduationCap },
  { value: "admin", label: "Administrador", hint: "Entra al panel y gestiona todo", icon: Shield },
];

interface PickerProps<T> {
  value: T;
  onChange: (value: T) => void;
  disabled?: boolean;
  name: string;
}

export function PlanPicker({ value, onChange, disabled, name, stacked }: PickerProps<Plan> & { stacked?: boolean }) {
  return (
    <div role="radiogroup" aria-label="Plan" className={cn("grid grid-cols-1 gap-2", !stacked && "sm:grid-cols-3")}>
      {PLAN_OPTIONS.map((p) => (
        <label
          key={p.value}
          className={cn(
            "flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all",
            value === p.value ? "border-accent bg-brand/10" : "border-line-subtle bg-black/30 hover:border-ink/30 light:bg-surface-panel",
            disabled && "pointer-events-none opacity-60",
          )}
        >
          <input
            type="radio"
            name={name}
            value={p.value}
            checked={value === p.value}
            onChange={() => onChange(p.value)}
            disabled={disabled}
            className="accent-gold mt-1"
          />
          <span>
            <span className="flex items-center gap-1 text-foreground-strong font-bold text-sm">
              {p.value === "vip" && <Crown size={12} className="text-accent" />}
              {p.label}
            </span>
            <span className="block text-foreground-muted text-[11px] leading-snug">{p.hint}</span>
          </span>
        </label>
      ))}
    </div>
  );
}

export function RolePicker({ value, onChange, disabled, name }: PickerProps<UserRole>) {
  return (
    <div role="radiogroup" aria-label="Rol" className="grid grid-cols-1 sm:grid-cols-2 gap-2">
      {ROLE_OPTIONS.map((r) => (
        <label
          key={r.value}
          className={cn(
            "flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all",
            value === r.value ? "border-accent bg-brand/10" : "border-line-subtle bg-black/30 hover:border-ink/30 light:bg-surface-panel",
            disabled && "pointer-events-none opacity-60",
          )}
        >
          <input
            type="radio"
            name={name}
            value={r.value}
            checked={value === r.value}
            onChange={() => onChange(r.value)}
            disabled={disabled}
            className="accent-gold mt-1"
          />
          <span>
            <span className="flex items-center gap-1.5 text-foreground-strong font-bold text-sm">
              <r.icon size={13} className="text-accent" /> {r.label}
            </span>
            <span className="block text-foreground-muted text-[11px] leading-snug">{r.hint}</span>
          </span>
        </label>
      ))}
    </div>
  );
}
