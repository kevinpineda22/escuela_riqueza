import { useEffect, useRef, useState, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { useShallow } from "zustand/react/shallow";
import { supabase } from "@/lib/supabase";
import { getCurrentUser } from "@/lib/api/auth";
import { useAuthStore } from "@/stores/auth.store";
import AuthSplash from "@/components/feature/AuthSplash";

interface AuthBootstrapProps {
  children: ReactNode;
}

const BOOTSTRAP_TIMEOUT_MS = 8000;

const AuthBootstrap = ({ children }: AuthBootstrapProps) => {
  const { setSession, clearSession } = useAuthStore(
    useShallow((s) => ({
      setSession: s.setSession,
      clearSession: s.clearSession,
    })),
  );
  const [ready, setReady] = useState(false);
  // Refs para no depender de valores capturados (obsoletos) dentro del
  // setTimeout / listeners del efecto.
  const settledRef = useRef(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    let isMounted = true;

    // Desbloquea el render una sola vez y cancela el failsafe.
    const settle = () => {
      settledRef.current = true;
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      if (isMounted) setReady(true);
    };

    // Arranque inicial: resuelve sesión + perfil. Es el ÚNICO punto donde se
    // permite limpiar la sesión, y sólo si Supabase confirma que no hay sesión.
    const initializeAuth = async (session: Session | null) => {
      try {
        if (!session) {
          clearSession();
        } else {
          const user = await getCurrentUser();
          if (!isMounted) return;
          if (user) {
            setSession(user, session.access_token);
          } else {
            clearSession();
          }
        }
      } catch (error) {
        console.error("[AuthBootstrap] Error initializing auth:", error);
        // Un fallo transitorio de red NO debe desloguear si ya hay sesión persistida.
        if (isMounted && !useAuthStore.getState().user) clearSession();
      } finally {
        settle();
      }
    };

    // Refresh de token en background (cada ~1h o al volver el foco). NUNCA
    // desloguea por un error transitorio: sólo actualiza el token en el store.
    const refreshToken = (session: Session | null) => {
      const currentUser = useAuthStore.getState().user;
      if (session && currentUser) {
        setSession(currentUser, session.access_token);
      } else if (session) {
        // Había sesión pero no user en el store → hidratar el perfil.
        initializeAuth(session);
      }
    };

    // Failsafe: si Supabase no respondió en 8s, desbloqueamos el render igual.
    // CRÍTICO: ya NO limpia la sesión — sólo deja de mostrar el splash. La
    // sesión persistida se mantiene y se rehidrata cuando Supabase responda.
    timeoutRef.current = setTimeout(() => {
      if (isMounted && !settledRef.current) {
        console.warn("[AuthBootstrap] Failsafe timeout. Desbloqueando render sin tocar la sesión.");
        settle();
      }
    }, BOOTSTRAP_TIMEOUT_MS);

    // En Supabase, onAuthStateChange dispara un evento inicial "INITIAL_SESSION" inmediatamente.
    // Usar getSession() manualmente a veces cuelga o crea race conditions en React 19.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!isMounted) return;

      if (event === "INITIAL_SESSION" || event === "SIGNED_IN") {
        initializeAuth(session);
      } else if (event === "TOKEN_REFRESHED") {
        refreshToken(session);
      } else if (event === "SIGNED_OUT") {
        clearSession();
        settle();
      }
    });

    // Handler global de unhandled rejections para capturar errores de Supabase Auth
    // que se disparan en background (auto-refresh de token, listeners internos).
    // Sin esto, un refresh token roto en localStorage rompe el ErrorBoundary.
    const handleUnhandledAuthError = (event: PromiseRejectionEvent) => {
      const reason = event.reason as { name?: string; message?: string } | null;
      const message = typeof reason?.message === "string" ? reason.message : "";
      const isAuthError =
        reason?.name === "AuthApiError" ||
        message.includes("Invalid Refresh Token") ||
        message.includes("Refresh Token Not Found");

      if (!isAuthError) return;

      console.warn("[AuthBootstrap] Sesión inválida detectada (refresh token roto). Limpiando localStorage.", reason);
      event.preventDefault();
      // Forzar signOut local para limpiar el token podrido del storage.
      // No nos importa el resultado del request al server.
      supabase.auth.signOut({ scope: "local" }).catch(() => {});
      if (isMounted) clearSession();
    };

    window.addEventListener("unhandledrejection", handleUnhandledAuthError);

    return () => {
      isMounted = false;
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      subscription.unsubscribe();
      window.removeEventListener("unhandledrejection", handleUnhandledAuthError);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!ready) return <AuthSplash />;
  
  return <>{children}</>;
};

export default AuthBootstrap;
