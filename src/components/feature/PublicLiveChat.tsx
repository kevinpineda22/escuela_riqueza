import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "motion/react";
import { Users, ShieldCheck, LogIn } from "lucide-react";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { getPublicLiveMessages, type PublicChatMessage } from "@/lib/api/stream/lives";
import { mergeMessagesById } from "@/lib/chat/mergeMessagesById";

interface PublicLiveChatProps {
  token: string;
  loginPath: string;
}

const SYSTEM_MESSAGE: PublicChatMessage = {
  id: "system-1",
  user_id: "system",
  user_name: "Iván Mazo",
  message: "¡Bienvenidos a este encuentro exclusivo! Iniciamos en instantes.",
  created_at: new Date(0).toISOString(),
};

const POLL_INTERVAL_MS = 4000;
// Cuánto puede estar el usuario lejos del final antes de dejar de auto-scrollear.
const BOTTOM_THRESHOLD_PX = 80;

/**
 * Chat de solo lectura para el link público de un live. A diferencia de
 * LiveChat (Realtime + insert autenticado), este componente solo hace polling
 * vía la función `get_public_live_messages` (token-gated, sin sesión) y
 * reemplaza el input por un CTA de login.
 */
const PublicLiveChat = ({ token, loginPath }: PublicLiveChatProps) => {
  const [messages, setMessages] = useState<PublicChatMessage[]>([SYSTEM_MESSAGE]);
  const [loading, setLoading] = useState(true);
  const listRef = useRef<HTMLDivElement>(null);
  const isAtBottomRef = useRef(true);

  const handleScroll = () => {
    const el = listRef.current;
    if (!el) return;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    isAtBottomRef.current = distanceFromBottom < BOTTOM_THRESHOLD_PX;
  };

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

    fetchMessages();
    const poll = setInterval(fetchMessages, POLL_INTERVAL_MS);
    return () => {
      isActive = false;
      clearInterval(poll);
    };
  }, [token]);

  useEffect(() => {
    if (loading || !isAtBottomRef.current) return;
    const el = listRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [messages, loading]);

  return (
    <div className="flex flex-col w-full h-full bg-darker/50 backdrop-blur-md overflow-hidden border-l border-white/10 shadow-2xl">
      <div className="p-4 border-b border-white/10 bg-black/40 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-gold/10 text-gold">
            <Users size={18} />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white tracking-wide">CHAT EN VIVO</h3>
            <div className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
              <span className="text-[10px] text-textMuted uppercase font-bold tracking-widest">Modo lectura</span>
            </div>
          </div>
        </div>
      </div>

      <div
        ref={listRef}
        onScroll={handleScroll}
        className="flex-1 min-h-0 p-4 overflow-y-auto space-y-4 scroll-smooth"
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
            {messages.map((msg) => (
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
                      msg.id === "system-1" ? "text-gold" : "text-textMuted"
                    )}
                  >
                    {msg.user_name}
                  </span>
                  {msg.id === "system-1" && <ShieldCheck size={10} className="text-gold" />}
                  {msg.id !== "system-1" && (
                    <span className="text-[9px] font-medium text-white/30 tracking-wide tabular-nums">
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
                      ? "bg-gold/10 text-gold border border-gold/30 shadow-[0_0_20px_rgba(204,164,59,0.1)]"
                      : "bg-white/5 text-textMain border border-white/5"
                  )}
                >
                  {msg.message}
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        )}
      </div>

      <div className="p-4 bg-black/40 border-t border-white/10 shrink-0">
        <Link
          to={loginPath}
          className="w-full flex items-center justify-center gap-2 bg-gold hover:bg-goldHover text-darker px-4 py-3 rounded-xl transition-all font-bold text-sm shadow-lg shadow-gold/20"
        >
          <LogIn size={16} />
          Iniciá sesión para participar
        </Link>
        <p className="text-[9px] text-center text-textMuted mt-3 uppercase tracking-[0.2em] opacity-50">
          Encuentro exclusivo • Escuela de la Riqueza
        </p>
      </div>
    </div>
  );
};

export default PublicLiveChat;
