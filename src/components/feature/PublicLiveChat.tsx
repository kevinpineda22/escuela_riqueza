import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "motion/react";
import { Users, ShieldCheck, LogIn } from "lucide-react";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { ChatJumpToLatest } from "@/components/feature/ChatJumpToLatest";
import { useChatScroll } from "@/hooks/useChatScroll";
import { getPublicLiveMessages, type PublicChatMessage } from "@/lib/api/stream/lives";
import { mergeMessagesById } from "@/lib/chat/mergeMessagesById";
import { MessageReactions } from "@/components/feature/chat/MessageReactions";
import { fetchPublicLiveReactions, type ReactionsByMessage } from "@/lib/api/stream/reactions";

interface PublicLiveChatProps {
  token: string;
  loginPath: string;
  /** Mensaje de bienvenida fijado; solo tiene sentido antes de que arranque el vivo. */
  showWelcome?: boolean;
}

const SYSTEM_MESSAGE: PublicChatMessage = {
  id: "system-1",
  user_id: "system",
  user_name: "Iván Mazo",
  message: "¡Bienvenidos a este encuentro exclusivo! Iniciamos en instantes.",
  created_at: new Date(0).toISOString(),
};

const POLL_INTERVAL_MS = 4000;

/**
 * Chat de solo lectura para el link público de un live. A diferencia de
 * LiveChat (Realtime + insert autenticado), este componente solo hace polling
 * vía la función `get_public_live_messages` (token-gated, sin sesión) y
 * reemplaza el input por un CTA de login.
 */
const PublicLiveChat = ({ token, loginPath, showWelcome = true }: PublicLiveChatProps) => {
  const [messages, setMessages] = useState<PublicChatMessage[]>([SYSTEM_MESSAGE]);
  const [reactions, setReactions] = useState<ReactionsByMessage>(new Map());
  const [loading, setLoading] = useState(true);
  const visibleMessages = showWelcome ? messages : messages.filter((m) => m.id !== SYSTEM_MESSAGE.id);
  const { listRef, handleScroll, unseenCount, jumpToLatest } = useChatScroll(visibleMessages.length, !loading);

  useEffect(() => {
    let isActive = true;

    const fetchMessages = async () => {
      try {
        const fetched = await getPublicLiveMessages(token);
        if (!isActive) return;
        setMessages((prev) => mergeMessagesById(prev, fetched));
      } catch (err) {
        console.error("[PublicLiveChat] error fetching messages:", err);
      } finally {
        if (isActive) setLoading(false);
      }
    };

    // Mismo cadence/efecto que los mensajes: solo lectura, sin Realtime (anon
    // no tiene sesión para suscribirse).
    const fetchReactions = async () => {
      try {
        const fetched = await fetchPublicLiveReactions(token);
        if (!isActive) return;
        setReactions(fetched);
      } catch (err) {
        console.error("[PublicLiveChat] error fetching reactions:", err);
      }
    };

    fetchMessages();
    fetchReactions();
    const poll = setInterval(() => {
      fetchMessages();
      fetchReactions();
    }, POLL_INTERVAL_MS);
    return () => {
      isActive = false;
      clearInterval(poll);
    };
  }, [token]);

  return (
    <div className="flex flex-col w-full h-full bg-surface-page/50 light:bg-surface-page backdrop-blur-md overflow-hidden border-l border-line-subtle shadow-2xl">
      <div className="p-4 border-b border-line-subtle bg-black/40 light:bg-surface-subtle flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-brand/10 text-accent">
            <Users size={18} />
          </div>
          <div>
            <h3 className="text-sm font-bold text-foreground-strong tracking-wide">CHAT EN VIVO</h3>
            <div className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
              <span className="text-[10px] text-foreground-muted uppercase font-bold tracking-widest">Modo lectura</span>
            </div>
          </div>
        </div>
      </div>

      <div className="relative flex-1 min-h-0">
        <div
          ref={listRef}
          onScroll={handleScroll}
          className="h-full p-4 overflow-y-auto space-y-4"
          data-lenis-prevent="true"
        >
          {loading ? (
            <div className="space-y-4">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="flex flex-col gap-2">
                  <Skeleton className="w-24 h-3 rounded-full opacity-20" />
                  <Skeleton className="w-full h-12 rounded-xl opacity-10" />
                </div>
              ))}
            </div>
          ) : (
            <AnimatePresence initial={false}>
              {visibleMessages.map((msg) => (
                <motion.div
                  key={msg.id}
                  initial={{ opacity: 0, x: -20, scale: 0.95 }}
                  animate={{ opacity: 1, x: 0, scale: 1 }}
                  transition={{ duration: 0.2 }}
                  className="flex flex-col items-start"
                >
                  <div className="flex items-center gap-2 mb-1 px-1">
                    <span
                      className={cn(
                        "text-[10px] font-bold uppercase tracking-wider",
                        msg.id === "system-1" ? "text-accent" : "text-foreground-muted"
                      )}
                    >
                      {msg.user_name}
                    </span>
                    {msg.id === "system-1" && <ShieldCheck size={10} className="text-accent" />}
                    {msg.id !== "system-1" && (
                      <span className="text-[9px] font-medium text-fg-30 light:text-fg-50 tracking-wide tabular-nums">
                        {new Date(msg.created_at).toLocaleTimeString(undefined, {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    )}
                  </div>
  
                  <div
                    className={cn(
                      "px-4 py-2.5 rounded-2xl max-w-[90%] text-sm break-words relative overflow-hidden",
                      msg.id === "system-1"
                        ? "bg-brand/10 text-accent border border-brand/30 shadow-[0_0_20px_rgba(204,164,59,0.1)]"
                        : "bg-ink/5 text-foreground border border-ink/5 light:bg-surface-panel light:border-line-subtle light:shadow-sm"
                    )}
                  >
                    {msg.message}
                  </div>
                  {msg.id !== "system-1" && <MessageReactions reactions={reactions.get(msg.id) || {}} readOnly />}
                </motion.div>
              ))}
            </AnimatePresence>
          )}
        </div>
        <ChatJumpToLatest count={unseenCount} onClick={jumpToLatest} />
      </div>

      <div className="p-4 bg-black/40 light:bg-surface-subtle border-t border-line-subtle shrink-0">
        <Link
          to={loginPath}
          className="w-full flex items-center justify-center gap-2 bg-brand hover:bg-brand-hover text-on-brand px-4 py-3 rounded-xl transition-all font-bold text-sm shadow-lg shadow-brand/20"
        >
          <LogIn size={16} />
          Inicia sesión para participar
        </Link>
        <p className="text-[9px] text-center text-foreground-muted mt-3 uppercase tracking-[0.2em] opacity-50 [@media(max-height:500px)]:hidden">
          Encuentro exclusivo • Escuela de la Riqueza
        </p>
      </div>
    </div>
  );
};

export default PublicLiveChat;
