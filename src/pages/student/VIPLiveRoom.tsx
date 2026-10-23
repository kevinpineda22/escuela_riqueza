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
import { startPagePolling } from "@/lib/pagePolling";
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
  // Con Realtime conectado, los cambios de la sala llegan solos: el polling
  // queda como red de seguridad y se espacia.
  const [realtimeConnected, setRealtimeConnected] = useState(false);
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
      .subscribe((status) => setRealtimeConnected(status === "SUBSCRIBED"));
    return () => { supabase.removeChannel(channel); };
  }, []);

  // Polling de respaldo: cada 3 s solo si Realtime no conectó; con Realtime, cada
  // 15 s. Con cientos de alumnos, 3 s fijos eran ~100 consultas por segundo a la
  // base durante toda la clase. Con la pestaña oculta no consulta.
  useEffect(
    () => startPagePolling(() => refreshLiveRef.current(), realtimeConnected ? 15000 : 3000),
    [realtimeConnected],
  );

  // Poll Cloudflare Live Input status: si OBS está transmitiendo, mostrar el player aunque la sala no esté "live".
  // Con la sala ya en "live" el player se muestra igual (getLiveRoomStatus), así
  // que la señal no aporta nada: seguir consultando era una llamada a Vercel +
  // Cloudflare por alumno cada 10 s durante toda la clase.
  const isLiveNow = live?.status === "live";
  useEffect(() => {
    if (!live?.stream_live_input_id || isEnded || isLiveNow) return;

    let failCount = 0;
    let stopped = false;

    const check = async () => {
      if (stopped) return;
      const { connected, isError, disabled } = await checkLiveInputStatus(live.stream_live_input_id!);
      if (disabled) { stop(); return; }
      if (isError) {
        failCount++;
        if (failCount >= 3) {
          stop();
          return;
        }
      } else {
        failCount = 0;
      }
      setLiveInputConnected(prev => connected !== prev ? connected : prev);
    };

    const stopPolling = startPagePolling(check, 10000);
    const stop = () => {
      stopped = true;
      stopPolling();
    };
    check();
    return stop;
  }, [live?.id, live?.stream_live_input_id, isEnded, isLiveNow]);

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
        <LiveChat key={live.id} liveId={live.id} onIncomingMessage={onIncomingMessage} showWelcome={live.status === "scheduled"} />
      )}
    />
  );
};

export default VIPLiveRoom;
