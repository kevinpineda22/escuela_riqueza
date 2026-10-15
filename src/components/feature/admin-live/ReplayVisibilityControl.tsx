import { useState } from "react";
import { GraduationCap } from "lucide-react";
import { toast } from "@/components/ui/toaster";
import { cn } from "@/lib/utils";
import { setLiveReplayVisibility, type LiveEvent } from "@/lib/api/stream/lives";
import type { ReplayVisibility } from "@/lib/replayVisibility";

interface ReplayVisibilityControlProps {
  live: LiveEvent;
  onUpdated: (updated: LiveEvent) => void;
}

const OPTIONS: { value: ReplayVisibility; label: string; help: string }[] = [
  { value: "hidden", label: "Oculta", help: "Nadie la ve, ni en la escuela ni por el link público." },
  { value: "paid", label: "Planes pagos", help: "Alumnos Individual y VIP con sesión iniciada. Los alumnos Free la ven con candado." },
  { value: "all", label: "Todos los planes", help: "Todos los alumnos en la escuela y cualquier persona con el link público, sin necesidad de cuenta." },
];

const PUBLIC_LINK_HINT = "Activa el link público para compartirla fuera de la escuela.";

/** Una grabación se puede mostrar solo si ya está vinculada (R2 o Stream). */
function hasLinkedRecording(live: LiveEvent): boolean {
  return (live.recording_storage === "r2" && !!live.recording_r2_key) || !!live.recording_stream_uid;
}

/**
 * Control segmentado "¿Quién ve esta grabación?" de una grabación finalizada.
 * Actualiza de forma optimista y revierte con un toast si el servidor falla.
 * La misma regla aplica en la escuela y en el link público de la sala.
 */
export function ReplayVisibilityControl({ live, onUpdated }: ReplayVisibilityControlProps) {
  const [saving, setSaving] = useState(false);
  const hasRecording = hasLinkedRecording(live);
  const current = live.replay_visibility ?? "hidden";
  const disabled = !hasRecording || saving;
  const help = OPTIONS.find((o) => o.value === current)?.help;

  const select = async (next: ReplayVisibility) => {
    if (disabled || next === current) return;
    setSaving(true);
    onUpdated({ ...live, replay_visibility: next });
    try {
      const updated = await setLiveReplayVisibility(live.id, next);
      onUpdated(updated);
    } catch {
      onUpdated(live);
      toast.error("No se pudo cambiar la visibilidad de la grabación");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-xl border border-line-subtle bg-black/20 light:bg-surface-subtle p-3 sm:p-4 space-y-2">
      <div>
        <div className="flex items-center gap-2 text-sm font-bold text-foreground-strong">
          <GraduationCap size={16} className="text-accent" aria-hidden="true" />
          <span id={`replay-visibility-${live.id}`}>¿Quién ve esta grabación?</span>
        </div>
        <p className="mt-0.5 text-xs text-foreground-muted">
          Aplica en «En vivo y grabaciones» y en el link público.
        </p>
      </div>
      <div
        role="radiogroup"
        aria-labelledby={`replay-visibility-${live.id}`}
        className="grid grid-cols-1 sm:grid-cols-3 gap-1 rounded-xl bg-ink/5 p-1"
      >
        {OPTIONS.map((option) => {
          const active = option.value === current;
          return (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={active}
              disabled={disabled}
              onClick={() => select(option.value)}
              className={cn(
                "rounded-lg px-3 py-2 text-xs sm:text-sm font-bold transition-colors disabled:cursor-not-allowed disabled:opacity-50",
                active
                  ? "bg-brand text-on-brand"
                  : "text-foreground-muted hover:bg-ink/10 hover:text-foreground-strong",
              )}
            >
              {option.label}
            </button>
          );
        })}
      </div>
      <p className="text-xs text-foreground-muted">
        {hasRecording ? help : "Vincula una grabación para mostrarla a los alumnos"}
      </p>
      {hasRecording && current === "all" && !live.is_public && (
        <p className="text-xs text-foreground-muted/80">{PUBLIC_LINK_HINT}</p>
      )}
    </div>
  );
}
