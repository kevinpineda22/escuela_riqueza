import { useEffect, useRef, useState } from "react";
import { Loader2, Video } from "lucide-react";
import { requestSignedRecordingUrl, type SignedRecordingUrl } from "@/lib/api/stream/lives";
import { SignedVideo } from "./SignedVideo";
import { formatClock, useReplayProgress } from "./useReplayProgress";

// Normalizamos el subdominio igual que el player del vivo (VIPLiveRoom): extraemos
// el "code" con regex y reconstruimos la URL canónica. Así el iframe NO se rompe si
// el env viene con `https://`, con `/` al final o solo el code. Antes se usaba el
// valor crudo y un env mal formateado producía `https://https://...` → iframe negro
// (mientras el vivo funcionaba, porque su regex tolera el formato).
const CF_CUSTOMER_CODE =
  (import.meta.env.VITE_CLOUDFLARE_STREAM_CUSTOMER_SUBDOMAIN || "").match(/customer-([^.]+)/)?.[1] || "";
const CF_STREAM_HOST = CF_CUSTOMER_CODE ? `customer-${CF_CUSTOMER_CODE}.cloudflarestream.com` : "";

/**
 * Datos mínimos para reproducir. `recording_r2_key` es opcional: las RPC de la
 * escuela nunca la devuelven (el servidor firma por `id`), así que `undefined`
 * con storage 'r2' cuenta como grabación en R2; `null` (admin) significa que no hay key.
 */
export interface RecordingSource {
  id: string;
  title: string;
  recording_storage: "stream" | "r2" | null;
  recording_stream_uid: string | null;
  recording_r2_key?: string | null;
}

interface RecordingPlayerProps {
  live: RecordingSource;
  /**
   * Guarda y retoma la posición del alumno (solo grabaciones en R2; las de Stream
   * van en un iframe sin acceso a la posición). Por defecto apagado: lo usan solo
   * las vistas de alumno, no las tarjetas del admin.
   */
  trackProgress?: boolean;
}

/**
 * Reproduce la grabación de un live según dónde esté almacenada:
 * - `recording_storage === 'r2'` → <SignedVideo> con URL firmada de vida corta (se renueva sola).
 * - `recording_stream_uid` (legacy) → iframe de Cloudflare Stream.
 */
const RecordingPlayer = ({ live, trackProgress = false }: RecordingPlayerProps) => {
  const isR2 = live.recording_storage === "r2" && live.recording_r2_key !== null && live.recording_r2_key !== "";
  const [r2Url, setR2Url] = useState<SignedRecordingUrl | null>(null);
  const [loading, setLoading] = useState(isR2);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const progress = useReplayProgress(live.id, isR2 && trackProgress, videoRef);

  useEffect(() => {
    if (!isR2) return;
    let active = true;
    setLoading(true);
    // 401 al pedir la primera URL cae en el mismo estado de error que cualquier fallo.
    requestSignedRecordingUrl(live.id)
      .catch(() => null)
      .then((signed) => {
        if (!active) return;
        setR2Url(signed);
        setLoading(false);
      });
    return () => { active = false; };
  }, [isR2, live.id]);

  if (isR2) {
    if (loading || !progress.ready) {
      return (
        <div className="aspect-video bg-black rounded-xl flex items-center justify-center border border-line-subtle">
          <Loader2 className="animate-spin text-accent" size={28} />
        </div>
      );
    }
    if (!r2Url) {
      return (
        <div className="aspect-video bg-black/40 light:bg-surface-subtle rounded-xl flex items-center justify-center border border-dashed border-line-subtle">
          <div className="text-center">
            <Video size={32} className="mx-auto text-fg-20 light:text-fg-40 mb-2" />
            <p className="text-sm text-foreground-muted">No se pudo cargar la grabación</p>
          </div>
        </div>
      );
    }
    return (
      <div className="space-y-2">
        <div className="aspect-video bg-black rounded-xl overflow-hidden border border-line-subtle">
          <SignedVideo
            ref={videoRef}
            initial={r2Url}
            // Lanza ApiError 401 si la sesión expiró: SignedVideo lo distingue de otros fallos.
            getUrl={() => requestSignedRecordingUrl(live.id)}
            className="w-full h-full"
            preload="metadata"
            startAt={progress.startAt}
            onPlayback={trackProgress ? progress.onPlayback : undefined}
          />
        </div>
        {progress.resumedFrom !== null && (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-line-subtle bg-surface-panel/60 px-3 py-2 text-sm text-foreground-muted">
            <span>Retomando desde {formatClock(progress.resumedFrom)}</span>
            <button
              type="button"
              onClick={progress.restart}
              className="font-medium text-accent transition-colors hover:text-foreground-strong"
            >
              Empezar desde el inicio
            </button>
          </div>
        )}
      </div>
    );
  }

  if (live.recording_stream_uid) {
    if (!CF_STREAM_HOST) {
      return (
        <div className="aspect-video bg-black/40 light:bg-surface-subtle rounded-xl flex items-center justify-center border border-dashed border-line-subtle">
          <div className="text-center">
            <Video size={32} className="mx-auto text-fg-20 light:text-fg-40 mb-2" />
            <p className="text-sm text-foreground-muted">Falta configurar <code>VITE_CLOUDFLARE_STREAM_CUSTOMER_SUBDOMAIN</code></p>
          </div>
        </div>
      );
    }
    return (
      <div className="aspect-video bg-black rounded-xl overflow-hidden border border-line-subtle">
        <iframe
          src={`https://${CF_STREAM_HOST}/${live.recording_stream_uid}/iframe`}
          allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture"
          allowFullScreen
          className="w-full h-full border-none"
          title={`Grabación: ${live.title}`}
        />
      </div>
    );
  }

  return null;
};

export default RecordingPlayer;
