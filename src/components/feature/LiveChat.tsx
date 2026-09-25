import { useState, useEffect, type FormEvent, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Send, Users, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/lib/supabase";
import { useAuthStore } from "@/stores/auth.store";
import { Skeleton } from "@/components/ui/skeleton";
import { ChatJumpToLatest } from "@/components/feature/ChatJumpToLatest";
import { useChatScroll } from "@/hooks/useChatScroll";
import { mergeMessagesById } from "@/lib/chat/mergeMessagesById";

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
  /** Mensaje de bienvenida fijado; solo tiene sentido antes de que arranque el vivo. */
  showWelcome?: boolean;
}

const SYSTEM_MESSAGE: ChatMessage = {
  id: "system-1",
  user_id: "system",
  user_name: "Iván Mazo",
  content: "¡Bienvenidos a este encuentro exclusivo! Iniciamos en instantes.",
  // Época 0: al ordenar por fecha queda siempre primero (no muestra hora).
  created_at: new Date(0).toISOString(),
  isSystem: true,
};

// Código de Postgres para clave duplicada.
const UNIQUE_VIOLATION = "23505";
// Mensajes recientes que se cargan al entrar (F20).
const HISTORY_LIMIT = 200;

interface MessageRow {
  id: string;
  content: string;
  created_at: string;
  user_id: string;
}

const LiveChat = ({ liveId = "00000000-0000-0000-0000-000000000000", onIncomingMessage, showWelcome = true }: LiveChatProps) => {
  const { user } = useAuthStore();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [newMessage, setNewMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState(false);
  const [historyError, setHistoryError] = useState(false);
  const [connection, setConnection] = useState<"connecting" | "connected" | "reconnecting">("connecting");
  const onIncomingMessageRef = useRef(onIncomingMessage);
  // Mensaje enviado sin confirmar: su id se reusa si se reintenta el mismo texto.
  const pendingSendRef = useRef<{ id: string; text: string } | null>(null);
  const visibleMessages = showWelcome ? messages : messages.filter((m) => m.id !== SYSTEM_MESSAGE.id);
  // F19: antes cada mensaje nuevo arrastraba al final aunque el alumno
  // estuviera leyendo más arriba.
  const { listRef, handleScroll, unseenCount, jumpToLatest } = useChatScroll(visibleMessages.length, !loading);

  // Mantener el callback siempre actualizado sin reabrir la suscripción Realtime
  useEffect(() => {
    onIncomingMessageRef.current = onIncomingMessage;
  }, [onIncomingMessage]);

  // Cargar mensajes iniciales y suscribirse a nuevos
  useEffect(() => {
    let isActive = true;
    // Nombres ya conocidos: un mensaje de alguien que ya habló no vuelve a
    // consultar `profiles`. Antes cada mensaje entrante disparaba una
    // consulta en CADA espectador (F38).
    const names = new Map<string, string>();

    const resolveName = async (userId: string): Promise<string> => {
      const known = names.get(userId);
      if (known) return known;
      const { data } = await supabase.from("profiles").select("full_name").eq("id", userId).maybeSingle();
      const name = data?.full_name || "Usuario";
      names.set(userId, name);
      return name;
    };

    const fetchHistory = async () => {
      setLoading(true);
      setHistoryError(false);
      // Esperar a que Supabase recupere la sesión local antes de conectarse a Realtime
      await supabase.auth.getSession();

      // 1. Los ÚLTIMOS mensajes (DESC + limit), después en orden de lectura.
      // Antes traía el historial completo de la clase.
      const { data: rows, error } = await supabase
        .from("live_messages")
        .select("id, content, created_at, user_id")
        .eq("live_id", liveId)
        .order("created_at", { ascending: false })
        .limit(HISTORY_LIMIT);

      if (!isActive) return;

      if (rows && !error) {
        const history = (rows as MessageRow[]).slice().reverse();
        const unknownIds = [...new Set(history.map((m) => m.user_id))].filter((id) => !names.has(id));
        if (unknownIds.length > 0) {
          const { data: profiles } = await supabase.from("profiles").select("id, full_name").in("id", unknownIds);
          profiles?.forEach((p) => names.set(p.id, p.full_name));
        }
        if (!isActive) return;

        const loaded: ChatMessage[] = history.map((msg) => ({
          id: msg.id,
          user_id: msg.user_id,
          user_name: names.get(msg.user_id) || "Usuario",
          content: msg.content,
          created_at: msg.created_at,
        }));
        // F20: MEZCLAR, no reemplazar. Lo que llegó por Realtime mientras
        // cargaba el historial ya está en `prev` y antes se perdía.
        setMessages((prev) => mergeMessagesById(prev, [SYSTEM_MESSAGE, ...loaded]));
      } else {
        console.error("[LiveChat] error cargando el historial:", error);
        setHistoryError(true);
        setMessages((prev) => mergeMessagesById(prev, [SYSTEM_MESSAGE]));
      }
      setLoading(false);
    };

    fetchHistory();

    // 2. Suscribirse a nuevos mensajes (Realtime) desde el inicio, sin esperar
    // el historial, para no perder mensajes concurrentes.
    const channel = supabase.channel(`live_messages_${liveId}`);

    channel.on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "live_messages", filter: `live_id=eq.${liveId}` },
      async (payload: { new: MessageRow }) => {
        const newMsg = payload.new;
        const incomingMessage: ChatMessage = {
          id: newMsg.id,
          user_id: newMsg.user_id,
          user_name: await resolveName(newMsg.user_id),
          content: newMsg.content,
          created_at: newMsg.created_at,
        };
        if (!isActive) return;

        let isDuplicate = false;
        setMessages((prev) => {
          if (prev.some((m) => m.id === incomingMessage.id)) {
            isDuplicate = true;
            return prev;
          }
          // Orden por `created_at`: las consultas de nombre pueden resolver en
          // otro orden que el de llegada.
          return mergeMessagesById(prev, [incomingMessage]);
        });
        if (!isDuplicate) {
          onIncomingMessageRef.current?.(incomingMessage);
        }
      }
    ).subscribe((status) => {
      // F23: el indicador refleja la suscripción real, no es decorativo.
      if (isActive) setConnection(status === "SUBSCRIBED" ? "connected" : "reconnecting");
    });

    // Cleanup de la suscripción al desmontar
    return () => {
      isActive = false;
      supabase.removeChannel(channel);
    };
  }, [liveId]);

  const handleSendMessage = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (sending || !newMessage.trim() || !user) return;

    const messageText = newMessage.trim();
    setSending(true);
    setSendError(false);

    // F22: el id lo genera el cliente y un reintento del MISMO texto lo reusa.
    // Si el primer intento llegó a la base pero se perdió la respuesta, el
    // reintento choca con la clave primaria en vez de duplicar el mensaje.
    // Otro texto es otro mensaje: id nuevo.
    const pending =
      pendingSendRef.current?.text === messageText
        ? pendingSendRef.current
        : { id: crypto.randomUUID(), text: messageText };
    pendingSendRef.current = pending;

    // El texto se queda en el campo hasta que Supabase confirme. Antes se
    // borraba antes del insert y un fallo solo iba a consola: el alumno perdía
    // lo que escribió y creía que lo había enviado.
    let failed = false;
    try {
      const { error } = await supabase.from("live_messages").insert({
        id: pending.id,
        live_id: liveId,
        user_id: user.id,
        content: messageText,
      });
      // 23505 (unique_violation) en un reintento = el intento anterior sí
      // llegó. El mensaje ya está enviado: no es un error.
      if (error && error.code !== UNIQUE_VIOLATION) {
        failed = true;
        console.error("Error enviando mensaje:", error);
      }
    } catch (err) {
      failed = true;
      console.error("Error enviando mensaje:", err);
    }
    setSending(false);

    if (failed) {
      setSendError(true);
      return;
    }
    pendingSendRef.current = null;
    // Solo se limpia si el alumno no siguió escribiendo mientras se enviaba.
    setNewMessage((current) => (current.trim() === messageText ? "" : current));
    // Quien escribe quiere ver su mensaje: vuelve al final aunque estuviera leyendo.
    jumpToLatest();
  };

  return (
    <div className="flex flex-col w-full h-full bg-surface-page/50 light:bg-surface-page backdrop-blur-md overflow-hidden border-l border-line-subtle shadow-2xl">
      {/* Chat Header */}
      <div className="p-4 border-b border-line-subtle bg-black/40 light:bg-surface-subtle flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-brand/10 text-accent">
            <Users size={18} />
          </div>
          <div>
            <h3 className="text-sm font-bold text-foreground-strong tracking-wide">COMUNIDAD VIP</h3>
            <div className="flex items-center gap-1.5">
              <span
                className={cn(
                  "w-1.5 h-1.5 rounded-full",
                  connection === "connected" ? "bg-green-500 animate-pulse" : "bg-amber-500"
                )}
              />
              <span role="status" className="text-[10px] text-foreground-muted uppercase font-bold tracking-widest">
                {connection === "connected" ? "Chat en tiempo real" : connection === "connecting" ? "Conectando…" : "Reconectando…"}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Messages Area */}
      <div className="relative flex-1 min-h-0">
        <div
          ref={listRef}
          onScroll={handleScroll}
          className="h-full p-4 overflow-y-auto space-y-4"
          data-lenis-prevent="true"
        >
          {/* F23: un historial que no cargó no se disfraza de "sin mensajes". */}
          {historyError && (
            <p role="alert" className="text-xs text-center text-foreground-muted px-2">
              No pudimos cargar los mensajes anteriores. Los nuevos sí van a aparecer.
            </p>
          )}
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
                      msg.isSystem ? "text-accent" : "text-foreground-muted"
                    )}>
                      {msg.user_id === user?.id && !msg.isSystem ? "Tú" : msg.user_name}
                    </span>
                    {msg.isSystem && <ShieldCheck size={10} className="text-accent" />}
                    {!msg.isSystem && (
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
                      msg.isSystem
                        ? "bg-brand/10 text-accent border border-brand/30 shadow-[0_0_20px_rgba(204,164,59,0.1)]"
                        : msg.user_id === user?.id
                          ? "bg-brand text-on-brand font-medium shadow-lg"
                          : "bg-ink/5 text-foreground border border-ink/5 light:bg-surface-panel light:border-line-subtle light:shadow-sm"
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
        </div>
        <ChatJumpToLatest count={unseenCount} onClick={jumpToLatest} />
      </div>

      {/* Input Area */}
      <div className="p-4 bg-black/40 light:bg-surface-subtle border-t border-line-subtle shrink-0">
        <form onSubmit={handleSendMessage} className="flex gap-2 group">
          <div className="relative flex-1">
            <input
              type="text"
              value={newMessage}
              onChange={(e) => {
                setNewMessage(e.target.value);
                if (sendError) setSendError(false);
              }}
              // Enter que confirma una composición IME (acentos, otros idiomas)
              // no es "enviar": algunos navegadores igual disparaban el submit.
              onKeyDown={(e) => {
                if (e.key === "Enter" && e.nativeEvent.isComposing) e.preventDefault();
              }}
              enterKeyHint="send"
              autoComplete="off"
              placeholder={user ? "Escribe a la comunidad..." : "Inicia sesión para participar"}
              aria-label="Mensaje para la comunidad"
              aria-invalid={sendError || undefined}
              aria-describedby={sendError ? "live-chat-send-error" : undefined}
              disabled={!user}
              // 16 px (text-base): con menos, Safari de iOS agranda la página al
              // enfocar y la sala queda descuadrada al cerrar el teclado (F15/F23).
              className="w-full bg-ink/5 border border-line-subtle text-foreground-strong rounded-xl px-4 py-3 text-base light:bg-surface-input light:border-line-control/50 light:placeholder:text-foreground-placeholder focus:outline-none focus:border-brand/50 focus:ring-1 focus:ring-focus/50 transition-all placeholder:text-fg-20 disabled:opacity-50"
            />
          </div>
          <button
            type="submit"
            disabled={!user || !newMessage.trim() || sending}
            aria-label={sending ? "Enviando mensaje" : "Enviar mensaje"}
            className="bg-brand hover:bg-brand-hover text-on-brand px-4 py-3 rounded-xl transition-all font-bold disabled:opacity-50 disabled:grayscale flex items-center justify-center hover:scale-105 active:scale-95 shadow-lg shadow-brand/20"
          >
            <Send size={18} />
          </button>
        </form>
        {sendError && (
          <p id="live-chat-send-error" role="alert" className="text-xs text-danger mt-2 px-1">
            No se pudo enviar tu mensaje. Revisa tu conexión e inténtalo de nuevo.
          </p>
        )}
        {/* Decorativa: con poca altura (horizontal, teclado abierto) cede su lugar. */}
        <p className="text-[9px] text-center text-foreground-muted mt-3 uppercase tracking-[0.2em] opacity-50 [@media(max-height:500px)]:hidden">
          Encuentro exclusivo • Escuela de la Riqueza
        </p>
      </div>
    </div>
  );
};

export default LiveChat;
