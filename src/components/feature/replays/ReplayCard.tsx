import { Link } from "react-router-dom";
import { Clock, Lock, PlayCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { SchoolReplay } from "@/lib/api/stream/replays";
import { formatReplayDate, formatReplayDuration } from "./format";

interface ReplayCardProps {
  replay: SchoolReplay;
}

/**
 * Tarjeta de una grabación. Reproducible: enlaza a /grabaciones/:id.
 * Bloqueada (plan insuficiente): muestra el candado y un CTA hacia /planes.
 */
export function ReplayCard({ replay }: ReplayCardProps) {
  const duration = formatReplayDuration(replay.recording_duration_seconds);
  const locked = !replay.can_watch;

  const thumbnail = (
    <div className="relative aspect-video overflow-hidden rounded-xl bg-gradient-to-br from-brand/15 via-black/40 to-black/60 light:from-brand/10 light:via-surface-subtle light:to-surface-panel">
      {replay.background_image_url ? (
        <img
          src={replay.background_image_url}
          alt=""
          loading="lazy"
          className={cn("h-full w-full object-cover", locked && "opacity-50 blur-[1px]")}
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center">
          <PlayCircle size={40} className="text-accent/50" aria-hidden="true" />
        </div>
      )}
      {locked ? (
        <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-full bg-black/70 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-accent">
          <Lock size={12} aria-hidden="true" /> Bloqueada
        </span>
      ) : (
        <span className="absolute inset-0 flex items-center justify-center bg-black/0 opacity-0 transition-all group-hover:bg-black/30 group-hover:opacity-100">
          <PlayCircle size={44} className="text-white" aria-hidden="true" />
        </span>
      )}
    </div>
  );

  const details = (
    <div className="mt-3 space-y-1">
      <h4 className="line-clamp-2 text-sm font-bold text-foreground-strong sm:text-base">{replay.title}</h4>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-foreground-muted">
        <span>{formatReplayDate(replay.starts_at)}</span>
        {duration && (
          <span className="inline-flex items-center gap-1">
            <Clock size={12} aria-hidden="true" /> {duration}
          </span>
        )}
      </div>
    </div>
  );

  const shell =
    "group block rounded-2xl border border-line-subtle bg-surface-panel/60 p-3 transition-colors sm:p-4";

  if (!locked) {
    return (
      <Link
        to={`/grabaciones/${replay.id}`}
        aria-label={`Ver grabación: ${replay.title}`}
        className={cn(shell, "hover:border-brand/40")}
      >
        {thumbnail}
        {details}
      </Link>
    );
  }

  return (
    <div className={shell}>
      {thumbnail}
      {details}
      <p className="mt-3 text-xs text-foreground-muted">Disponible en planes Individual y VIP</p>
      <Link
        to="/planes"
        className="mt-2 inline-flex items-center gap-1.5 rounded-xl border border-brand/30 bg-brand/10 px-3 py-2 text-xs font-bold text-accent transition-colors hover:bg-brand/20"
      >
        Ver planes
      </Link>
    </div>
  );
}
