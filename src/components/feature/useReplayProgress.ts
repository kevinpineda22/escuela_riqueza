import { useEffect, useRef, useState, type RefObject } from "react";
import type { PlaybackEventType } from "./SignedVideo";
import { getReplayProgress, saveReplayProgress } from "@/lib/api/stream/replayProgress";

/** Cada cuánto se guarda la posición mientras se reproduce. */
const SAVE_INTERVAL_MS = 10_000;
/** Mínimo entre guardados disparados por saltos en la barra. */
const SEEK_SAVE_GAP_MS = 3_000;
/** Por debajo de esta posición no se guarda (salvo reinicio deliberado). */
const MIN_SAVE_SECONDS = 5;
/** Solo se retoma si el alumno pasó de esta posición... */
const MIN_RESUME_SECONDS = 10;
/** ...y le faltan más de estos segundos para terminar. */
const END_MARGIN_SECONDS = 30;

interface Snapshot {
  time: number;
  duration: number;
}

interface LoadedProgress {
  liveId: string;
  startAt: number;
}

/** h:mm:ss (o m:ss si dura menos de una hora). */
export function formatClock(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = String(s % 60).padStart(2, "0");
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${sec}` : `${m}:${sec}`;
}

/** Posición desde la que arrancar: 0 si es muy corta, ya casi terminó o no hay datos. */
function resumeStart(position: number, duration: number | null): number {
  if (position <= MIN_RESUME_SECONDS) return 0;
  if (duration && position >= duration - END_MARGIN_SECONDS) return 0;
  return position;
}

/**
 * Progreso de una grabación: carga la posición guardada, la aplica una sola vez
 * (`startAt`) y guarda cada 10 s, al pausar, al saltar, al ocultar/cerrar la pestaña
 * y al desmontar. Con `enabled = false` no lee ni escribe nada. `videoRef` apunta al
 * `<video>` (lo usa «Empezar desde el inicio»).
 */
export function useReplayProgress(liveId: string, enabled: boolean, videoRef: RefObject<HTMLVideoElement | null>) {
  const [loaded, setLoaded] = useState<LoadedProgress | null>(null);
  const [dismissedFor, setDismissedFor] = useState<string | null>(null);

  const latestRef = useRef<Snapshot | null>(null);
  const lastSavedAtRef = useRef(0);
  const lastSavedTimeRef = useRef<number | null>(null);
  const persistRef = useRef<(snap: Snapshot | null, allowLow?: boolean) => void>(() => {});

  useEffect(() => {
    if (!enabled) return;
    let active = true;
    getReplayProgress(liveId)
      .then((row) => (row ? resumeStart(row.position_seconds, row.duration_seconds) : 0))
      .catch(() => 0)
      .then((startAt) => {
        if (active) setLoaded({ liveId, startAt });
      });
    return () => {
      active = false;
    };
  }, [liveId, enabled]);

  useEffect(() => {
    if (!enabled) return;
    lastSavedAtRef.current = 0;
    lastSavedTimeRef.current = null;
    latestRef.current = null;

    const persist = (snap: Snapshot | null, allowLow = false) => {
      if (!snap) return;
      const time = Math.floor(snap.time);
      if (!allowLow && time < MIN_SAVE_SECONDS) return;
      if (time === lastSavedTimeRef.current) return;
      lastSavedTimeRef.current = time;
      lastSavedAtRef.current = Date.now();
      void saveReplayProgress(liveId, time, snap.duration).catch(() => {});
    };
    persistRef.current = persist;

    const flush = () => persist(latestRef.current);
    const onVisibility = () => {
      if (document.visibilityState === "hidden") flush();
    };
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", flush);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", flush);
      flush();
    };
  }, [liveId, enabled]);

  const onPlayback = (type: PlaybackEventType, video: HTMLVideoElement) => {
    if (!enabled) return;
    const snap = { time: video.currentTime, duration: video.duration };
    latestRef.current = snap;
    const sinceLast = Date.now() - lastSavedAtRef.current;
    if (type === "timeupdate") {
      if (sinceLast >= SAVE_INTERVAL_MS) persistRef.current(snap);
    } else if (type === "seeked") {
      if (sinceLast >= SEEK_SAVE_GAP_MS) persistRef.current(snap);
    } else {
      persistRef.current(snap);
    }
  };

  /** «Empezar desde el inicio»: salta a 0, guarda 0 y oculta el aviso. */
  const restart = () => {
    const video = videoRef.current;
    if (video) video.currentTime = 0;
    setDismissedFor(liveId);
    const duration = video?.duration ?? latestRef.current?.duration ?? 0;
    latestRef.current = { time: 0, duration };
    persistRef.current(latestRef.current, true);
  };

  const ready = !enabled || loaded?.liveId === liveId;
  const startAt = enabled && loaded?.liveId === liveId ? loaded.startAt : 0;
  const resumedFrom = startAt > 0 && dismissedFor !== liveId ? startAt : null;

  return { ready, startAt, resumedFrom, onPlayback, restart };
}
