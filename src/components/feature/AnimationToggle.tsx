import { Sparkles, Zap } from "lucide-react";
import { usePreferencesStore } from "@/stores/preferences.store";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface AnimationToggleProps {
  /** "compact" para usar dentro de la barra superior; "labeled" para footers o paneles. */
  variant?: "compact" | "labeled";
  className?: string;
}

const AnimationToggle = ({ variant = "compact", className = "" }: AnimationToggleProps) => {
  const animationsEnabled = usePreferencesStore((s) => s.animationsEnabled);
  const toggle = usePreferencesStore((s) => s.toggleAnimations);

  const label = animationsEnabled ? "Modo cinematográfico" : "Modo simple";
  const aria = animationsEnabled
    ? "Desactivar animaciones para mejor rendimiento"
    : "Activar animaciones cinematográficas";

  if (variant === "labeled") {
    return (
      <button
        type="button"
        onClick={toggle}
        aria-pressed={!animationsEnabled}
        aria-label={aria}
        className={`inline-flex items-center gap-2 text-xs font-medium text-textMuted hover:text-gold transition-colors ${className}`}
      >
        {animationsEnabled ? <Sparkles size={14} /> : <Zap size={14} />}
        <span>{label}</span>
        <span
          className={`ml-1 inline-flex h-4 w-7 items-center rounded-full border transition-colors ${
            animationsEnabled
              ? "bg-gold/20 border-gold/40"
              : "bg-white/5 border-white/15"
          }`}
        >
          <span
            className={`h-3 w-3 rounded-full transition-transform ${
              animationsEnabled
                ? "translate-x-3 bg-gold"
                : "translate-x-0.5 bg-white/50"
            }`}
          />
        </span>
      </button>
    );
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          onClick={toggle}
          aria-pressed={!animationsEnabled}
          aria-label={aria}
          className={`inline-flex items-center justify-center h-9 w-9 rounded-full border transition-colors ${
            animationsEnabled
              ? "border-gold/30 text-gold/90 hover:text-gold hover:border-gold/50 bg-gold/5"
              : "border-white/15 text-white/60 hover:text-white hover:border-white/30 bg-white/5"
          } ${className}`}
        >
          {animationsEnabled ? <Sparkles size={16} /> : <Zap size={16} />}
        </button>
      </TooltipTrigger>
      <TooltipContent side="bottom" className="text-xs">
        {animationsEnabled
          ? "Animaciones activas. Click para modo simple."
          : "Modo simple. Click para reactivar animaciones."}
      </TooltipContent>
    </Tooltip>
  );
};

export default AnimationToggle;
