import { useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { claimActiveSession } from "@/lib/api/session";
import { useAuthStore } from "@/stores/auth.store";
import { toast } from "@/components/ui/toaster";

/**
 * Sesión única por cuenta. Verifica contra `claim_active_session` al entrar, al
 * volver a la pestaña y cuando Realtime avisa que cambió la sesión vigente. Si
 * la cuenta se abrió en otro dispositivo más tarde, cierra esta sesión (solo la
 * local: la del otro dispositivo es la que debe quedar) y avisa por qué.
 *
 * Si la verificación falla (red, migración sin aplicar) no expulsa a nadie.
 * Va dentro de <App> para que el toast tenga dónde pintarse.
 */
const SessionGuard = () => {
  const userId = useAuthStore((s) => s.user?.id);

  useEffect(() => {
    if (!userId) return;

    let cancelled = false;
    let checking = false;

    const check = async () => {
      if (checking || cancelled) return;
      checking = true;
      try {
        const status = await claimActiveSession();
        if (cancelled || status !== "superseded") return;
        cancelled = true;
        toast.warning("Tu sesión se cerró", {
          description:
            "Tu cuenta se abrió en otro dispositivo. Cada cuenta puede usarse en un solo dispositivo a la vez.",
          duration: 15000,
        });
        // SIGNED_OUT → AuthBootstrap limpia el store y RequireAuth redirige al login.
        await supabase.auth.signOut({ scope: "local" });
      } finally {
        checking = false;
      }
    };

    check();

    const channel = supabase
      .channel(`active_session:${userId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "user_active_sessions", filter: `user_id=eq.${userId}` },
        () => { check(); },
      )
      .subscribe();

    // Realtime se corta con el teléfono en segundo plano: al volver, verificar.
    const handleVisibility = () => {
      if (document.visibilityState === "visible") check();
    };
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [userId]);

  return null;
};

export default SessionGuard;
