import { useState, useEffect, type FormEvent, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Send, Users, ShieldCheck, SmilePlus, Reply, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/lib/supabase";
import { useAuthStore } from "@/stores/auth.store";
import { USER_ROLES } from "@/types/user";
import { Skeleton } from "@/components/ui/skeleton";
import { ChatJumpToLatest } from "@/components/feature/ChatJumpToLatest";
import { MessageReactions } from "@/components/feature/chat/MessageReactions";
import { ReactionPicker } from "@/components/feature/chat/ReactionPicker";
import { QuotedMessage } from "@/components/feature/chat/QuotedMessage";
import { ReplyComposerPreview } from "@/components/feature/chat/ReplyComposerPreview";
import { DeleteMessageDialog } from "@/components/feature/chat/DeleteMessageDialog";
import { useChatScroll } from "@/hooks/useChatScroll";
import { useLiveReactions } from "@/hooks/useLiveReactions";
import { useMessageModeration } from "@/hooks/useMessageModeration";
import { useReplyTarget } from "@/hooks/useReplyTarget";
import { mergeMessagesById } from "@/lib/chat/mergeMessagesById";
import { removeMessage } from "@/lib/chat/removeMessage";
import { scrollWithinList } from "@/lib/chat/scrollWithinList";
import type { ReplyTo } from "@/lib/chat/replyTo";

export interface ChatMessage {
  id: string;
  user_id: string;
  user_name: string;
  content: string;
  created_at: string;
  isSystem?: boolean;
  reply_to?: ReplyTo | null;
}

/** How long the jump-to-original highlight stays on the target bubble. */
const HIGHLIGHT_DURATION_MS = 1500;
/** Client-side cap on the reply preview excerpt — the DB independently truncates to the same length. */
const REPLY_EXCERPT_LENGTH = 140;

interface LiveChatProps {
  liveId?: string;
  onIncomingMessage?: (msg: ChatMessage) => void;
  /** Mensaje de bienvenida fijado; solo tiene sentido antes de que arranque el vivo. */
  showWelcome?: boolean;
  /**
   * Muestra la acción «Eliminar mensaje» a los administradores. Es solo
   * presentación: quien decide si el borrado procede es la política RLS de
   * `live_messages` (sql/migrate-live-messages-admin-delete.sql). La vista del
   * alumno nunca lo pasa.
   */
  canModerate?: boolean;
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
  reply_to_id: string | null;
  reply_to_user_id: string | null;
  reply_to_user_name: string | null;
  reply_to_excerpt: string | null;
}

/**
 * Builds the reply quote from a DB row. `reply_to_user_name` (not
 * `reply_to_id`) is the signal that a message IS a reply: once the original
 * is deleted, the FK nulls `reply_to_id` but the trigger keeps the author
 * name so the UI can still show "Mensaje eliminado" with attribution.
 */
function buildReplyTo(row: MessageRow): ReplyTo | null {
  if (!row.reply_to_user_name) return null;
  return {
    id: row.reply_to_id,
    user_id: row.reply_to_user_id,
    user_name: row.reply_to_user_name,
    excerpt: row.reply_to_excerpt,
  };
}

const LiveChat = ({ liveId = "00000000-0000-0000-0000-000000000000", onIncomingMessage, showWelcome = true, canModerate = false }: LiveChatProps) => {
  const { user } = useAuthStore();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [newMessage, setNewMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState(false);
  const [historyError, setHistoryError] = useState(false);
  const [connection, setConnection] = useState<"connecting" | "connected" | "reconnecting">("connecting");
  const [openPickerId, setOpenPickerId] = useState<string | null>(null);
  // false hasta que el historial resuelve (éxito o error) — recién ahí el
  // hook de reacciones pide el snapshot inicial.
  const [historyReady, setHistoryReady] = useState(false);
  // Id del mensaje al que se saltó por "Ir al mensaje original" — resalta la
  // burbuja unos instantes y después se apaga sola.
  const [highlightedMessageId, setHighlightedMessageId] = useState<string | null>(null);
  const onIncomingMessageRef = useRef(onIncomingMessage);
  // Mensaje enviado sin confirmar: su id se reusa si se reintenta el mismo texto.
  const pendingSendRef = useRef<{ id: string; text: string } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const { replyTarget, startReply, cancelReply, cancelReplyFor } = useReplyTarget();
  const cancelReplyForRef = useRef(cancelReplyFor);
  const isModerator = canModerate && user?.role === USER_ROLES.ADMIN;
  const { pending: pendingDelete, requestDelete, cancelDelete, confirmDelete } = useMessageModeration({
    messages,
    setMessages,
    // Un mensaje eliminado ya no se puede reaccionar ni responder.
    onRemoved: (id) => {
      setOpenPickerId((current) => (current === id ? null : current));
      cancelReplyFor(id);
    },
  });
  const visibleMessages = showWelcome ? messages : messages.filter((m) => m.id !== SYSTEM_MESSAGE.id);
  // Ventana de mensajes para la que se piden reacciones — recalculada en cada
  // render (el hook la lee por ref) para que un resync tras reconexión use
  // los ids más recientes, no solo los del historial inicial.
  const messageIds = messages.filter((m) => !m.isSystem).map((m) => m.id);
  // F19: antes cada mensaje nuevo arrastraba al final aunque el alumno
  // estuviera leyendo más arriba.
  const { listRef, handleScroll, unseenCount, jumpToLatest } = useChatScroll(visibleMessages.length, !loading);
  const { reactions, toggleReaction, activeKeysFor, pendingKeysFor } = useLiveReactions({
    liveId,
    userId: user?.id ?? null,
    messageIds,
    historyReady,
  });

  // Abre el composer con el mensaje elegido, cierra cualquier picker abierto
  // y enfoca el input — así el alumno puede escribir la respuesta enseguida.
  const handleStartReply = (msg: ChatMessage) => {
    startReply({ id: msg.id, userName: msg.user_name, excerpt: msg.content.slice(0, REPLY_EXCERPT_LENGTH) });
    setOpenPickerId(null);
    inputRef.current?.focus();
  };

  const handleRequestDelete = (msg: ChatMessage) => {
    setOpenPickerId(null);
    requestDelete(msg);
  };

  // Desplaza el mensaje original a la vista y lo resalta unos instantes.
  // No hace nada si ya no está cargado (fuera de la ventana de HISTORY_LIMIT).
  const jumpToMessage = (id: string) => {
    const container = listRef.current;
    const target = container?.querySelector<HTMLElement>(`[data-message-id="${id}"]`);
    if (!container || !target) return;
    scrollWithinList(container, target, "center");
    setHighlightedMessageId(id);
    window.setTimeout(() => {
      setHighlightedMessageId((current) => (current === id ? null : current));
    }, HIGHLIGHT_DURATION_MS);
  };

  // El picker se abre DEBAJO de la burbuja: en el último mensaje quedaba fuera
  // de la vista en celular. Se desplaza la lista lo mínimo para mostrarlo.
  useEffect(() => {
    const list = listRef.current;
    if (!openPickerId || !list) return;
    const picker = list.querySelector<HTMLElement>('[role="menu"]');
    if (picker) scrollWithinList(list, picker, "nearest");
  }, [openPickerId, listRef]);

  // Mantener los callbacks siempre actualizados sin reabrir la suscripción Realtime
  useEffect(() => {
    onIncomingMessageRef.current = onIncomingMessage;
    cancelReplyForRef.current = cancelReplyFor;
  }, [onIncomingMessage, cancelReplyFor]);

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
        .select("id, content, created_at, user_id, reply_to_id, reply_to_user_id, reply_to_user_name, reply_to_excerpt")
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
          reply_to: buildReplyTo(msg),
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
      setHistoryReady(true);
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
          reply_to: buildReplyTo(newMsg),
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
    ).on(
      // Postgres Changes solo filtra un DELETE por columna con `replica identity
      // full`, que no activamos (misma razón que en useLiveReactions.ts): el
      // handler llega SIN filtrar por live_id y `old` trae solo la primary key
      // (`id`). Quitar un id que este chat no tiene es un no-op (removeMessage
      // devuelve la misma lista).
      "postgres_changes",
      { event: "DELETE", schema: "public", table: "live_messages" },
      (payload: { old: { id?: string } }) => {
        const deletedId = payload.old?.id;
        if (!isActive || !deletedId) return;
        setMessages((prev) => removeMessage(prev, deletedId));
        setOpenPickerId((current) => (current === deletedId ? null : current));
        cancelReplyForRef.current(deletedId);
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
      // Solo viaja el id del original — el nombre y el extracto los llena el
      // trigger del lado servidor a partir de la fila real (ver
      // sql/migrate-live-message-replies.sql), nunca lo que mande el cliente.
      const { error } = await supabase.from("live_messages").insert({
        id: pending.id,
        live_id: liveId,
        user_id: user.id,
        content: messageText,
        reply_to_id: replyTarget?.id ?? null,
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
    // Un envío fallido CONSERVA el objetivo de respuesta (se reintenta con el
    // mismo); solo se limpia cuando el mensaje se confirmó.
    cancelReply();
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
              {visibleMessages.map((msg) => {
                const isBubbleInteractive = !msg.isSystem && Boolean(user);
                // Alguien me respondió: un aviso sutil para que no se pase de largo.
                const isReplyToMe = !msg.isSystem && msg.reply_to?.user_id === user?.id && msg.user_id !== user?.id;
                const replyToOriginalId = msg.reply_to?.id;
                // El original puede no estar (ya no existe, o quedó fuera de HISTORY_LIMIT).
                const canJumpToOriginal = Boolean(replyToOriginalId && messages.some((m) => m.id === replyToOriginalId));
                return (
                <motion.div
                  key={msg.id}
                  data-message-id={msg.id}
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
                  
                  {/* El límite de ancho va en esta fila y no en la burbuja: la fila se
                      ajusta a su contenido (el padre usa items-start/end), así que un
                      max-w-[90%] en la burbuja era el 90% de su propio texto y partía
                      palabras ("Excelen te"). Acá el 90% es del ancho del chat. */}
                  <div className={cn("group relative flex items-end gap-1 max-w-[90%]", msg.user_id === user?.id && !msg.isSystem && "flex-row-reverse")}>
                    <div
                      onClick={() => {
                        if (isBubbleInteractive) setOpenPickerId((current) => (current === msg.id ? null : msg.id));
                      }}
                      onKeyDown={(e) => {
                        if (!isBubbleInteractive) return;
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          setOpenPickerId((current) => (current === msg.id ? null : msg.id));
                        }
                      }}
                      role={isBubbleInteractive ? "button" : undefined}
                      tabIndex={isBubbleInteractive ? 0 : undefined}
                      aria-label={isBubbleInteractive ? "Reaccionar a este mensaje" : undefined}
                      aria-haspopup={isBubbleInteractive ? "menu" : undefined}
                      aria-expanded={isBubbleInteractive ? openPickerId === msg.id : undefined}
                      data-reaction-trigger={isBubbleInteractive ? "true" : undefined}
                      className={cn(
                        "px-4 py-2.5 rounded-2xl min-w-0 text-sm break-words relative overflow-hidden transition-shadow",
                        isBubbleInteractive && "cursor-pointer",
                        msg.isSystem
                          ? "bg-brand/10 text-accent border border-brand/30 shadow-[0_0_20px_rgba(204,164,59,0.1)]"
                          : msg.user_id === user?.id
                            ? "bg-brand text-on-brand font-medium shadow-lg"
                            : "bg-ink/5 text-foreground border border-ink/5 light:bg-surface-panel light:border-line-subtle light:shadow-sm",
                        isReplyToMe && "ring-2 ring-accent/60",
                        highlightedMessageId === msg.id && "ring-2 ring-accent"
                      )}
                    >
                      {msg.isSystem && (
                        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent -translate-x-full animate-[shimmer_2s_infinite]" />
                      )}
                      {msg.reply_to && (
                        <QuotedMessage
                          userName={msg.reply_to.user_name}
                          excerpt={msg.reply_to.excerpt}
                          isOwnBubble={msg.user_id === user?.id}
                          onJumpToOriginal={canJumpToOriginal ? () => jumpToMessage(replyToOriginalId!) : undefined}
                        />
                      )}
                      {msg.content}
                    </div>
                    {!msg.isSystem && user && (
                      <div className="hidden md:flex items-center gap-0.5 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity shrink-0">
                        <button
                          type="button"
                          aria-label="Responder"
                          data-reaction-trigger="true"
                          onClick={() => handleStartReply(msg)}
                          className="flex items-center justify-center size-8 rounded-full text-foreground-muted hover:bg-ink/5 hover:text-accent"
                        >
                          <Reply size={16} />
                        </button>
                        <button
                          type="button"
                          aria-label="Reaccionar a este mensaje"
                          data-reaction-trigger="true"
                          onClick={() => setOpenPickerId((current) => (current === msg.id ? null : msg.id))}
                          className="flex items-center justify-center size-8 rounded-full text-foreground-muted hover:bg-ink/5 hover:text-accent"
                        >
                          <SmilePlus size={16} />
                        </button>
                        {isModerator && (
                          <button
                            type="button"
                            aria-label="Eliminar mensaje"
                            data-reaction-trigger="true"
                            onClick={() => handleRequestDelete(msg)}
                            className="flex items-center justify-center size-8 rounded-full text-foreground-muted hover:bg-danger-surface hover:text-danger"
                          >
                            <Trash2 size={16} />
                          </button>
                        )}
                      </div>
                    )}
                  </div>

                  {!msg.isSystem && (
                    <div className={cn("flex flex-col", msg.user_id === user?.id ? "items-end" : "items-start")}>
                      <MessageReactions
                        reactions={reactions.get(msg.id) || {}}
                        readOnly={!user}
                        onToggle={(key) => toggleReaction(msg.id, key)}
                      />
                      {openPickerId === msg.id && (
                        <ReactionPicker
                          activeKeys={activeKeysFor(msg.id)}
                          pendingKeys={pendingKeysFor(msg.id)}
                          onSelect={(key) => {
                            toggleReaction(msg.id, key);
                            setOpenPickerId(null);
                          }}
                          onClose={() => setOpenPickerId(null)}
                          onReply={() => handleStartReply(msg)}
                          onDelete={isModerator ? () => handleRequestDelete(msg) : undefined}
                        />
                      )}
                    </div>
                  )}
                </motion.div>
                );
              })}
            </AnimatePresence>
          )}
        </div>
        <ChatJumpToLatest count={unseenCount} onClick={jumpToLatest} />
      </div>

      {/* Input Area */}
      <div className="p-4 bg-black/40 light:bg-surface-subtle border-t border-line-subtle shrink-0">
        {replyTarget && <ReplyComposerPreview target={replyTarget} onCancel={cancelReply} />}
        <form onSubmit={handleSendMessage} className="flex gap-2 group">
          <div className="relative flex-1">
            <input
              ref={inputRef}
              type="text"
              value={newMessage}
              onChange={(e) => {
                setNewMessage(e.target.value);
                if (sendError) setSendError(false);
              }}
              // Enter que confirma una composición IME (acentos, otros idiomas)
              // no es "enviar": algunos navegadores igual disparaban el submit.
              // Escape cancela la respuesta en curso, si hay una.
              onKeyDown={(e) => {
                if (e.key === "Enter" && e.nativeEvent.isComposing) e.preventDefault();
                if (e.key === "Escape" && replyTarget) cancelReply();
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

      {isModerator && <DeleteMessageDialog message={pendingDelete} onConfirm={confirmDelete} onCancel={cancelDelete} />}
    </div>
  );
};

export default LiveChat;
