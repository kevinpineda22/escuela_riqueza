import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import Hls from "hls.js";
import { Loader2, Play, Scissors, Sparkles, ZoomIn } from "lucide-react";
import { toast } from "@/components/ui/toaster";
import { CF_CUSTOMER_HOST } from "@/components/feature/live-room/constants";
import { requestTrim, type LiveEvent } from "@/lib/api/stream/lives";
import { coarseStep, detectBreak, lastMarkableSecond, sampleTimes } from "@/lib/breakDetection";
import {
  MIN_RANGE_SECONDS,
  formatTimestamp,
  validateTrimRanges,
  type TrimRange,
} from "@/lib/recordingReview";
import { cn } from "@/lib/utils";
import { reportMediaFailure } from "@/lib/errors/errorReporter";
import { loadFrameSample, snapToGrid, thumbnailUrl } from "./streamThumbnails";

/** Miniaturas visibles en la tira principal. */
const STRIP_FRAMES = 24;
/** Ventana de la lupa: 3 minutos alrededor de la manija activa. */
const LUPA_SPAN_SECONDS = 180;
const LUPA_FRAMES = 9;
/** "Ver cómo queda" arranca unos segundos antes del corte para ver la unión. */
const PREVIEW_LEAD_SECONDS = 8;
/** Espera tras mover una manija antes de llevar el video a ese punto. */
const SEEK_DEBOUNCE_MS = 200;
const DETECT_CONCURRENCY = 12;

type Handle = "start" | "end";
type Detection =
  | { status: "running"; progress: number }
  | { status: "found"; range: TrimRange }
  | { status: "none" };

interface RecordingTrimmerProps {
  live: LiveEvent;
  onDone: (live: LiveEvent) => void;
}

/** Punto de partida si no se detecta nada: un tramo en el medio, a la vista. */
function defaultRange(duration: number): TrimRange {
  return { start: Math.round(duration * 0.45), end: Math.round(duration * 0.55) };
}

/**
 * Recortador estilo WhatsApp (tanda 4): tira de miniaturas con dos manijas para
 * marcar el tramo que SE QUITA, lupa para afinar al segundo y vista previa de la
 * unión. Busca solo la pantalla del receso (`detectBreak`) y deja las manijas
 * ahí; el admin solo revisa. El contrato con el servidor no cambia: un
 * `TrimRange` en segundos a `requestTrim`.
 */
export function RecordingTrimmer({ live, onDone }: RecordingTrimmerProps) {
  const uid = live.recording_stream_uid ?? "";
  const src = CF_CUSTOMER_HOST && uid ? `https://${CF_CUSTOMER_HOST}/${uid}/manifest/video.m3u8` : "";

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const stripRef = useRef<HTMLDivElement | null>(null);
  const lupaRef = useRef<HTMLDivElement | null>(null);
  const seekTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const draggingRef = useRef<Handle | null>(null);
  const lupaDragRef = useRef<{ x: number; t: number } | null>(null);
  const touchedRef = useRef(false);

  const [duration, setDuration] = useState<number | null>(live.recording_duration_seconds ?? null);
  const [range, setRange] = useState<TrimRange | null>(null);
  const [active, setActive] = useState<Handle>("start");
  const [touched, setTouched] = useState(false);
  const [detection, setDetection] = useState<Detection>({ status: "running", progress: 0 });
  const [playhead, setPlayhead] = useState<number | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);

  const current = range ?? (duration ? defaultRange(duration) : null);

  // hls.js primero, nativo solo donde no hay MediaSource (iPhone). Chrome nuevo
  // también responde "maybe" a canPlayType(HLS), pero su reproductor nativo no
  // lee los segmentos de Cloudflare (DEMUXER_ERROR_COULD_NOT_PARSE, medido en
  // Chrome 152): preguntar eso primero dejaba el video negro y sin reproducir.
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !src) return;
    if (!Hls.isSupported()) {
      video.src = src;
      return () => {
        video.removeAttribute("src");
        video.load();
      };
    }
    const hls = new Hls();
    let reported = false;
    hls.on(Hls.Events.ERROR, (_, data) => {
      if (!data.fatal) return;
      if (!reported) {
        reported = true;
        reportMediaFailure("trimmer", {
          message: String(data.details),
          hlsType: data.type === Hls.ErrorTypes.NETWORK_ERROR ? "network" : data.type === Hls.ErrorTypes.MEDIA_ERROR ? "media" : "other",
          status: data.response?.code ?? null,
          detail: { videoId: uid },
        });
      }
      setLoadFailed(true);
    });
    hls.loadSource(src);
    hls.attachMedia(video);
    return () => hls.destroy();
  }, [src, uid]);

  const seekVideoSoon = (t: number) => {
    if (seekTimerRef.current) clearTimeout(seekTimerRef.current);
    seekTimerRef.current = setTimeout(() => {
      const video = videoRef.current;
      if (!video) return;
      video.pause();
      video.currentTime = t;
    }, SEEK_DEBOUNCE_MS);
  };

  // Busca el receso en segundo plano. Si el admin ya movió las manijas, no se
  // las pisa: se le ofrece usar lo encontrado.
  useEffect(() => {
    if (!duration || !uid) return;
    let cancelled = false;
    detectBreak(duration, (t) => loadFrameSample(uid, t), {
      concurrency: DETECT_CONCURRENCY,
      onProgress: (progress) => {
        if (!cancelled) setDetection({ status: "running", progress });
      },
    })
      .then((found) => {
        if (cancelled) return;
        if (!found || !validateTrimRanges([found], duration).ok) {
          setDetection({ status: "none" });
          return;
        }
        setDetection({ status: "found", range: found });
        if (!touchedRef.current) {
          setRange(found);
          seekVideoSoon(found.start);
        }
      })
      .catch(() => {
        if (!cancelled) setDetection({ status: "none" });
      });
    return () => {
      cancelled = true;
    };
  }, [duration, uid]);

  useEffect(() => () => {
    if (seekTimerRef.current) clearTimeout(seekTimerRef.current);
  }, []);

  const moveHandle = (which: Handle, t: number) => {
    if (!duration || !current) return;
    const value = Math.round(Math.min(lastMarkableSecond(duration), Math.max(0, t)));
    const next = which === "start"
      ? { start: Math.min(value, current.end - MIN_RANGE_SECONDS), end: current.end }
      : { start: current.start, end: Math.max(value, current.start + MIN_RANGE_SECONDS) };
    touchedRef.current = true;
    setTouched(true);
    setRange(next);
    setActive(which);
    setConfirming(false);
    setPreviewing(false);
    setError(null);
    seekVideoSoon(which === "start" ? next.start : next.end);
  };

  const timeAt = (clientX: number, el: HTMLElement | null) => {
    if (!el || !duration) return 0;
    const rect = el.getBoundingClientRect();
    return rect.width > 0 ? ((clientX - rect.left) / rect.width) * duration : 0;
  };

  const onStripPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (!current) return;
    const t = timeAt(e.clientX, stripRef.current);
    const handle = (e.target as HTMLElement).dataset.handle as Handle | undefined;
    const which = handle ?? (Math.abs(t - current.start) <= Math.abs(t - current.end) ? "start" : "end");
    draggingRef.current = which;
    e.currentTarget.setPointerCapture?.(e.pointerId);
    if (!handle) moveHandle(which, t);
    else setActive(which);
  };
  const onStripPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    if (draggingRef.current) moveHandle(draggingRef.current, timeAt(e.clientX, stripRef.current));
  };
  const endStripDrag = () => {
    draggingRef.current = null;
  };

  const onLupaPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (!current) return;
    lupaDragRef.current = { x: e.clientX, t: current[active] };
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };
  const onLupaPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    const drag = lupaDragRef.current;
    const width = lupaRef.current?.getBoundingClientRect().width ?? 0;
    if (!drag || width <= 0) return;
    // Arrastrar la tira hacia la izquierda avanza en el tiempo, como en un editor.
    moveHandle(active, drag.t - ((e.clientX - drag.x) / width) * LUPA_SPAN_SECONDS);
  };

  const onHandleKeyDown = (which: Handle) => (e: KeyboardEvent<HTMLDivElement>) => {
    if (!current || !duration) return;
    const steps: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, PageDown: -60, PageUp: 60 };
    let delta = steps[e.key];
    if (delta === undefined) return;
    if (e.shiftKey && Math.abs(delta) === 1) delta *= 10;
    e.preventDefault();
    moveHandle(which, current[which] + delta);
  };

  const nudge = (delta: number) => current && moveHandle(active, current[active] + delta);

  const useDetected = () => {
    if (detection.status !== "found") return;
    touchedRef.current = false;
    setTouched(false);
    setRange(detection.range);
    setActive("start");
    setConfirming(false);
    seekVideoSoon(detection.range.start);
  };

  const preview = () => {
    const video = videoRef.current;
    if (!video || !current) return;
    if (seekTimerRef.current) clearTimeout(seekTimerRef.current);
    video.currentTime = Math.max(0, current.start - PREVIEW_LEAD_SECONDS);
    setPreviewing(true);
    void video.play().catch(() => undefined);
  };

  const onTimeUpdate = () => {
    const video = videoRef.current;
    if (!video) return;
    setPlayhead(video.currentTime);
    if (previewing && current && video.currentTime >= current.start && video.currentTime < current.end) {
      video.currentTime = current.end;
      setPreviewing(false);
    }
  };

  // Sin detección y sin tocar, las manijas están en un lugar inventado: no se
  // puede recortar "a ciegas" un tramo de clase.
  const needsMarking = !touched && detection.status !== "found";
  const validation = current && duration ? validateTrimRanges([current], duration) : null;

  const askConfirm = () => {
    if (needsMarking) {
      setError("Marca el receso con las manijas rojas antes de recortar.");
      return;
    }
    if (!validation?.ok) {
      setError(validation?.error ?? "Todavía no se conoce la duración de la grabación.");
      return;
    }
    setError(null);
    setConfirming(true);
  };

  const submit = async () => {
    if (!validation?.ok) return;
    setSubmitting(true);
    setError(null);
    const result = await requestTrim(live.id, validation.ranges);
    setSubmitting(false);
    if (!result.ok) {
      setConfirming(false);
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

  const pct = (t: number) => (duration ? `${(t / duration) * 100}%` : "0%");
  // La tira reusa las mismas muestras que la detección: llegan de la caché.
  const stripTimes = duration
    ? (() => {
        const all = sampleTimes(0, duration - 1, coarseStep(duration));
        return Array.from({ length: STRIP_FRAMES }, (_, i) => all[Math.floor(((i + 0.5) * all.length) / STRIP_FRAMES)]);
      })()
    : [];
  const lupaCenter = current ? current[active] : 0;
  const lupaTimes = Array.from({ length: LUPA_FRAMES }, (_, i) =>
    snapToGrid(lupaCenter - LUPA_SPAN_SECONDS / 2 + ((i + 0.5) * LUPA_SPAN_SECONDS) / LUPA_FRAMES),
  );
  const removed = current ? current.end - current.start : 0;

  return (
    <div className="space-y-4">
      <div className="relative aspect-video overflow-hidden rounded-xl border border-line-subtle bg-black">
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
              // Solo si cambia de verdad: cada cambio relanza la búsqueda del receso.
              if (Number.isFinite(d) && d > 0) setDuration((prev) => (prev && Math.abs(prev - d) < 2 ? prev : d));
            }}
            onTimeUpdate={onTimeUpdate}
            onPause={() => setPreviewing(false)}
          />
        )}
        {current ? (
          <span className="pointer-events-none absolute left-3 top-3 rounded-md bg-black/70 px-2 py-1 text-xs font-semibold tabular-nums text-white">
            {active === "start" ? "Inicio del receso" : "Fin del receso"} · {formatTimestamp(current[active])}
          </span>
        ) : null}
      </div>

      <div>
        <div className="mb-1.5 flex items-baseline justify-between gap-2 text-xs text-foreground-muted">
          <span>Arrastra las manijas rojas al inicio y al fin del receso</span>
          {duration ? <span className="tabular-nums">{formatTimestamp(duration)}</span> : null}
        </div>
        <div
          ref={stripRef}
          className="relative h-14 touch-none select-none rounded-lg bg-black/60"
          onPointerDown={onStripPointerDown}
          onPointerMove={onStripPointerMove}
          onPointerUp={endStripDrag}
          onPointerCancel={endStripDrag}
          data-testid="trim-strip"
        >
          <div className="flex h-full overflow-hidden rounded-lg">
            {stripTimes.map((t, i) => (
              <img
                key={`${t}-${i}`}
                src={thumbnailUrl(uid, t)}
                alt=""
                draggable={false}
                className="h-full min-w-0 flex-1 object-cover opacity-90"
              />
            ))}
          </div>
          {current ? (
            <>
              <div
                className="pointer-events-none absolute inset-y-0 border-y-2 border-red-500 bg-red-500/35"
                style={{ left: pct(current.start), width: `calc(${pct(current.end)} - ${pct(current.start)})` }}
              />
              {(["start", "end"] as const).map((which) => (
                <div
                  key={which}
                  role="slider"
                  tabIndex={0}
                  aria-label={which === "start" ? "Inicio del receso" : "Fin del receso"}
                  aria-valuemin={0}
                  aria-valuemax={duration ? lastMarkableSecond(duration) : 0}
                  aria-valuenow={current[which]}
                  aria-valuetext={formatTimestamp(current[which])}
                  data-handle={which}
                  onKeyDown={onHandleKeyDown(which)}
                  onFocus={() => setActive(which)}
                  className={cn(
                    "absolute -inset-y-1 z-10 -ml-[11px] flex w-[22px] cursor-ew-resize items-center justify-center rounded-md bg-red-500 outline-none",
                    active === which && "ring-2 ring-white ring-offset-1 ring-offset-black",
                  )}
                  style={{ left: pct(current[which]) }}
                >
                  <span data-handle={which} className="h-5 w-0.5 rounded bg-white" />
                </div>
              ))}
            </>
          ) : null}
          {playhead !== null && duration ? (
            <div className="pointer-events-none absolute -inset-y-1 w-0.5 bg-white" style={{ left: pct(playhead) }} />
          ) : null}
        </div>
        <DetectionStatus detection={detection} touched={touched} onUseDetected={useDetected} />
      </div>

      {current ? (
        <div>
          <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
            <span className="flex items-center gap-1.5 text-xs text-foreground-muted">
              <ZoomIn size={14} aria-hidden="true" /> Lupa: {active === "start" ? "inicio" : "fin"} segundo a segundo
            </span>
            <div className="flex items-center gap-1">
              {[-5, -1].map((d) => (
                <NudgeButton key={d} delta={d} onClick={() => nudge(d)} />
              ))}
              <span className="min-w-[4.5rem] text-center text-sm font-semibold tabular-nums text-foreground-strong" aria-live="polite">
                {formatTimestamp(current[active])}
              </span>
              {[1, 5].map((d) => (
                <NudgeButton key={d} delta={d} onClick={() => nudge(d)} />
              ))}
            </div>
          </div>
          <div
            ref={lupaRef}
            className="relative h-11 cursor-grab touch-none select-none overflow-hidden rounded-lg bg-black/60 active:cursor-grabbing"
            onPointerDown={onLupaPointerDown}
            onPointerMove={onLupaPointerMove}
            onPointerUp={() => { lupaDragRef.current = null; }}
            onPointerCancel={() => { lupaDragRef.current = null; }}
          >
            <div className="flex h-full">
              {lupaTimes.map((t, i) => (
                <img key={`${t}-${i}`} src={thumbnailUrl(uid, t)} alt="" draggable={false} className="h-full min-w-0 flex-1 object-cover" />
              ))}
            </div>
            <div className="pointer-events-none absolute inset-y-0 left-1/2 w-[3px] -translate-x-1/2 bg-red-500" />
          </div>
        </div>
      ) : null}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        {current && duration ? (
          <p className="text-sm text-foreground-muted" data-testid="trim-summary">
            Se quita <span className="font-semibold tabular-nums text-danger">{formatTimestamp(removed)}</span>
            {" · "}Queda <span className="font-semibold tabular-nums text-foreground-strong">{formatTimestamp(duration - removed)}</span>
          </p>
        ) : (
          <span />
        )}
        <div className="flex flex-col-reverse gap-2 sm:flex-row">
          <button
            type="button"
            onClick={preview}
            disabled={!current || submitting}
            className="flex items-center justify-center gap-2 rounded-xl border border-line-subtle bg-ink/5 px-4 py-2.5 text-sm font-bold text-foreground-strong transition-colors hover:bg-ink/10 disabled:opacity-50"
          >
            <Play size={16} aria-hidden="true" /> Ver cómo queda
          </button>
          <button
            type="button"
            onClick={askConfirm}
            disabled={submitting}
            className="flex items-center justify-center gap-2 rounded-xl border border-brand/30 bg-brand/10 px-4 py-2.5 text-sm font-bold text-accent transition-colors hover:bg-brand/20 disabled:opacity-50"
          >
            <Scissors size={16} aria-hidden="true" /> Quitar receso
          </button>
        </div>
      </div>

      {validation && !validation.ok && !error && touched ? (
        <p className="text-sm text-warning">{validation.error}</p>
      ) : null}
      {error ? <p role="alert" className="text-sm text-danger">{error}</p> : null}

      {confirming && current && duration ? (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 sm:p-4" data-testid="trim-confirm">
          <p className="text-sm text-foreground-strong">
            Se quita de <span className="font-semibold tabular-nums">{formatTimestamp(current.start)}</span> a{" "}
            <span className="font-semibold tabular-nums">{formatTimestamp(current.end)}</span>. La clase queda como un solo video de{" "}
            <span className="font-semibold tabular-nums">{formatTimestamp(duration - removed)}</span>.
          </p>
          <p className="mt-1 text-xs text-foreground-muted">Se borra el original de Cloudflare: no se puede deshacer.</p>
          <div className="mt-3 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={() => setConfirming(false)}
              disabled={submitting}
              className="rounded-xl border border-line-subtle bg-ink/5 px-4 py-2 text-sm font-bold text-foreground-strong hover:bg-ink/10 disabled:opacity-50"
            >
              Volver
            </button>
            <button
              type="button"
              onClick={submit}
              disabled={submitting}
              className="flex items-center justify-center gap-2 rounded-xl bg-red-600 px-4 py-2 text-sm font-bold text-white hover:bg-red-500 disabled:opacity-60"
            >
              {submitting ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : <Scissors size={16} aria-hidden="true" />}
              {submitting ? "Enviando..." : "Sí, recortar"}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function NudgeButton({ delta, onClick }: { delta: number; onClick: () => void }) {
  const label = `${delta > 0 ? "+" : "−"}${Math.abs(delta)} s`;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`${delta > 0 ? "Adelante" : "Atrás"} ${Math.abs(delta)} ${Math.abs(delta) === 1 ? "segundo" : "segundos"}`}
      className="min-h-9 rounded-lg border border-line-subtle bg-ink/5 px-2.5 text-xs font-bold tabular-nums text-foreground-strong hover:bg-ink/10"
    >
      {label}
    </button>
  );
}

function DetectionStatus({
  detection,
  touched,
  onUseDetected,
}: {
  detection: Detection;
  touched: boolean;
  onUseDetected: () => void;
}) {
  if (detection.status === "running") {
    return (
      <p className="mt-2 flex items-center gap-2 text-xs text-foreground-muted" aria-live="polite">
        <Loader2 size={14} className="animate-spin" aria-hidden="true" />
        Buscando el receso… {Math.round(detection.progress * 100)} %
      </p>
    );
  }
  if (detection.status === "none") {
    return (
      <p className="mt-2 text-xs text-foreground-muted" aria-live="polite">
        No encontramos la pantalla del receso. Marca el tramo con las manijas.
      </p>
    );
  }
  const { start, end } = detection.range;
  return (
    <p className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-foreground-muted" aria-live="polite">
      <span>
        <Sparkles size={14} className="mr-1 inline align-[-2px] text-accent" aria-hidden="true" />
        Encontramos el receso de <span className="font-semibold tabular-nums text-foreground-strong">{formatTimestamp(start)}</span> a{" "}
        <span className="font-semibold tabular-nums text-foreground-strong">{formatTimestamp(end)}</span>. Revisa los bordes con la lupa.
      </span>
      {touched ? (
        <button type="button" onClick={onUseDetected} className="font-bold text-accent hover:text-accent-hover">
          Volver a lo encontrado
        </button>
      ) : null}
    </p>
  );
}
