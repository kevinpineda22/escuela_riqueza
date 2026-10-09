import { Eye, VideoOff } from "lucide-react";

interface PausedOverlayProps {
  onPeek: () => void;
}

/** Tapa la vista previa igual que a los alumnos, con salida para espiar la señal. */
export function PausedOverlay({ onPeek }: PausedOverlayProps) {
  return (
    <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-black/85 px-4 text-center">
      <VideoOff size={32} className="text-yellow-500/50" />
      <p className="text-sm font-bold text-foreground-strong">En pausa — así lo ven los alumnos</p>
      <button
        type="button"
        onClick={onPeek}
        className="flex items-center gap-1.5 rounded-lg border border-line-subtle bg-ink/5 px-3 py-1.5 text-xs font-bold text-foreground-strong transition-colors hover:bg-ink/10"
      >
        <Eye size={13} /> Ver señal de OBS
      </button>
    </div>
  );
}

interface PeekBadgeProps {
  onBack: () => void;
}

/** Recordatorio persistente de que la sala sigue en pausa mientras se espía. */
export function PeekBadge({ onBack }: PeekBadgeProps) {
  return (
    <div
      role="status"
      className="absolute left-2 top-2 z-10 flex max-w-[calc(100%-1rem)] items-center gap-2 rounded-full border border-yellow-500/50 bg-black/70 py-1 pl-3 pr-1 text-[11px] font-bold text-yellow-500"
    >
      <span className="truncate">Viendo señal — los alumnos siguen en pausa</span>
      <button type="button" onClick={onBack} className="shrink-0 rounded-full bg-yellow-500/20 px-2 py-0.5 hover:bg-yellow-500/30">
        Volver
      </button>
    </div>
  );
}
