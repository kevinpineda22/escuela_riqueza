import { useState, useEffect, type FormEvent, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Send, Users, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/lib/supabase";
import { useAuthStore } from "@/stores/auth.store";
import { Skeleton } from "@/components/ui/skeleton";

export interface ChatMessage {
  id: string;
  user_id: string;
  user_name: string;
  content: string;
  created_at: string;
  isSystem?: boolean;
}

interface LiveChatProps {
  liveId?: string;
  onIncomingMessage?: (msg: ChatMessage) => void;
}

const SYSTEM_MESSAGE: ChatMessage = {
  id: "system-1",
  user_id: "system",
  user_name: "Iván Mazo",
  content: "¡Bienvenidos a este encuentro exclusivo! Iniciamos en instantes.",
  created_at: new Date().toISOString(),
  isSystem: true,
};

const LiveChat = ({ liveId = "00000000-0000-0000-0000-000000000000", onIncomingMessage }: LiveChatProps) => {
  const { user } = useAuthStore();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [newMessage, setNewMessage] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const onIncomingMessageRef = useRef(onIncomingMessage);

  // Mantener el callback siempre actualizado sin reabrir la suscripción Realtime
  useEffect(() => {
    onIncomingMessageRef.current = onIncomingMessage;
  }, [onIncomingMessage]);

  // Auto-scroll al último mensaje.
  // Safari iOS < 16 puede tirar al usar { behavior: "smooth" } si el elemento
  // está dentro de un contenedor que cambió de tamaño recientemente.
  const scrollToBottom = () => {
    try {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
    } catch {
      messagesEndRef.current?.scrollIntoView(false);
    }
  };

  useEffect(() => {
    if (!loading) {
      scrollToBottom();
    }
  }, [messages, loading]);

  // Cargar mensajes iniciales y suscribirse a nuevos
  useEffect(() => {
    let isActive = true;

    const fetchHistory = async () => {
      setLoading(true);
      // Esperar a que Supabase recupere la sesión local antes de conectarse a Realtime
      await supabase.auth.getSession();

      // 1. Cargar el historial de mensajes de este live
      const { data: msgsData, error } = await supabase
        .from("live_messages")
        .select("id, content, created_at, user_id")
        .eq("live_id", liveId)
        .order("created_at", { ascending: true });

      if (!isActive) return;

      if (msgsData && !error) {
        // Obtener perfiles de los usuarios que comentaron
        const userIds = [...new Set(msgsData.map((m) => m.user_id))];
        const profilesMap: Record<string, string> = {};
        
        if (userIds.length > 0) {
          const { data: profilesData } = await supabase
            .from("profiles")
            .select("id, full_name")
            .in("id", userIds);
            
          if (profilesData) {
            profilesData.forEach((p) => {
              profilesMap[p.id] = p.full_name;
            });
          }
        }

        if (!isActive) return;

        const history: ChatMessage[] = msgsData.map((msg: any) => ({
          id: msg.id,
          user_id: msg.user_id,
          user_name: profilesMap[msg.user_id] || "Usuario",
          content: msg.content,
          created_at: msg.created_at,
        }));
        setMessages([SYSTEM_MESSAGE, ...history]);
      } else {
        setMessages([SYSTEM_MESSAGE]);
      }
      setLoading(false);
    };

    fetchHistory();

    // 2. Suscribirse a nuevos mensajes (Realtime) 
    // Lo hacemos desde el inicio sin esperar el fetch, para no perder mensajes concurrentes y 
    // evitar race conditions con el unmount de React Strict Mode.
    const channel = supabase.channel(`live_messages_${liveId}`);
    
    channel.on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "live_messages", filter: `live_id=eq.${liveId}` },
      async (payload: any) => {
        const newMsg = payload.new;
        
        const { data: profileData } = await supabase
          .from("profiles")
          .select("full_name")
          .eq("id", newMsg.user_id)
          .maybeSingle();

        const incomingMessage: ChatMessage = {
          id: newMsg.id,
          user_id: newMsg.user_id,
          user_name: profileData?.full_name || "Usuario",
          content: newMsg.content,
          created_at: newMsg.created_at,
        };

        if (isActive) {
          let isDuplicate = false;
          setMessages((prev) => {
             // Evitar duplicados si el realtime se adelantó al fetch
             if (prev.some(m => m.id === incomingMessage.id)) {
               isDuplicate = true;
               return prev;
             }
             return [...prev, incomingMessage];
          });
          if (!isDuplicate) {
            onIncomingMessageRef.current?.(incomingMessage);
          }
        }
      }
    ).subscribe();

    // Cleanup de la suscripción al desmontar
    return () => {
      isActive = false;
      supabase.removeChannel(channel);
    };
  }, [liveId]);

  const handleSendMessage = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!newMessage.trim() || !user) return;

    const messageText = newMessage.trim();
    setNewMessage("");

    // Insertar en Supabase
    const { error } = await supabase.from("live_messages").insert({
      live_id: liveId,
      user_id: user.id,
      content: messageText,
    });

    if (error) {
      console.error("Error enviando mensaje:", error);
    }
  };

  return (
    <div className="flex flex-col w-full h-full bg-darker/50 backdrop-blur-md overflow-hidden border-l border-white/10 shadow-2xl">
      {/* Chat Header */}
      <div className="p-4 border-b border-white/10 bg-black/40 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-gold/10 text-gold">
            <Users size={18} />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white tracking-wide">COMUNIDAD VIP</h3>
            <div className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
              <span className="text-[10px] text-textMuted uppercase font-bold tracking-widest">Chat en tiempo real</span>
            </div>
          </div>
        </div>
      </div>

      {/* Messages Area */}
      <div 
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
                initial={{ opacity: 0, x: msg.user_id === user?.id && !msg.isSystem ? 20 : -20, scale: 0.95 }}
                animate={{ opacity: 1, x: 0, scale: 1 }}
                transition={{ duration: 0.2 }}
                className={cn(
                  "flex flex-col",
                  msg.user_id === user?.id && !msg.isSystem ? "items-end" : "items-start"
                )}
              >
                <div className="flex items-center gap-2 mb-1 px-1">
                  <span className={cn(
                    "text-[10px] font-bold uppercase tracking-wider",
                    msg.isSystem ? "text-gold" : "text-textMuted"
                  )}>
                    {msg.user_id === user?.id && !msg.isSystem ? "Tú" : msg.user_name}
                  </span>
                  {msg.isSystem && <ShieldCheck size={10} className="text-gold" />}
                  {!msg.isSystem && (
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
                    msg.isSystem
                      ? "bg-gold/10 text-gold border border-gold/30 shadow-[0_0_20px_rgba(204,164,59,0.1)]"
                      : msg.user_id === user?.id
                        ? "bg-gold text-darker font-medium shadow-lg"
                        : "bg-white/5 text-textMain border border-white/5"
                  )}
                >
                  {msg.isSystem && (
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent -translate-x-full animate-[shimmer_2s_infinite]" />
                  )}
                  {msg.content}
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="p-4 bg-black/40 border-t border-white/10 shrink-0">
        <form onSubmit={handleSendMessage} className="flex gap-2 group">
          <div className="relative flex-1">
            <input
              type="text"
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder={user ? "Escribe a la comunidad..." : "Inicia sesión para participar"}
              disabled={!user}
              className="w-full bg-white/5 border border-white/10 text-white rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-gold/50 focus:ring-1 focus:ring-gold/50 transition-all placeholder:text-white/20 disabled:opacity-50"
            />
          </div>
          <button
            type="submit"
            disabled={!user || !newMessage.trim()}
            className="bg-gold hover:bg-goldHover text-darker px-4 py-3 rounded-xl transition-all font-bold disabled:opacity-50 disabled:grayscale flex items-center justify-center hover:scale-105 active:scale-95 shadow-lg shadow-gold/20"
          >
            <Send size={18} />
          </button>
        </form>
        <p className="text-[9px] text-center text-textMuted mt-3 uppercase tracking-[0.2em] opacity-50">
          Encuentro exclusivo • Escuela de la Riqueza
        </p>
      </div>
    </div>
  );
};

export default LiveChat;
