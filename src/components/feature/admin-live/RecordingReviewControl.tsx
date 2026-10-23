import { useState } from "react";
import { Archive, Loader2, Scissors, Timer } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { LiveEvent } from "@/lib/api/stream/lives";
import { formatTimestamp, hoursUntil } from "@/lib/recordingReview";
import { RecordingTrimmer } from "./RecordingTrimmer";

interface RecordingReviewControlProps {
  live: LiveEvent;
  /** Sala actualizada tras pedir el recorte. */
  onUpdated: (live: LiveEvent) => void;
  /** "Archivar sin recortar": el botón de archivado de siempre, que reclama la revisión en el Worker. */
  onArchiveFull: (live: LiveEvent) => void;
  archiving: boolean;
}

/**
 * Revisión de la grabación antes de archivarla (docs/RECORTE_RECESO_DESIGN.md).
 * Mientras la sala está `pending`, el cron espera: el admin marca el receso y la
 * Action lo quita, dejando un único video; o la archiva completa. Si nadie decide,
 * vence el plazo y se archiva completa sola.
 */
export function RecordingReviewControl({ live, onUpdated, onArchiveFull, archiving }: RecordingReviewControlProps) {
  const [open, setOpen] = useState(false);

  if (live.archived_at || !live.recording_stream_uid) return null;

  if (live.recording_review === "trimming") {
    return (
      <div className="flex items-start gap-2 rounded-xl border border-brand/20 bg-brand/5 px-3 py-2.5 text-sm text-foreground-muted">
        <Loader2 size={16} className="mt-0.5 shrink-0 animate-spin text-accent" aria-hidden="true" />
        <p>
          <span className="font-semibold text-foreground-strong">Recortando el receso.</span>{" "}
          {live.trim_ranges?.length ? `Se quita ${describeRanges(live.trim_ranges)}. ` : ""}
          La grabación se archiva sola como un único video cuando termine. Si en unas horas sigue aquí, revisa la Action en GitHub.
        </p>
      </div>
    );
  }

  if (live.recording_review !== "pending") return null;

  const hours = hoursUntil(live.review_deadline_at, new Date());

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-amber-500/25 bg-amber-500/5 px-3 py-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-start gap-2 text-sm text-foreground-muted">
        <Timer size={16} className="mt-0.5 shrink-0 text-warning" aria-hidden="true" />
        <p>
          <span className="font-semibold text-foreground-strong">Revisión pendiente.</span>{" "}
          {hours > 0
            ? `Si no la revisas, se archiva completa en ${hours} h.`
            : "Venció el plazo: se archiva completa en los próximos minutos."}
        </p>
      </div>
      <div className="flex shrink-0 flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-brand/30 bg-brand/10 px-3 py-2 text-xs font-bold text-accent transition-colors hover:bg-brand/20 sm:flex-none sm:text-sm"
        >
          <Scissors size={16} /> Revisar grabación
        </button>
        <button
          type="button"
          onClick={() => onArchiveFull(live)}
          disabled={archiving}
          className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-line-subtle bg-ink/5 px-3 py-2 text-xs font-bold text-foreground-strong transition-colors hover:bg-ink/10 disabled:opacity-50 sm:flex-none sm:text-sm"
        >
          <Archive size={16} /> {archiving ? "Archivando..." : "Archivar sin recortar"}
        </button>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="bg-surface-page border-line-subtle sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle className="text-foreground-strong">Recortar el receso</DialogTitle>
            <DialogDescription className="text-foreground-muted">
              Lleva las manijas rojas al receso. Se quita ese tramo y la clase se guarda como un único video.
            </DialogDescription>
          </DialogHeader>
          {/* Montado solo con el modal abierto: cada apertura arranca de cero. */}
          {open && (
            <RecordingTrimmer
              live={live}
              onDone={(updated) => {
                setOpen(false);
                onUpdated(updated);
              }}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function describeRanges(ranges: { start: number; end: number }[]): string {
  return ranges.map((r) => `de ${formatTimestamp(r.start)} a ${formatTimestamp(r.end)}`).join(" y ");
}

