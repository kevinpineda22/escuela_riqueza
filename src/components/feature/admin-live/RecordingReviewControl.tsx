import { useEffect, useRef, useState } from "react";
import Hls from "hls.js";
import { Archive, Eye, Loader2, Scissors, Timer } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "@/components/ui/toaster";
import { CF_CUSTOMER_HOST } from "@/components/feature/live-room/constants";
import { requestTrim, type LiveEvent } from "@/lib/api/stream/lives";
import {
  formatTimestamp,
  hoursUntil,
  keptSegments,
  parseTimestamp,
  validateTrimRanges,
} from "@/lib/recordingReview";

/** Segundos antes del inicio del receso desde donde arranca "Ver el corte". */
const PREVIEW_LEAD_SECONDS = 10;

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
              Marca dónde empieza y dónde termina el receso. Se quita ese tramo y la clase se guarda como un único video.
            </DialogDescription>
          </DialogHeader>
          {/* Montado solo con el modal abierto: cada apertura arranca de cero. */}
          {open && (
            <ReviewBody
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

interface ReviewBodyProps {
  live: LiveEvent;
  onDone: (live: LiveEvent) => void;
}

function ReviewBody({ live, onDone }: ReviewBodyProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [startText, setStartText] = useState("");
  const [endText, setEndText] = useState("");
  const [duration, setDuration] = useState<number | null>(live.recording_duration_seconds ?? null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const src = CF_CUSTOMER_HOST && live.recording_stream_uid
    ? `https://${CF_CUSTOMER_HOST}/${live.recording_stream_uid}/manifest/video.m3u8`
    : "";

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !src) return;
    // Safari reproduce HLS nativo; el resto, con hls.js.
    if (video.canPlayType("application/vnd.apple.mpegurl")) {
      video.src = src;
      return () => {
        video.removeAttribute("src");
        video.load();
      };
    }
    if (!Hls.isSupported()) {
      video.src = src;
      return;
    }
    const hls = new Hls();
    hls.on(Hls.Events.ERROR, (_, data) => {
      if (data.fatal) setLoadFailed(true);
    });
    hls.loadSource(src);
    hls.attachMedia(video);
    return () => hls.destroy();
  }, [src]);

  const start = parseTimestamp(startText);
  const end = parseTimestamp(endText);
  const bothMarked = start !== null && end !== null;
  // Texto escrito que no es un tiempo: sin este aviso, el resumen solo desaparece.
  const unreadable = (startText.trim() !== "" && start === null) || (endText.trim() !== "" && end === null);
  const validation = bothMarked && duration ? validateTrimRanges([{ start, end }], duration) : null;
  const kept = validation?.ok && duration ? keptSegments(validation.ranges, duration) : null;
  const keptSeconds = kept?.reduce((sum, s) => sum + (s.end - s.start), 0) ?? null;

  const mark = (which: "start" | "end") => {
    const t = videoRef.current?.currentTime ?? 0;
    if (which === "start") setStartText(formatTimestamp(t));
    else setEndText(formatTimestamp(t));
    setError(null);
  };

  const previewCut = () => {
    const video = videoRef.current;
    if (!video || start === null) return;
    video.currentTime = Math.max(0, start - PREVIEW_LEAD_SECONDS);
    setPreviewing(true);
    void video.play().catch(() => undefined);
  };

  // "Ver el corte": al llegar al inicio del receso salta al final, como va a quedar.
  const handleTimeUpdate = () => {
    const video = videoRef.current;
    if (!previewing || !video || start === null || end === null) return;
    if (video.currentTime >= start && video.currentTime < end) {
      video.currentTime = end;
      setPreviewing(false);
    }
  };

  const submit = async () => {
    if (!validation) {
      setError("Marca el inicio y el fin del receso.");
      return;
    }
    if (!validation.ok) {
      setError(validation.error);
      return;
    }
    if (!window.confirm(
      `¿Recortar ${describeRanges(validation.ranges)}?\n\n` +
      "Se archiva la clase sin ese tramo y se borra el original de Cloudflare. No se puede deshacer.",
    )) return;

    setSubmitting(true);
    setError(null);
    const result = await requestTrim(live.id, validation.ranges);
    setSubmitting(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    toast.success("Recorte en marcha", {
      description: "La grabación se archiva sola como un único video cuando termine.",
    });
    onDone({ ...live, recording_review: "trimming", trim_ranges: result.ranges });
  };

  if (!src) {
    return (
      <p className="text-sm text-foreground-muted">
        Falta configurar <code>VITE_CLOUDFLARE_STREAM_CUSTOMER_SUBDOMAIN</code>: sin eso no se puede reproducir la grabación.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <div className="aspect-video overflow-hidden rounded-xl border border-line-subtle bg-black">
        {loadFailed ? (
          <div className="flex h-full items-center justify-center px-4 text-center text-sm text-fg-60">
            No se pudo cargar la grabación. Si OBS siguió transmitiendo después de finalizar, espera a que Cloudflare termine de procesarla.
          </div>
        ) : (
          <video
            ref={videoRef}
            controls
            playsInline
            preload="metadata"
            className="h-full w-full"
            aria-label="Grabación de la clase"
            onLoadedMetadata={(e) => {
              const d = e.currentTarget.duration;
              if (Number.isFinite(d) && d > 0) setDuration(d);
            }}
            onTimeUpdate={handleTimeUpdate}
          />
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <TimeField
          id="trim-start"
          label="Inicio del receso"
          value={startText}
          onChange={(v) => { setStartText(v); setError(null); }}
          onMark={() => mark("start")}
          markLabel="Marcar inicio"
        />
        <TimeField
          id="trim-end"
          label="Fin del receso"
          value={endText}
          onChange={(v) => { setEndText(v); setError(null); }}
          onMark={() => mark("end")}
          markLabel="Marcar fin"
        />
      </div>

      {duration && keptSeconds !== null ? (
        <p className="text-sm text-foreground-muted" data-testid="trim-summary">
          Duración original <span className="font-semibold text-foreground-strong">{formatTimestamp(duration)}</span>
          {" → queda "}
          <span className="font-semibold text-foreground-strong">{formatTimestamp(keptSeconds)}</span>
        </p>
      ) : null}
      {unreadable && !error ? (
        <p className="text-sm text-warning">Escribe los tiempos como h:mm:ss, por ejemplo 1:05:30.</p>
      ) : null}
      {bothMarked && validation && !validation.ok && !error ? (
        <p className="text-sm text-warning">{validation.error}</p>
      ) : null}
      {error ? <p role="alert" className="text-sm text-danger">{error}</p> : null}

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <button
          type="button"
          onClick={previewCut}
          disabled={!validation?.ok || submitting}
          className="flex items-center justify-center gap-2 rounded-xl border border-line-subtle bg-ink/5 px-4 py-2 text-sm font-bold text-foreground-strong transition-colors hover:bg-ink/10 disabled:opacity-50"
        >
          <Eye size={16} /> Ver el corte
        </button>
        <button
          type="button"
          onClick={submit}
          disabled={submitting}
          className="flex items-center justify-center gap-2 rounded-xl border border-brand/30 bg-brand/10 px-4 py-2 text-sm font-bold text-accent transition-colors hover:bg-brand/20 disabled:opacity-50"
        >
          <Scissors size={16} /> {submitting ? "Enviando..." : "Recortar y archivar"}
        </button>
      </div>
    </div>
  );
}

interface TimeFieldProps {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  onMark: () => void;
  markLabel: string;
}

function TimeField({ id, label, value, onChange, onMark, markLabel }: TimeFieldProps) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="text-xs font-semibold text-foreground-muted">{label}</label>
      <div className="flex gap-2">
        <input
          id={id}
          type="text"
          inputMode="numeric"
          placeholder="h:mm:ss"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="min-w-0 flex-1 rounded-lg border border-line-subtle bg-surface-panel px-3 py-2 text-base tabular-nums text-foreground-strong outline-none focus:border-brand/50"
        />
        <button
          type="button"
          onClick={onMark}
          className="shrink-0 rounded-lg border border-brand/30 bg-brand/10 px-3 py-2 text-xs font-bold text-accent transition-colors hover:bg-brand/20"
        >
          {markLabel}
        </button>
      </div>
    </div>
  );
}
