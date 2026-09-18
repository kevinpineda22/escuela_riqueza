import { useId } from "react";
import { Monitor, Moon, Sun, type LucideIcon } from "lucide-react";
import { usePreferencesStore } from "@/stores/preferences.store";
import {
  APPEARANCE_SELECTOR_ENABLED,
  parseThemePreference,
  type ThemePreference,
} from "@/lib/theme";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

const OPTIONS: { value: ThemePreference; label: string; icon: LucideIcon }[] = [
  { value: "dark", label: "Oscuro", icon: Moon },
  { value: "light", label: "Claro", icon: Sun },
  { value: "system", label: "Sistema", icon: Monitor },
];

interface AppearanceToggleProps {
  /** "compact" para la barra superior; "labeled" para paneles y footers. */
  variant?: "compact" | "labeled";
  className?: string;
}

// Preferencia de apariencia. Independiente de AnimationToggle: cambiar el tema
// nunca toca el movimiento, y viceversa.
const AppearanceToggle = ({ variant = "compact", className }: AppearanceToggleProps) => {
  const preference = usePreferencesStore((s) => s.themePreference);
  const setPreference = usePreferencesStore((s) => s.setThemePreference);
  // Nombre único por instancia: Sheet y Footer pueden convivir en la página.
  const groupName = useId();

  if (!APPEARANCE_SELECTOR_ENABLED) return null;

  const current = OPTIONS.find((o) => o.value === preference) ?? OPTIONS[0]!;
  const CurrentIcon = current.icon;

  if (variant === "labeled") {
    return (
      <fieldset className={cn("min-w-0", className)}>
        <legend className="mb-2 text-xs font-medium text-foreground-muted">Apariencia</legend>
        <div className="grid grid-cols-3 gap-1 rounded-2xl border border-line-subtle bg-ink/5 p-1 light:bg-surface-subtle">
          {OPTIONS.map(({ value, label, icon: Icon }) => (
            <label key={value} className="relative">
              <input
                type="radio"
                name={groupName}
                value={value}
                checked={preference === value}
                onChange={() => setPreference(value)}
                className="peer sr-only"
              />
              {/* Icono sobre el texto: entra en columnas angostas (Sheet de 280px) sin cortarse. */}
              <span className="flex min-h-11 cursor-pointer flex-col items-center justify-center gap-0.5 rounded-xl px-1 py-1.5 text-[11px] font-medium text-foreground-muted transition-colors hover:text-foreground-strong peer-checked:bg-brand peer-checked:text-on-brand peer-checked:shadow-sm peer-focus-visible:ring-2 peer-focus-visible:ring-focus peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-surface-page">
                <Icon size={14} aria-hidden />
                {label}
              </span>
            </label>
          ))}
        </div>
      </fieldset>
    );
  }

  return (
    <DropdownMenu>
      <Tooltip>
        <TooltipTrigger asChild>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              aria-label={`Apariencia: ${current.label}`}
              className={cn(
                // Se ve de 36px como AnimationToggle; el ::before lleva el área táctil a 44px.
                "relative inline-flex h-9 w-9 items-center justify-center rounded-full border border-ink/15 bg-ink/5 text-fg-60 transition-colors before:absolute before:-inset-1 before:content-['']",
                "hover:border-ink/30 hover:text-foreground-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-surface-page",
                "data-[state=open]:border-brand/50 data-[state=open]:text-accent light:bg-surface-panel",
                className
              )}
            >
              <CurrentIcon size={16} aria-hidden />
            </button>
          </DropdownMenuTrigger>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="text-xs">
          Apariencia
        </TooltipContent>
      </Tooltip>
      <DropdownMenuContent align="end" className="min-w-[11rem]">
        <DropdownMenuLabel>Apariencia</DropdownMenuLabel>
        <DropdownMenuRadioGroup
          value={preference}
          onValueChange={(value) => setPreference(parseThemePreference(value))}
        >
          {OPTIONS.map(({ value, label, icon: Icon }) => (
            <DropdownMenuRadioItem key={value} value={value}>
              <Icon aria-hidden />
              {label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default AppearanceToggle;
