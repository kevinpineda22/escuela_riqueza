import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Loader2, Lock, SearchX } from "lucide-react";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import RecordingPlayer from "@/components/feature/RecordingPlayer";
import { formatReplayDate, formatReplayDuration } from "@/components/feature/replays/format";
import { getSchoolReplay, type SchoolReplay } from "@/lib/api/stream/replays";

const BACK_TO_TAB = "/dashboard?tab=grabaciones";

type ResolvedView =
  | { kind: "error" }
  | { kind: "missing" }
  | { kind: "locked"; replay: SchoolReplay }
  | { kind: "ready"; replay: SchoolReplay };

type ViewState = { kind: "loading" } | ResolvedView;

interface MessageProps {
  icon: typeof Lock;
  title: string;
  text: string;
  cta?: { to: string; label: string };
}

const Message = ({ icon: Icon, title, text, cta }: MessageProps) => (
  <div className="flex flex-col items-center gap-3 rounded-2xl border border-line-subtle bg-surface-panel/60 px-5 py-12 text-center">
    <Icon size={32} className="text-accent" aria-hidden="true" />
    <h2 className="text-lg font-bold text-foreground-strong">{title}</h2>
    <p className="max-w-md text-sm text-foreground-muted">{text}</p>
    {cta && (
      <Link
        to={cta.to}
        className="mt-1 rounded-xl border border-brand/30 bg-brand/10 px-4 py-2 text-sm font-bold text-accent transition-colors hover:bg-brand/20"
      >
        {cta.label}
      </Link>
    )}
  </div>
);

/** Vista de una grabación de la escuela: /grabaciones/:liveId. */
const ReplayViewer = () => {
  const { liveId } = useParams<{ liveId: string }>();
  // El resultado se guarda junto al id que lo originó: mientras no coincida con
  // la ruta actual, la vista está cargando (sin setState síncrono en el efecto).
  const [resolved, setResolved] = useState<{ id: string; view: ResolvedView } | null>(null);

  useEffect(() => {
    if (!liveId) return;
    let active = true;
    getSchoolReplay(liveId)
      .then((replay) => {
        if (!active) return;
        const view: ResolvedView = !replay
          ? { kind: "missing" }
          : { kind: replay.can_watch ? "ready" : "locked", replay };
        setResolved({ id: liveId, view });
      })
      .catch(() => {
        if (active) setResolved({ id: liveId, view: { kind: "error" } });
      });
    return () => {
      active = false;
    };
  }, [liveId]);

  const state: ViewState = !liveId
    ? { kind: "missing" }
    : resolved?.id === liveId
      ? resolved.view
      : { kind: "loading" };

  const duration = state.kind === "ready" ? formatReplayDuration(state.replay.recording_duration_seconds) : null;

  return (
    <div className="flex min-h-screen flex-col bg-surface-page font-sans text-foreground">
      <Header />
      <main className="mx-auto w-full max-w-5xl flex-1 space-y-6 px-4 py-6 sm:px-6 sm:py-10">
        <Link
          to={BACK_TO_TAB}
          className="inline-flex items-center gap-2 text-sm font-medium text-foreground-muted transition-colors hover:text-foreground-strong"
        >
          <ArrowLeft size={16} aria-hidden="true" /> Volver a grabaciones
        </Link>

        {state.kind === "loading" && (
          <div role="status" aria-label="Cargando grabación" className="flex justify-center py-24">
            <Loader2 className="animate-spin text-accent" size={28} />
          </div>
        )}

        {state.kind === "error" && (
          <Message icon={SearchX} title="No se pudo cargar la grabación" text="Revisa tu conexión e inténtalo de nuevo." cta={{ to: BACK_TO_TAB, label: "Volver a grabaciones" }} />
        )}

        {state.kind === "missing" && (
          <Message icon={SearchX} title="Grabación no encontrada" text="Esta grabación no existe o ya no está disponible." cta={{ to: BACK_TO_TAB, label: "Volver a grabaciones" }} />
        )}

        {state.kind === "locked" && (
          <Message
            icon={Lock}
            title={state.replay.title}
            text="Esta grabación está disponible en los planes Individual y VIP."
            cta={{ to: "/planes", label: "Ver planes" }}
          />
        )}

        {state.kind === "ready" && (
          <article className="space-y-4">
            <RecordingPlayer live={state.replay} trackProgress />
            <div className="space-y-2">
              <h1 className="text-xl font-bold text-foreground-strong sm:text-2xl">{state.replay.title}</h1>
              <p className="text-xs text-foreground-muted">
                {formatReplayDate(state.replay.starts_at)}
                {duration ? ` · ${duration}` : ""}
              </p>
              {state.replay.description && (
                <p className="whitespace-pre-line text-sm text-foreground-muted">{state.replay.description}</p>
              )}
            </div>
          </article>
        )}
      </main>
      <Footer />
    </div>
  );
};

export default ReplayViewer;
