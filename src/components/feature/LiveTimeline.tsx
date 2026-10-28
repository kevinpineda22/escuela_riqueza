import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { formatClock, spokenClock } from "@/lib/live/playerTime";

/** Lo que la barra necesita saber en cada cuadro. Posiciones en segundos desde el inicio de la ventana. */
export interface TimelineSnapshot {
  /** Cuánto dura la clase hasta ahora (ventana navegable). */
  span: number;
  position: number;
  /** Hasta dónde hay video descargado, o null si no aplica. */
  bufferedEnd: number | null;
}

/** A menos de esto del final, soltar la barra es "volver al vivo". */
export const LIVE_SNAP_S = 10;
const KEY_STEP_S = 5;
const KEY_PAGE_S = 60;

interface LiveTimelineProps {
  /** Se llama en cada cuadro (requestAnimationFrame): sin re-render de React. null = todavía no se sabe. */
  read: () => TimelineSnapshot | null;
  /** El alumno soltó la barra o usó el teclado. */
  onSeek: (position: number, span: number) => void;
  /** Cualquier interacción: mantener la barra visible, pedir la duración si falta. */
  onActivity?: () => void;
  onDraggingChange?: (dragging: boolean) => void;
}

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

/**
 * Línea de tiempo del vivo, estilo YouTube: se engrosa al pasar el mouse,
 * muestra el minuto donde vas a caer, marca lo descargado y se mueve fluida.
 *
 * Por qué no un <input type="range">: es finito, difícil de agarrar y sin
 * vista previa del tiempo; y su valor por estado de React se actualizaba cada
 * 500 ms, así que la barra avanzaba a saltitos. Acá cada cuadro escribe los
 * estilos directo en el DOM, y el seek se hace UNA vez al soltar (cada seek
 * tira el buffer: buscar mientras se arrastra era lo que trababa).
 */
export function LiveTimeline({ read, onSeek, onActivity, onDraggingChange }: LiveTimelineProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const playedRef = useRef<HTMLDivElement>(null);
  const bufferRef = useRef<HTMLDivElement>(null);
  const thumbRef = useRef<HTMLDivElement>(null);
  const tipRef = useRef<HTMLDivElement>(null);
  const readRef = useRef(read);
  const snapshotRef = useRef<TimelineSnapshot | null>(null);
  const dragPosRef = useRef<number | null>(null);
  const [dragging, setDragging] = useState(false);

  useEffect(() => {
    readRef.current = read;
  });

  // Un cuadro = una lectura y tres anchos. Los atributos de accesibilidad se
  // actualizan una vez por segundo: cada cambio de aria-valuetext se anuncia.
  useEffect(() => {
    let frame = 0;
    let lastAria = 0;
    const tick = (now: number) => {
      const snap = readRef.current();
      snapshotRef.current = snap;
      const root = rootRef.current;
      if (root && playedRef.current && bufferRef.current && thumbRef.current) {
        const span = snap?.span ?? 0;
        const position = dragPosRef.current ?? snap?.position ?? 0;
        // Sin datos todavía: la barra llena (estás en el vivo), como YouTube.
        const playedPct = span > 0 ? clamp(position / span, 0, 1) * 100 : 100;
        const bufferPct = span > 0 && snap?.bufferedEnd != null ? clamp(snap.bufferedEnd / span, 0, 1) * 100 : playedPct;
        playedRef.current.style.width = `${playedPct}%`;
        bufferRef.current.style.width = `${Math.max(bufferPct, playedPct)}%`;
        thumbRef.current.style.left = `${playedPct}%`;
        if (now - lastAria > 1000) {
          lastAria = now;
          root.setAttribute("aria-valuemax", String(Math.round(span)));
          root.setAttribute("aria-valuenow", String(Math.round(position)));
          const behind = Math.max(0, span - position);
          root.setAttribute(
            "aria-valuetext",
            !snap
              ? "En el directo"
              : behind < LIVE_SNAP_S
                ? `${spokenClock(position)} de ${spokenClock(span)}, en el directo`
                : `${spokenClock(position)} de ${spokenClock(span)}, ${spokenClock(behind)} detrás del directo`,
          );
        }
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, []);

  // Las interacciones leen el estado fresco: un toque antes del primer cuadro
  // (o con la pestaña recién visible) no puede caer en un dato viejo.
  const freshSnapshot = (): TimelineSnapshot | null => {
    const snap = readRef.current();
    snapshotRef.current = snap;
    return snap;
  };

  const positionAt = (clientX: number): number | null => {
    const root = rootRef.current;
    const snap = freshSnapshot();
    if (!root || !snap || snap.span <= 0) return null;
    const rect = root.getBoundingClientRect();
    if (rect.width <= 0) return null;
    return clamp((clientX - rect.left) / rect.width, 0, 1) * snap.span;
  };

  const showTip = (clientX: number) => {
    const root = rootRef.current;
    const tip = tipRef.current;
    const snap = freshSnapshot();
    if (!root || !tip) return;
    const rect = root.getBoundingClientRect();
    const pct = rect.width > 0 ? clamp((clientX - rect.left) / rect.width, 0, 1) : 1;
    tip.style.left = `${pct * 100}%`;
    if (!snap || snap.span <= 0) {
      tip.textContent = "En vivo";
      return;
    }
    const position = pct * snap.span;
    tip.textContent = snap.span - position < LIVE_SNAP_S ? "En vivo" : formatClock(position);
  };

  const endDrag = (commit: boolean) => {
    const position = dragPosRef.current;
    const snap = snapshotRef.current;
    dragPosRef.current = null;
    setDragging(false);
    onDraggingChange?.(false);
    if (commit && position != null && snap) onSeek(position, snap.span);
  };

  const handlePointerDown = (e: PointerEvent<HTMLDivElement>) => {
    onActivity?.();
    const position = positionAt(e.clientX);
    // Todavía no se sabe cuánto dura la clase (se está pidiendo): no hay dónde caer.
    if (position == null) return;
    e.currentTarget.setPointerCapture?.(e.pointerId);
    dragPosRef.current = position;
    setDragging(true);
    onDraggingChange?.(true);
    showTip(e.clientX);
  };

  const handlePointerMove = (e: PointerEvent<HTMLDivElement>) => {
    showTip(e.clientX);
    if (dragPosRef.current == null) return;
    const position = positionAt(e.clientX);
    if (position != null) dragPosRef.current = position;
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    onActivity?.();
    if (e.key === "Escape" && dragPosRef.current != null) {
      e.preventDefault();
      endDrag(false);
      return;
    }
    const snap = freshSnapshot();
    if (!snap || snap.span <= 0) return;
    const steps: Record<string, number> = {
      ArrowLeft: -KEY_STEP_S,
      ArrowRight: KEY_STEP_S,
      PageDown: -KEY_PAGE_S,
      PageUp: KEY_PAGE_S,
    };
    let target: number | null = null;
    if (e.key in steps) target = snap.position + steps[e.key];
    else if (e.key === "Home") target = 0;
    else if (e.key === "End") target = snap.span;
    if (target == null) return;
    e.preventDefault();
    onSeek(clamp(target, 0, snap.span), snap.span);
  };

  return (
    <div
      ref={rootRef}
      role="slider"
      tabIndex={0}
      aria-label="Posición en la clase"
      aria-valuemin={0}
      data-dragging={dragging}
      className="group relative flex h-5 w-full cursor-pointer touch-none select-none items-center outline-none focus-visible:ring-2 focus-visible:ring-brand/70 rounded-full"
      onPointerEnter={onActivity}
      onFocus={onActivity}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={() => { if (dragPosRef.current != null) endDrag(true); }}
      onPointerCancel={() => { if (dragPosRef.current != null) endDrag(false); }}
      onKeyDown={handleKeyDown}
    >
      <div className="relative h-1 w-full rounded-full bg-white/25 transition-[height] duration-150 group-hover:h-1.5 group-data-[dragging=true]:h-1.5">
        <div ref={bufferRef} className="absolute inset-y-0 left-0 rounded-full bg-white/40" />
        <div ref={playedRef} className="absolute inset-y-0 left-0 rounded-full bg-brand" />
      </div>
      <div
        ref={thumbRef}
        className="pointer-events-none absolute top-1/2 size-3.5 -translate-x-1/2 -translate-y-1/2 scale-0 rounded-full bg-brand shadow transition-transform duration-150 group-hover:scale-100 group-focus-visible:scale-100 group-data-[dragging=true]:scale-100"
      />
      <div
        ref={tipRef}
        aria-hidden
        className="pointer-events-none absolute bottom-full mb-2 hidden -translate-x-1/2 whitespace-nowrap rounded-md bg-black/85 px-2 py-1 text-xs font-bold tabular-nums text-white group-hover:block group-data-[dragging=true]:block"
      />
    </div>
  );
}
