import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Radio } from "lucide-react";
import LiveChat from "@/components/feature/LiveChat";
import { LiveRoom } from "@/components/feature/live-room/LiveRoom";
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
        if (active && !active.allowed_plans?.includes(user.plan)) {
          navigate("/dashboard", { replace: true });
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [user, navigate]);

  // Id de la sala en pantalla, para que Realtime y el polling (closures de
  // montaje) sepan cuál recuperar si finaliza (F33).
  const liveIdRef = useRef<string | null>(null);
  useEffect(() => { liveIdRef.current = live?.id ?? null; }, [live?.id]);

  // Suscripción Realtime a TODA la tabla lives
  useEffect(() => {
    const channel = supabase
      .channel("vip-live-all-changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "lives" },
        async () => {
          const next = await fetchLiveForRoom(liveIdRef.current);
          setLive(next);
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  // Polling 3s como fallback
  useEffect(() => {
    const poll = setInterval(async () => {
      const next = await fetchLiveForRoom(liveIdRef.current);
      setLive(next);
    }, 3000);
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
