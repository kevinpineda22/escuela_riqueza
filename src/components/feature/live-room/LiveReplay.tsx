import { useEffect, useState } from "react";
import { Loader2, VideoOff } from "lucide-react";
import {
  fetchSignedPublicRecordingUrl,
  fetchSignedRecordingUrl,
  type LiveEvent,
  type SignedRecordingUrl,
} from "@/lib/api/stream/lives";
import { SignedVideo } from "../SignedVideo";
import { CF_CUSTOMER_HOST } from "./constants";
import { LiveStageMessage } from "./LiveStageMessage";

interface LiveReplayProps {
  live: LiveEvent;
  /** `share_token` del link público: firma la URL de R2 sin JWT si la visibilidad es 'all'. */
  token: string;
  source: "r2" | "stream";
  /**
   * Hay sesión iniciada: pide la URL con `live_id` + JWT, igual que el
   * dashboard. Si no, la repetición es 'all' y se pide la anónima por
   * `share_token`; el servidor vuelve a validar `replay_visibility` antes de firmar.
   */
  signedIn: boolean;
}

/**
 * Grabación de un en vivo finalizado, desde R2 (archivada) o Stream.
 * Montarlo con una `key` que cambie con `source`/`signedIn`: la URL de
 * R2 se pide una vez por montaje; `SignedVideo` la renueva cuando vence.
 */
export function LiveReplay({ live, token, source, signedIn }: LiveReplayProps) {
  // `undefined` = todavía cargando; `null` = no se pudo obtener.
  const [r2Url, setR2Url] = useState<SignedRecordingUrl | null | undefined>(undefined);

  // R2: URL firmada de vida corta.
  const requestUrl = () => (signedIn ? fetchSignedRecordingUrl(live.id) : fetchSignedPublicRecordingUrl(token));

  useEffect(() => {
    if (source !== "r2") return;
    let active = true;
    const request = signedIn ? fetchSignedRecordingUrl(live.id) : fetchSignedPublicRecordingUrl(token);
    request.then((signed) => {
      if (active) setR2Url(signed);
    });
    return () => {
      active = false;
    };
  }, [source, token, signedIn, live.id]);

  if (source === "r2") {
    if (r2Url === undefined) return <Loader2 className="w-8 h-8 animate-spin text-accent" />;
    if (r2Url) {
      return (
        <SignedVideo
          initial={r2Url}
          getUrl={requestUrl}
          autoPlay
          className="w-full h-full max-h-full rounded-2xl bg-black"
        />
      );
    }
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
