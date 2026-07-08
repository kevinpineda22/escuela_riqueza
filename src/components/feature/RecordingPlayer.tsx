import { useEffect, useState } from "react";
import { Loader2, Video } from "lucide-react";
import { fetchRecordingUrl, type LiveEvent } from "@/lib/api/stream/lives";

const CF_SUBDOMAIN = import.meta.env.VITE_CLOUDFLARE_STREAM_CUSTOMER_SUBDOMAIN || "";

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
    return (
      <div className="aspect-video bg-black rounded-xl overflow-hidden border border-white/10">
        <iframe
          src={`https://${CF_SUBDOMAIN}/${live.recording_stream_uid}/iframe`}
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
