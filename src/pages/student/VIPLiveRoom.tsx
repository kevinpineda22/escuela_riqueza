import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Radio, WifiOff } from "lucide-react";
import LiveChat from "@/components/feature/LiveChat";
import { LiveRoom } from "@/components/feature/live-room/LiveRoom";
import { isSameLive } from "@/components/feature/live-room/liveRoomStatus";
import { LiveRoomLoading } from "@/components/feature/live-room/LiveRoomLoading";
import { usePlayerStore } from "@/stores/player.store";
import { useAuthStore } from "@/stores/auth.store";
import { supabase } from "@/lib/supabase";
import { fetchActiveLive, fetchLiveForRoom, checkLiveInputStatus, type LiveEvent } from "@/lib/api/stream/lives";
import type { LiveRoomBranding } from "@/components/feature/live-room/types";

const VIP_BRANDING: LiveRoomBranding = {
  titleSuffix: "VIP",
  subtitle: "Encuentro con Iván Mazo",
  waitingLabel: "Próximo Encuentro VIP",
  waitingTitleFallback: (
    <>
      El conocimiento es la<br />
      <span className="text-transparent bg-clip-text bg-gradient-to-r from-brand via-brand-hover to-brand">
        moneda definitiva
      </span>
    </>
  ),
};

/**
 * Sala VIP: la sala activa del plan del alumno. Resuelve el acceso y el estado
 * de la sala (Realtime + polling + señal de OBS); la presentación es `LiveRoom`,
 * compartida con la sala pública.
 */
const VIPLiveRoom = () => {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [live, setLive] = useState<LiveEvent | null>(null);
  const [loading, setLoading] = useState(true);
  // F16: un fallo de la primera carga se mostraba como "No hay eventos
  // programados" — mentira cuando lo que falló fue la conexión.
  const [loadError, setLoadError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [liveInputConnected, setLiveInputConnected] = useState(false);
  const { clearPlayer } = usePlayerStore();

  const isEnded = live?.status === "ended";

  useEffect(() => { clearPlayer(); }, [clearPlayer]);

  // Fetch active live on mount + validate plan access
  useEffect(() => {
    if (!user) return;
    fetchActiveLive()
      .then(active => {
        setLive(active);
        setLoadError(false);
        if (active && !active.allowed_plans?.includes(user.plan)) {
          navigate("/dashboard", { replace: true });
        }
      })
      .catch((err) => {
        console.error("[VIPLiveRoom] error cargando la sala:", err);
        setLoadError(true);
      })
      .finally(() => setLoading(false));
  }, [user, navigate, reloadKey]);

  // Id de la sala en pantalla, para que Realtime y el polling (closures de
  // montaje) sepan cuál recuperar si finaliza (F33).
  const liveIdRef = useRef<string | null>(null);
  useEffect(() => { liveIdRef.current = live?.id ?? null; }, [live?.id]);

  const retryLoad = () => {
    setLoading(true);
    setReloadKey((k) => k + 1);
  };

  // Realtime y polling: una respuesta buena reemplaza la sala y apaga el error;
  // un fallo transitorio (4G, Supabase bajo carga) conserva la última conocida
  // en vez de dejar una promesa rechazada sin capturar.
  const refreshLive = async () => {
    try {
      const next = await fetchLiveForRoom(liveIdRef.current);
      setLive((prev) => (isSameLive(prev, next) ? prev : next));
      setLoadError(false);
    } catch (err) {
      console.warn("[VIPLiveRoom] no se pudo actualizar la sala:", err);
    }
  };
  const refreshLiveRef = useRef(refreshLive);
  useEffect(() => { refreshLiveRef.current = refreshLive; });

  // Suscripción Realtime a TODA la tabla lives
  useEffect(() => {
    const channel = supabase
      .channel("vip-live-all-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "lives" }, () => refreshLiveRef.current())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  // Polling 3s como fallback
  useEffect(() => {
    const poll = setInterval(() => refreshLiveRef.current(), 3000);
    return () => clearInterval(poll);
  }, []);

  // Poll Cloudflare Live Input status: si OBS está transmitiendo, mostrar el player aunque la sala no esté "live"
  useEffect(() => {
    if (!live?.stream_live_input_id || isEnded) return;

    let failCount = 0;

    const check = async () => {
      const { connected, isError, disabled } = await checkLiveInputStatus(live.stream_live_input_id!);
      if (disabled) { clearInterval(poll); return; }
      if (isError) {
        failCount++;
        if (failCount >= 3) {
          clearInterval(poll);
          return;
        }
      } else {
        failCount = 0;
      }
      setLiveInputConnected(prev => connected !== prev ? connected : prev);
    };

    const poll = setInterval(check, 10000);
    check();
    return () => clearInterval(poll);
  }, [live?.id, live?.stream_live_input_id, isEnded]);

  if (loading) return <LiveRoomLoading />;

  // Error primero: sin datos no se sabe si hay clase, y decir "no hay eventos"
  // mandaba al alumno a irse de una clase que sí estaba ocurriendo.
  if (!live && loadError) {
    return (
      <div className="min-h-screen bg-black light:bg-surface-page flex items-center justify-center p-6">
        <div className="text-center max-w-md">
          <WifiOff size={48} className="mx-auto text-fg-20 mb-6" />
          <h2 className="text-2xl font-bold text-foreground-strong mb-2">No pudimos cargar la sala</h2>
          <p className="text-foreground-muted mb-6">Revisa tu conexión. Seguimos intentando en segundo plano.</p>
          <button
            onClick={retryLoad}
            className="px-6 py-3 rounded-full bg-brand hover:bg-brand-hover text-on-brand font-black tracking-wide transition-colors"
          >
            Reintentar
          </button>
        </div>
      </div>
    );
  }

  if (!live) {
    return (
      <div className="min-h-screen bg-black light:bg-surface-page flex items-center justify-center p-6">
        <div className="text-center max-w-md">
          <Radio size={48} className="mx-auto text-fg-20 mb-6" />
          <h2 className="text-2xl font-bold text-foreground-strong mb-2">No hay eventos programados</h2>
          <p className="text-foreground-muted">Los próximos encuentros VIP aparecerán aquí. Vuelve pronto.</p>
        </div>
      </div>
    );
  }

  return (
    <LiveRoom
      // F17: otra sala = estado nuevo (audio, calidad, no leídos, player).
      key={live.id}
      live={live}
      currentUser={user}
      backTo={{ path: "/dashboard", label: "Volver al dashboard" }}
      branding={VIP_BRANDING}
      signalConnected={liveInputConnected}
      cinematicIntro
      renderChat={(onIncomingMessage) => (
        <LiveChat liveId={live.id} onIncomingMessage={onIncomingMessage} showWelcome={live.status === "scheduled"} />
      )}
    />
  );
};

export default VIPLiveRoom;
