import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

export type Plan = "free" | "individual" | "vip";

// Cada plan conserva su color en ambos temas (free verde, individual azul, VIP
// violeta); en claro usa su familia semántica, con contraste medido.
const PLAN_STYLES: Record<Plan, { active: string; check: string }> = {
  free: {
    active: "bg-green-500/10 text-green-300 border-green-500/30 light:bg-success-surface light:text-success light:border-success-line",
    check: "bg-green-500 text-black",
  },
  individual: {
    active: "bg-blue-500/10 text-blue-300 border-blue-500/30 light:bg-info-surface light:text-info light:border-info-line",
    check: "bg-blue-500 text-white",
  },
  vip: {
    active: "bg-purple-500/10 text-purple-300 border-purple-500/30 light:bg-violet-surface light:text-violet light:border-violet-line",
    check: "bg-purple-500 text-white",
  },
};

interface PlansSelectorProps {
  value: Plan[];
  onChange: (plans: Plan[]) => void;
  label?: string;
}

const PLANS: Plan[] = ["free", "individual", "vip"];

export const PlansSelector = ({ value, onChange, label = "Planes con acceso" }: PlansSelectorProps) => {
  const toggle = (plan: Plan) => {
    if (value.includes(plan)) {
      onChange(value.filter((p) => p !== plan));
    } else {
      onChange([...value, plan]);
    }
  };

  return (
    <div className="space-y-2">
      <label className="block text-xs font-semibold text-fg-60 uppercase tracking-wider">
        {label}
      </label>
      <div className="flex flex-wrap gap-2">
        {PLANS.map((plan) => {
          const selected = value.includes(plan);
          const styles = PLAN_STYLES[plan];
          return (
            <button
              key={plan}
              type="button"
              onClick={() => toggle(plan)}
              className={cn(
                "flex items-center gap-2 px-3.5 py-2 rounded-lg border text-sm font-medium capitalize transition-all",
                selected
                  ? styles.active
                  : "border-line-subtle text-fg-40 bg-ink/[0.02] light:bg-surface-panel hover:border-ink/20 hover:text-fg-60"
              )}
            >
              <span
                className={cn(
                  "w-4 h-4 rounded flex items-center justify-center transition-colors",
                  selected ? styles.check : "border border-ink/20"
                )}
              >
                {selected && <Check size={12} strokeWidth={3} />}
              </span>
              {plan}
            </button>
          );
        })}
      </div>
    </div>
  );
};

export const PLAN_BADGE_STYLES: Record<Plan, string> = {
  free: "bg-green-500/15 text-green-300 border border-green-500/30 light:bg-success-surface light:text-success light:border-success-line",
  individual: "bg-blue-500/15 text-blue-300 border border-blue-500/30 light:bg-info-surface light:text-info light:border-info-line",
  vip: "bg-purple-500/15 text-purple-300 border border-purple-500/30 light:bg-violet-surface light:text-violet light:border-violet-line",
};
