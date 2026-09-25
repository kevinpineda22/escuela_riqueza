import { useEffect, useState } from "react";
import { Loader2, VideoOff } from "lucide-react";
import { fetchPublicRecordingUrl, fetchRecordingUrl, type LiveEvent } from "@/lib/api/stream/lives";
import { CF_CUSTOMER_HOST } from "./constants";
import { LiveStageMessage } from "./LiveStageMessage";

interface LiveReplayProps {
  live: LiveEvent;
  /** `share_token` del link público: firma la URL de R2 sin JWT si la sala abrió la repetición. */
  token: string;
  source: "r2" | "stream";
  /**
   * El visitante puede ver la repetición por su plan: pide la URL con sesión
   * (`live_id` + JWT), igual que el dashboard. Si no, la sala la abrió a
   * todos (`replay_is_public`) y se pide la anónima por `share_token`; el
   * servidor vuelve a validar `replay_is_public` antes de firmar.
   */
  entitledByPlan: boolean;
}

/**
 * Grabación de un en vivo finalizado, desde R2 (archivada) o Stream.
 * Montarlo con una `key` que cambie con `source`/`entitledByPlan`: la URL de
 * R2 se pide una vez por montaje.
 */
export function LiveReplay({ live, token, source, entitledByPlan }: LiveReplayProps) {
  // `undefined` = todavía cargando; `null` = no se pudo obtener.
  const [r2Url, setR2Url] = useState<string | null | undefined>(undefined);

  // R2: URL firmada de vida corta.
  useEffect(() => {
    if (source !== "r2") return;
    let active = true;
    const request = entitledByPlan ? fetchRecordingUrl(live.id) : fetchPublicRecordingUrl(token);
    request.then((url) => {
      if (active) setR2Url(url);
    });
    return () => {
      active = false;
    };
  }, [source, token, entitledByPlan, live.id]);

  if (source === "r2") {
    if (r2Url === undefined) return <Loader2 className="w-8 h-8 animate-spin text-accent" />;
    if (r2Url) return <video src={r2Url} controls autoPlay className="w-full h-full max-h-full rounded-2xl bg-black" />;
    return (
      <LiveStageMessage icon={VideoOff} iconClassName="text-fg-20" title="No pudimos cargar la grabación">
        Prueba recargar la página en unos minutos.
      </LiveStageMessage>
    );
  }

  if (!CF_CUSTOMER_HOST) {
    return <LiveStageMessage icon={VideoOff} iconClassName="text-fg-20" title="No pudimos cargar la grabación" />;
  }

  return (
    <iframe
      src={`https://${CF_CUSTOMER_HOST}/${live.recording_stream_uid}/iframe`}
      allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture"
      allowFullScreen
      className="w-full h-full rounded-2xl border-none bg-black"
      title={`Grabación: ${live.title}`}
    />
  );
}
