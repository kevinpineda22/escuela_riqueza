import { useEffect, useState, type ReactNode } from "react";
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

  useEffect(() => {
    let isMounted = true;
    let timeoutId: ReturnType<typeof setTimeout>;

    const initializeAuth = async (session: any) => {
      try {
        if (!session) {
          clearSession();
        } else {
          const user = await getCurrentUser();
          if (isMounted) {
            if (user) {
              setSession(user, session.access_token);
            } else {
              clearSession();
            }
          }
        }
      } catch (error) {
        console.error("[AuthBootstrap] Error initializing auth:", error);
        if (isMounted) clearSession();
      } finally {
        if (isMounted) {
          clearTimeout(timeoutId);
          setReady(true);
        }
      }
    };

    // Failsafe timeout
    timeoutId = setTimeout(() => {
      if (isMounted && !ready) {
        console.warn("[AuthBootstrap] Failsafe timeout reached. Forcing ready state.");
        clearSession();
        setReady(true);
      }
    }, BOOTSTRAP_TIMEOUT_MS);

    // En Supabase, onAuthStateChange dispara un evento inicial "INITIAL_SESSION" inmediatamente.
    // Usar getSession() manualmente a veces cuelga o crea race conditions en React 19.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!isMounted) return;
      
      if (event === "INITIAL_SESSION" || event === "SIGNED_IN" || event === "TOKEN_REFRESHED") {
        initializeAuth(session);
      } else if (event === "SIGNED_OUT") {
        clearSession();
        if (!ready) setReady(true);
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
      clearTimeout(timeoutId);
      subscription.unsubscribe();
      window.removeEventListener("unhandledrejection", handleUnhandledAuthError);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!ready) return <AuthSplash />;
  
  return <>{children}</>;
};

export default AuthBootstrap;
