import { useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { useIsDesktop, useIsShortLandscape } from "@/hooks/useMediaQuery";
import LiveViewersDialog from "@/components/feature/LiveViewersDialog";
import { getLiveRoomLayout } from "./liveRoomLayout";
import { getLiveRoomStatus } from "./liveRoomStatus";
import { useLivePlayback } from "./useLivePlayback";
import { useLivePresence } from "./useLivePresence";
import { LiveChatPanel } from "./LiveChatPanel";
import { LiveChatToggle } from "./LiveChatToggle";
import { LiveIntroOverlay } from "./LiveIntroOverlay";
import { LiveRoomHeader } from "./LiveRoomHeader";
import { LiveStage } from "./LiveStage";
import { LiveStatusBadge } from "./LiveStatusBadge";
import type { ChatMessage } from "@/components/feature/LiveChat";import type { LiveEvent } from "@/lib/api/stream/lives";
import type { User } from "@/types/user";
import type { LiveRoomBackLink, LiveRoomBranding } from "./types";

interface LiveRoomProps {
  live: LiveEvent;
  currentUser: User | null;
  backTo: LiveRoomBackLink;
  branding?: LiveRoomBranding;
  /** Señal de OBS detectada: muestra el player antes de que la sala pase a `live`. */
  signalConnected?: boolean;
  /** Presencia anónima para quien entra sin sesión (sala pública). */
  anonPresenceId?: string;
  cinematicIntro?: boolean;
  /** Grabación a mostrar al finalizar; mientras se muestra no hay chat. */
  replay?: ReactNode;
  /** Reemplaza el mensaje de sala finalizada (ej. paywall de la repetición). */
  endedNotice?: ReactNode;
  /** `null` = sala sin chat. Recibe el callback que cuenta los no leídos. */
  renderChat: ((onIncomingMessage: (msg: ChatMessage) => void) => ReactNode) | null;
}

/**
 * Sala en vivo compartida por la sala VIP y la pública (F37): layout, player,
 * estados, chat plegable y presencia. Cada página solo resuelve de dónde sale
 * la sala y quién puede entrar.
 */
export function LiveRoom({
  live,
  currentUser,
  backTo,
  branding = {},
  signalConnected = false,
  anonPresenceId,
  cinematicIntro = false,
  replay,
  endedNotice,
  renderChat,
}: LiveRoomProps) {
  const layout = getLiveRoomLayout(useIsDesktop(), useIsShortLandscape());
  const sideBySide = layout !== "stacked";
  const status = getLiveRoomStatus(live, signalConnected);
  const [playerRef, playback] = useLivePlayback();
  // Sin presencia en una sala finalizada: no hay "conectados" a algo que terminó.
  const presence = useLivePresence({ liveId: live.id, user: currentUser, anonId: anonPresenceId, enabled: !status.isEnded });
  const [showViewersList, setShowViewersList] = useState(false);
  // Un estado por layout: al rotar a horizontal el chat arranca cerrado (el
  // video manda) y al volver a pantalla amplia conserva lo que eligió el alumno.
  const [sideChatOpen, setSideChatOpen] = useState(true);
  const [compactChatOpen, setCompactChatOpen] = useState(false);
  const chatOpen = layout === "compact" ? compactChatOpen : sideChatOpen;
  const [unreadCount, setUnreadCount] = useState(0);

  const toggleChat = () => {
    if (layout === "compact") setCompactChatOpen((v) => !v);
    else setSideChatOpen((v) => !v);
    // Mostrar u ocultar arranca la cuenta de cero: lo pendiente ya se ve.
    setUnreadCount(0);
  };

  const handleIncomingMessage = (msg: ChatMessage) => {
    if (msg.isSystem || msg.user_id === currentUser?.id) return;
    // Solo se cuentan mientras el chat lateral está cerrado.
    if (sideBySide && !chatOpen) setUnreadCount((c) => c + 1);
  };

  const chat = renderChat ? renderChat(handleIncomingMessage) : null;
  // F12: en celular vertical, con el video al aire, el escenario toma la
  // proporción del video y el chat se queda con el resto. Antes el video vivía
  // en `50dvh` fijo: en un 390×844 eran ~200 px de franja negra robados al chat.
  const fitToVideo = layout === "stacked" && Boolean(chat) && status.showPlayer;

  return (
    <div
      className={cn(
        "h-[100dvh] bg-black light:bg-surface-page text-foreground flex overflow-hidden font-sans",
        sideBySide ? "flex-row" : "flex-col"
      )}
    >
      {/* Isla oscura: escenario, intro, countdown y controles son iguales en ambos
          temas (spec §3.4). El chat y la lista de conectados, afuera, sí se adaptan.
          Lado a lado toma el alto de la fila (100dvh): con `100vh` Safari la hacía
          más alta que lo visible y cortaba los controles en horizontal (F42). */}
      <div
        data-theme="dark"
        className={cn(
          "flex flex-col relative min-w-0",
          sideBySide || !chat ? "flex-1" : fitToVideo ? "shrink-0" : "h-[50dvh] shrink-0"
        )}
      >
        {cinematicIntro && <LiveIntroOverlay liveId={live.id} status={live.status} />}

        <LiveRoomHeader
          title={live.title || "Sesión de Riqueza"}
          titleSuffix={branding.titleSuffix}
          subtitle={branding.subtitle}
          backTo={backTo}
          badge={<LiveStatusBadge status={status} hasReplay={Boolean(replay)} />}
          viewersCount={status.isEnded ? 0 : presence.totalViewers}
          onOpenViewers={() => setShowViewersList(true)}
          variant={layout === "side" ? "overlay" : layout === "compact" ? "compact" : "bar"}
        />

        <LiveStage
          live={live}
          status={status}
          playerRef={playerRef}
          playback={playback}
          replay={replay}
          endedNotice={endedNotice}
          waitingLabel={branding.waitingLabel}
          waitingTitleFallback={branding.waitingTitleFallback ?? "Próximo encuentro"}
          fitToVideo={fitToVideo}
          compact={layout === "compact"}
        />

        {sideBySide && chat && (
          <LiveChatToggle
            chatVisible={chatOpen}
            unreadCount={unreadCount}
            onToggle={toggleChat}
          />
        )}
      </div>

      {chat && (
        <LiveChatPanel layout={layout} open={chatOpen}>
          {chat}
        </LiveChatPanel>
      )}

      <LiveViewersDialog
        open={showViewersList}
        onOpenChange={setShowViewersList}
        viewers={presence.viewers}
        totalViewers={presence.totalViewers}
        currentUserId={currentUser?.id}
      />
    </div>
  );
}
