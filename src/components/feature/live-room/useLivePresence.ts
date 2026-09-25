import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { User } from "@/types/user";
import type { ViewerInfo } from "@/types/live";

interface UseLivePresenceOptions {
  liveId: string;
  /** Con sesión, se trackea con nombre (key `user.id`). */
  user: User | null;
  /** Sin sesión, id anónimo (key `anon-<id>`); sin él no se trackea. */
  anonId?: string;
  enabled: boolean;
}

/**
 * Presencia en tiempo real: quién está viendo el live ahora. La sala VIP y la
 * pública comparten el canal `live_presence:${liveId}` con la misma key por
 * usuario, así que alguien con sesión abierto en ambas no se cuenta dos veces.
 * Al cerrar la pestaña Supabase lo saca solo (~30 s).
 */
export function useLivePresence({ liveId, user, anonId, enabled }: UseLivePresenceOptions) {
  // `viewers` solo trae registrados (con user_id) para la lista con nombres;
  // `totalViewers` cuenta todas las presencias, anónimos incluidos.
  const [viewers, setViewers] = useState<ViewerInfo[]>([]);
  const [totalViewers, setTotalViewers] = useState(0);
  // Primitivos: el objeto `user` cambia de identidad sin que cambien sus datos.
  const userId = user?.id;
  const fullName = user?.fullName;
  const avatarUrl = user?.avatarUrl ?? null;
  const plan = user?.plan;

  useEffect(() => {
    if (!enabled || (!userId && !anonId)) return;

    const channel = supabase.channel(`live_presence:${liveId}`, {
      config: { presence: { key: userId ?? `anon-${anonId}` } },
    });

    const myPresence: ViewerInfo | { name: string; anonymous: true; online_at: string } =
      userId && plan
        ? {
            user_id: userId,
            full_name: fullName || "Usuario",
            avatar_url: avatarUrl,
            plan,
            online_at: new Date().toISOString(),
          }
        : { name: "Invitado", anonymous: true, online_at: new Date().toISOString() };

    channel
      .on("presence", { event: "sync" }, () => {
        const state = channel.presenceState<ViewerInfo>();
        // Dedupe por user_id: la misma cuenta en dos pestañas es una persona.
        const unique = new Map<string, ViewerInfo>();
        Object.values(state).flat().forEach((v) => {
          if (v?.user_id) unique.set(v.user_id, v);
        });
        setViewers([...unique.values()]);
        setTotalViewers(Object.keys(state).length);
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await channel.track(myPresence);
        }
      });

    return () => {
      channel.untrack().catch(() => {});
      supabase.removeChannel(channel);
    };
  }, [liveId, enabled, anonId, userId, fullName, avatarUrl, plan]);

  return { viewers, totalViewers };
}
