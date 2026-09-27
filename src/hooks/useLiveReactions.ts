import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { toast } from "@/components/ui/toaster";
import {
  fetchLiveReactions,
  addReaction,
  removeReaction,
  mergeReactionSnapshot,
  applyReactionAdded,
  applyReactionRemoved,
  isReactionKey,
  pendingKeysForMessage,
  type ReactionKey,
  type ReactionsByMessage,
  type ReactionRow,
  type ReactionOp,
} from "@/lib/api/stream/reactions";

interface UseLiveReactionsParams {
  liveId: string;
  userId: string | null;
  /** Ids of the currently loaded (non-system) messages — reactions are only fetched for this window. */
  messageIds: string[];
  /** True once the message history finished loading, success or failure. */
  historyReady: boolean;
}

export interface UseLiveReactionsResult {
  reactions: ReactionsByMessage;
  /** Reaction keys of `messageId` with a toggle currently in flight. */
  pendingKeysFor: (messageId: string) => Set<ReactionKey>;
  /** Reaction keys of `messageId` placed by the current user. */
  activeKeysFor: (messageId: string) => Set<ReactionKey>;
  toggleReaction: (messageId: string, key: ReactionKey) => Promise<void>;
}

/**
 * Owns all reaction state for a live chat: the aggregated per-message
 * counts, the optimistic toggle with rollback on failure, and the Realtime
 * sync — its own channel (separate from the messages one), the initial
 * snapshot once the message history is ready, and a resync after a
 * reconnect so events dropped during the gap aren't lost.
 * See docs/CHANGELOG.md 2026-09-26.
 */
export function useLiveReactions({
  liveId,
  userId,
  messageIds,
  historyReady,
}: UseLiveReactionsParams): UseLiveReactionsResult {
  const [reactions, setReactions] = useState<ReactionsByMessage>(new Map());
  // Reacciones con un toggle en curso (`${messageId}:${key}`): un segundo tap
  // sobre la misma mientras responde el servidor se ignora.
  const [pendingReactions, setPendingReactions] = useState<Set<string>>(new Set());

  // Refs siempre actualizados: los handlers de Realtime viven dentro de un
  // efecto con deps [liveId] y no deben quedarse con valores del montaje.
  const userIdRef = useRef(userId);
  const messageIdsRef = useRef(messageIds);
  // Puente entre el efecto que arma el canal (declarado antes) y el efecto
  // que reacciona a `historyReady` (declarado después): este último dispara
  // la primera carga llamando a la función que dejó el primero.
  const runInitialSnapshotRef = useRef<() => void>(() => {});

  useEffect(() => {
    userIdRef.current = userId;
  }, [userId]);

  useEffect(() => {
    messageIdsRef.current = messageIds;
  }, [messageIds]);

  // Canal de Realtime propio (no comparte el de los mensajes) + snapshot
  // inicial y resync tras reconexión.
  useEffect(() => {
    let isActive = true;
    let hasSubscribedOnce = false;
    let snapshotLoaded = false;
    let snapshotInFlight = false;
    let bufferedOps: ReactionOp[] = [];
    // Si una instantánea nueva arranca mientras otra sigue en vuelo
    // (reconexiones seguidas), gana la más reciente: cada corrida se marca
    // con un token y una respuesta desactualizada se descarta en vez de
    // pisar el resultado de la corrida más nueva.
    let snapshotToken = 0;

    const runSnapshot = async () => {
      const token = ++snapshotToken;
      snapshotInFlight = true;
      try {
        const snapshot = await fetchLiveReactions(liveId, messageIdsRef.current);
        if (!isActive || token !== snapshotToken) return;
        setReactions(mergeReactionSnapshot(snapshot, bufferedOps, userIdRef.current));
      } catch (err) {
        console.error("[useLiveReactions] error cargando reacciones:", err);
      } finally {
        if (token === snapshotToken) {
          snapshotInFlight = false;
          snapshotLoaded = true;
          bufferedOps = [];
        }
      }
    };
    runInitialSnapshotRef.current = runSnapshot;

    const channel = supabase.channel(`live_reactions_${liveId}`);

    channel
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "live_message_reactions", filter: `live_id=eq.${liveId}` },
        (payload: { new: ReactionRow }) => {
          if (!isActive) return;
          // Mientras no hay una instantánea firme (todavía no cargó la
          // primera, o hay un resync en vuelo tras una reconexión), el
          // evento se guarda para repetirse sobre la instantánea (ver
          // mergeReactionSnapshot). También se aplica al estado ya mismo
          // para que la UI no se quede atrás mientras tanto; el
          // `setReactions` de la instantánea lo reemplaza por el resultado
          // ya mezclado apenas resuelve.
          if (!snapshotLoaded || snapshotInFlight) bufferedOps.push({ type: "add", row: payload.new });
          setReactions((prev) => applyReactionAdded(prev, payload.new, userIdRef.current));
        }
      )
      .on(
        // Postgres Changes solo puede filtrar un DELETE si la tabla tiene
        // `replica identity full` (verificado en la doc de Supabase Realtime,
        // guía "Postgres Changes"). No la activamos para no mandar la fila
        // completa en cada delete de todo el proyecto, así que este handler
        // llega SIN filtrar por live_id: con `replica identity` default el
        // `old` solo trae las columnas de la primary key (message_id, user_id,
        // emoji), que es justo lo que hace falta para actualizar el mapa local
        // — y actualizar por un message_id que no está en este chat es un
        // no-op inofensivo (ver `applyReactionRemoved`).
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "live_message_reactions" },
        (payload: { old: Partial<ReactionRow> }) => {
          if (!isActive) return;
          const { message_id, user_id, emoji } = payload.old;
          if (!message_id || !user_id || !emoji || !isReactionKey(emoji)) return;
          // Mismo criterio que el INSERT de arriba: bufferear mientras no hay
          // instantánea firme, y de paso aplicar al estado actual.
          if (!snapshotLoaded || snapshotInFlight) bufferedOps.push({ type: "remove", row: { message_id, user_id, emoji } });
          setReactions((prev) => applyReactionRemoved(prev, { message_id, user_id, emoji }, userIdRef.current));
        }
      )
      .subscribe((status: string) => {
        if (!isActive || status !== "SUBSCRIBED") return;
        // La primera suscripción no dispara nada acá: la primera carga la
        // arranca el efecto de `historyReady` de más abajo. Una reconexión
        // (ya hubo un SUBSCRIBED antes) sí dispara un resync completo — los
        // eventos que llegaron durante la caída se pudieron perder.
        if (hasSubscribedOnce) runSnapshot();
        hasSubscribedOnce = true;
      });

    return () => {
      isActive = false;
      supabase.removeChannel(channel);
    };
  }, [liveId]);

  // Dispara la primera carga apenas el historial de mensajes terminó de
  // cargar (éxito o error), usando la ventana de mensajes vigente en ese
  // momento (leída por ref en `runSnapshot`, no por esta dependencia).
  useEffect(() => {
    if (historyReady) runInitialSnapshotRef.current();
  }, [historyReady]);

  const toggleReaction = async (messageId: string, key: ReactionKey) => {
    if (!userId) return;
    const pendingKey = `${messageId}:${key}`;
    if (pendingReactions.has(pendingKey)) return;

    const alreadyMine = Boolean(reactions.get(messageId)?.[key]?.mine);
    const previousReactions = reactions;
    setPendingReactions((prev) => new Set(prev).add(pendingKey));
    // Optimista: refleja el toggle antes de que responda el servidor.
    setReactions((prev) =>
      alreadyMine
        ? applyReactionRemoved(prev, { message_id: messageId, user_id: userId, emoji: key }, userId)
        : applyReactionAdded(prev, { message_id: messageId, user_id: userId, emoji: key }, userId)
    );

    try {
      if (alreadyMine) {
        await removeReaction(messageId, key, userId);
      } else {
        await addReaction(messageId, liveId, key, userId);
      }
    } catch (err) {
      console.error("[useLiveReactions] error al reaccionar:", err);
      setReactions(previousReactions);
      toast.error("No se pudo guardar tu reacción");
    } finally {
      setPendingReactions((prev) => {
        const next = new Set(prev);
        next.delete(pendingKey);
        return next;
      });
    }
  };

  const pendingKeysFor = (messageId: string) => pendingKeysForMessage(messageId, pendingReactions);

  const activeKeysFor = (messageId: string) => {
    const summary = reactions.get(messageId) || {};
    const active = new Set<ReactionKey>();
    for (const key of Object.keys(summary) as ReactionKey[]) {
      if (summary[key]?.mine) active.add(key);
    }
    return active;
  };

  return { reactions, pendingKeysFor, activeKeysFor, toggleReaction };
}
