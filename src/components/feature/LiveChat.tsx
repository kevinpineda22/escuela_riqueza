import { useState, useEffect, type FormEvent, useRef } from "react";
import { cn } from "@/lib/utils";
import { supabase } from "@/lib/supabase";
import { useAuthStore } from "@/stores/auth.store";

interface ChatMessage {
  id: string;
  user_id: string;
  user_name: string;
  content: string;
  created_at: string;
  isSystem?: boolean;
}

const SYSTEM_MESSAGE: ChatMessage = {
  id: "system-1",
  user_id: "system",
  user_name: "Soporte",
  content: "¡Bienvenidos al evento VIP! Empezaremos en breve.",
  created_at: new Date().toISOString(),
  isSystem: true,
};

const LiveChat = ({ liveId = "00000000-0000-0000-0000-000000000000" }: { liveId?: string }) => {
  const { user } = useAuthStore();
  const [messages, setMessages] = useState<ChatMessage[]>([SYSTEM_MESSAGE]);
  const [newMessage, setNewMessage] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll al último mensaje
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Cargar mensajes iniciales y suscribirse a nuevos
  useEffect(() => {
    let channel: any;

    const initChat = async () => {
      // Esperar a que Supabase recupere la sesión local antes de conectarse a Realtime
      await supabase.auth.getSession();

      // 1. Cargar el historial de mensajes de este live
      const { data: msgsData, error } = await supabase
        .from("live_messages")
        .select("id, content, created_at, user_id")
        .eq("live_id", liveId)
        .order("created_at", { ascending: true });

      if (msgsData && !error) {
        // Obtener perfiles de los usuarios que comentaron
        const userIds = [...new Set(msgsData.map((m) => m.user_id))];
        let profilesMap: Record<string, string> = {};
        
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

        const history: ChatMessage[] = msgsData.map((msg: any) => ({
          id: msg.id,
          user_id: msg.user_id,
          user_name: profilesMap[msg.user_id] || "Usuario",
          content: msg.content,
          created_at: msg.created_at,
        }));
        setMessages([SYSTEM_MESSAGE, ...history]);
      }

      // 2. Suscribirse a nuevos mensajes (Realtime)
      const newChannel = supabase.channel(`live_messages_${liveId}`);
      
      newChannel.on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "live_messages", filter: `live_id=eq.${liveId}` },
        async (payload) => {
          // Necesitamos el nombre del usuario, así que hacemos una consulta rápida (o podríamos usar un trigger/view)
          const newMsg = payload.new;
          
          const { data: profileData } = await supabase
            .from("profiles")
            .select("full_name")
            .eq("id", newMsg.user_id)
            .single();

          const incomingMessage: ChatMessage = {
            id: newMsg.id,
            user_id: newMsg.user_id,
            user_name: profileData?.full_name || "Usuario",
            content: newMsg.content,
            created_at: newMsg.created_at,
          };

          setMessages((prev) => [...prev, incomingMessage]);
        }
      );
      
      newChannel.subscribe();
      channel = newChannel;
    };

    initChat();

    return () => {
      if (channel) {
        supabase.removeChannel(channel);
      }
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
      // Opcional: mostrar un toast de error
    }
  };

  return (
    <div className="flex flex-col w-full h-full bg-darker overflow-hidden">
      <div className="p-4 border-b border-white/10 bg-darker/50 shrink-0">
        <h3 className="text-lg font-semibold text-gold">Chat en Vivo VIP</h3>
        <p className="text-xs text-green-400">● Conectado</p>
      </div>

      <div className="flex-1 min-h-0 p-4 overflow-y-auto space-y-4 scroll-smooth">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={cn("flex flex-col", msg.user_id === user?.id && !msg.isSystem ? "items-end" : "items-start")}
          >
            <span className="text-xs text-textMuted mb-1">{msg.user_id === user?.id && !msg.isSystem ? "Tú" : msg.user_name}</span>
            <div
              className={cn(
                "px-3 py-2 rounded-lg max-w-[85%] text-sm break-words",
                msg.isSystem
                  ? "bg-gold/10 text-gold border border-gold/30"
                  : msg.user_id === user?.id
                    ? "bg-gold text-darker font-medium"
                    : "bg-dark text-textMain border border-white/5"
              )}
            >
              {msg.content}
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      <div className="p-4 border-t border-white/10 bg-darker shrink-0">
        <form onSubmit={handleSendMessage} className="flex gap-2">
          <input
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder={user ? "Escribe un mensaje..." : "Inicia sesión para chatear"}
            disabled={!user}
            className="flex-1 bg-dark border border-white/10 text-textMain rounded-lg px-4 py-2 focus:outline-none focus:border-gold focus:ring-1 focus:ring-gold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          />
          <button
            type="submit"
            disabled={!user || !newMessage.trim()}
            className="bg-gold hover:bg-goldHover text-darker px-4 py-2 rounded-lg transition-colors font-bold disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Enviar
          </button>
        </form>
      </div>
    </div>
  );
};

export default LiveChat;
