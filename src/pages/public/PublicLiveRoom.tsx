import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Radio } from "lucide-react";
import LiveChat from "@/components/feature/LiveChat";
import PublicLiveChat from "@/components/feature/PublicLiveChat";
import { LiveRoom } from "@/components/feature/live-room/LiveRoom";
import { LiveRoomLoading } from "@/components/feature/live-room/LiveRoomLoading";
import { LiveReplay } from "@/components/feature/live-room/LiveReplay";
import { LiveReplayPaywall } from "@/components/feature/live-room/LiveReplayPaywall";
import { getPublicLive, publicLiveHasRecording, type LiveEvent } from "@/lib/api/stream/lives";
import { canWatchReplay } from "@/lib/plans";
import { useAuthStore } from "@/stores/auth.store";

const POLL_INTERVAL_MS = 3000;
const ANON_ID_STORAGE_KEY = "public-live-anon-id";

function getOrCreateAnonId(): string {
  try {
    const existing = sessionStorage.getItem(ANON_ID_STORAGE_KEY);
    if (existing) return existing;
    const generated = crypto.randomUUID();
    sessionStorage.setItem(ANON_ID_STORAGE_KEY, generated);
    return generated;
  } catch {
    // sessionStorage bloqueado (modo privado estricto) — id efímero por render.
    return crypto.randomUUID();
  }
}

/**
 * Sala pública de un live: sin login, sin verificación de plan. La presentación
 * es `LiveRoom`, compartida con la sala VIP. El estado se obtiene únicamente vía
 * polling de `get_public_live` — Realtime en `lives` no está garantizado para
 * clientes anónimos. Con sesión iniciada, la presencia y el chat son los de la
 * sala VIP.
 *
 * El EN VIVO es público para cualquiera. La REPETICIÓN no: es contenido de
 * los planes Individual/VIP (`canWatchReplay`), salvo que el admin abra ESTA
 * sala con `replay_is_public`. Finalizado el en vivo, si hay grabación y el
 * visitante está habilitado se muestra el replay (sin chat ni presencia); si
 * no, un paywall. `get_public_live` ya anula `recording_stream_uid` /
 * `recording_r2_key` para quien no está habilitado (ver
 * sql/migrate-public-live-replay-paid.sql).
 */
const PublicLiveRoom = () => {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const sessionUser = useAuthStore((state) => state.user);
  const [live, setLive] = useState<LiveEvent | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [anonId] = useState(getOrCreateAnonId);

  const isEnded = live?.status === "ended";
  // Distingue por qué puede ver la repetición: entitlement de plan (pide la
  // URL con sesión) vs. sala abierta a todos (pide la URL anónima). Alguien
  // con plan pago en una sala abierta usa la rama autenticada, la más específica.
  const entitledByPlan = canWatchReplay(sessionUser?.plan, sessionUser?.role);
  const canReplay = entitledByPlan || live?.replay_is_public === true;

  // `get_public_live` anula las columnas de la grabación para quien no está
  // habilitado, así que desde la fila no se distingue "sin grabación todavía"
  // de "grabación bloqueada por plan". Para eso está `publicLiveHasRecording`
  // (boolean puro, no revela el id) — ver sql/migrate-public-live-has-recording.sql.
  // La respuesta se guarda con su token: si cambia la condición, se ignora.
  const needsRecordingCheck = isEnded && !canReplay;
  const [recordingCheck, setRecordingCheck] = useState<{ token: string; hasRecording: boolean } | null>(null);
  useEffect(() => {
    if (!token || !needsRecordingCheck) return;
    let active = true;
    publicLiveHasRecording(token).then((hasRecording) => {
      if (active) setRecordingCheck({ token, hasRecording });
    });
    return () => {
      active = false;
    };
  }, [token, needsRecordingCheck]);
  const showReplayPaywall =
    needsRecordingCheck && recordingCheck !== null && recordingCheck.token === token && recordingCheck.hasRecording;

  // Fetch inicial + polling: única fuente de verdad del estado de la sala.
  useEffect(() => {
    if (!token) return;
    let isActive = true;

    // Un poll fallido (4G inestable, timeout de Supabase bajo carga) NO expulsa
    // al espectador: conservamos la última sala conocida y seguimos intentando.
    // Solo mostramos "no disponible" cuando la RPC responde OK sin fila dos
    // veces seguidas (link desactivado por el admin), nunca por un error.
    let consecutiveMisses = 0;
    let consecutiveErrors = 0;

    const load = async () => {
      try {
        const result = await getPublicLive(token);
        if (!isActive) return;
        consecutiveErrors = 0;
        if (!result) {
          consecutiveMisses += 1;
          // Un primer vacío todavía no dice nada: el spinner sigue hasta
          // confirmarlo. Soltarlo aquí mostraba "No pudimos conectar" (problema
          // de red) durante un poll, aunque la red anduviera bien.
          if (consecutiveMisses >= 2) {
            setNotFound(true);
            setLoading(false);
          }
        } else {
          consecutiveMisses = 0;
          setNotFound(false);
          setLive(result);
          setLoading(false);
        }
      } catch (err) {
        console.error("[PublicLiveRoom] error fetching public live:", err);
        if (!isActive) return;
        consecutiveErrors += 1;
        // Sin sala cargada y muchos errores seguidos: soltamos el spinner para
        // que el usuario vea la pantalla de "no disponible" con su botón, pero
        // el polling sigue vivo y la recupera sola si la red vuelve.
        if (consecutiveErrors >= 5) setLoading(false);
      }
    };

    load();
    const poll = setInterval(load, POLL_INTERVAL_MS);
    return () => {
      isActive = false;
      clearInterval(poll);
    };
  }, [token]);

  if (loading) return <LiveRoomLoading />;

  if (notFound || !live || !token) {
    // `notFound`: la RPC respondió sin fila (link desactivado). `!live` sin
    // notFound: nunca pudimos cargar por errores de red — ofrecer reintento.
    const isConnectionIssue = !notFound;
    return (
      <div className="min-h-screen bg-black light:bg-surface-page flex items-center justify-center p-6">
        <div className="text-center max-w-md">
          <Radio size={48} className="mx-auto text-fg-20 mb-6" />
          <h2 className="text-2xl font-bold text-foreground-strong mb-2">
            {isConnectionIssue ? "No pudimos conectar con el en vivo" : "Este en vivo no está disponible"}
          </h2>
          <p className="text-foreground-muted mb-6">
            {isConnectionIssue
              ? "Revisa tu conexión. Seguimos intentando en segundo plano."
              : "El link puede haber expirado o el en vivo ya no es público."}
          </p>
          <button
            onClick={() => (isConnectionIssue ? window.location.reload() : navigate("/"))}
            className="px-6 py-3 rounded-full bg-brand hover:bg-brand-hover text-on-brand font-black tracking-wide transition-colors"
          >
            {isConnectionIssue ? "Reintentar" : "Ir al inicio"}
          </button>
        </div>
      </div>
    );
  }

  // Replay: prioriza R2 (igual criterio que `RecordingPlayer` del panel admin)
  // sobre Stream — si hay `recording_r2_key`, la grabación ya fue archivada.
  // Solo para quien puede verla: si no, se muestra el paywall en su lugar.
  const replaySource = !isEnded || !canReplay
    ? null
    : live.recording_storage === "r2" && live.recording_r2_key
      ? "r2"
      : live.recording_stream_uid
        ? "stream"
        : null;

  const loginPath = `/login?returnTo=${encodeURIComponent(`/live/${token}`)}`;

  return (
    <LiveRoom
      live={live}
      currentUser={sessionUser}
      backTo={{ path: "/", label: "Volver al inicio" }}
      anonPresenceId={anonId}
      replay={
        replaySource ? (
          <LiveReplay
            key={`${replaySource}-${entitledByPlan}`}
            live={live}
            token={token}
            source={replaySource}
            entitledByPlan={entitledByPlan}
          />
        ) : undefined
      }
      endedNotice={
        showReplayPaywall ? (
          <LiveReplayPaywall title={live.title || "Sesión de Riqueza"} loggedIn={Boolean(sessionUser)} loginPath={loginPath} />
        ) : undefined
      }
      // Con sesión iniciada (llegó por el link y se logueó para participar) se
      // usa el chat completo, que ya sabe escribir; sin sesión, el de solo
      // lectura. En replay y en el paywall de repetición no hay chat.
      renderChat={
        replaySource || showReplayPaywall
          ? null
          : (onIncomingMessage) =>
              sessionUser ? (
                <LiveChat liveId={live.id} onIncomingMessage={onIncomingMessage} showWelcome={live.status === "scheduled"} />
              ) : (
                <PublicLiveChat token={token} loginPath={loginPath} showWelcome={live.status === "scheduled"} />
              )
      }
    />
  );
};

export default PublicLiveRoom;
