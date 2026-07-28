import { useEffect, useState } from "react";
import { Loader2, Video } from "lucide-react";
import { fetchRecordingUrl, type LiveEvent } from "@/lib/api/stream/lives";

// Normalizamos el subdominio igual que el player del vivo (VIPLiveRoom): extraemos
// el "code" con regex y reconstruimos la URL canónica. Así el iframe NO se rompe si
// el env viene con `https://`, con `/` al final o solo el code. Antes se usaba el
// valor crudo y un env mal formateado producía `https://https://...` → iframe negro
// (mientras el vivo funcionaba, porque su regex tolera el formato).
const CF_CUSTOMER_CODE =
  (import.meta.env.VITE_CLOUDFLARE_STREAM_CUSTOMER_SUBDOMAIN || "").match(/customer-([^.]+)/)?.[1] || "";
const CF_STREAM_HOST = CF_CUSTOMER_CODE ? `customer-${CF_CUSTOMER_CODE}.cloudflarestream.com` : "";

interface RecordingPlayerProps {
  live: LiveEvent;
}

/**
 * Reproduce la grabación de un live según dónde esté almacenada:
 * - `recording_storage === 'r2'` → <video> con URL firmada de vida corta.
 * - `recording_stream_uid` (legacy) → iframe de Cloudflare Stream.
 */
const RecordingPlayer = ({ live }: RecordingPlayerProps) => {
  const isR2 = live.recording_storage === "r2" && !!live.recording_r2_key;
  const [r2Url, setR2Url] = useState<string | null>(null);
  const [loading, setLoading] = useState(isR2);

  useEffect(() => {
    if (!isR2) return;
    let active = true;
    setLoading(true);
    fetchRecordingUrl(live.id).then((url) => {
      if (!active) return;
      setR2Url(url);
      setLoading(false);
    });
    return () => { active = false; };
  }, [isR2, live.id]);

  if (isR2) {
    if (loading) {
      return (
        <div className="aspect-video bg-black rounded-xl flex items-center justify-center border border-white/10">
          <Loader2 className="animate-spin text-gold" size={28} />
        </div>
      );
    }
    if (!r2Url) {
      return (
        <div className="aspect-video bg-black/40 rounded-xl flex items-center justify-center border border-dashed border-white/10">
          <div className="text-center">
            <Video size={32} className="mx-auto text-white/20 mb-2" />
            <p className="text-sm text-textMuted">No se pudo cargar la grabación</p>
          </div>
        </div>
      );
    }
    return (
      <div className="aspect-video bg-black rounded-xl overflow-hidden border border-white/10">
        <video src={r2Url} controls className="w-full h-full" preload="metadata" />
      </div>
    );
  }

  if (live.recording_stream_uid) {
    if (!CF_STREAM_HOST) {
      return (
        <div className="aspect-video bg-black/40 rounded-xl flex items-center justify-center border border-dashed border-white/10">
          <div className="text-center">
            <Video size={32} className="mx-auto text-white/20 mb-2" />
            <p className="text-sm text-textMuted">Falta configurar <code>VITE_CLOUDFLARE_STREAM_CUSTOMER_SUBDOMAIN</code></p>
          </div>
        </div>
      );
    }
    return (
      <div className="aspect-video bg-black rounded-xl overflow-hidden border border-white/10">
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
