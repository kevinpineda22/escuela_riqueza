import { Navigate, useLocation } from "react-router-dom";
import type { ReactNode } from "react";
import { useAuth } from "@/hooks/useAuth";
import type { Plan, UserRole } from "@/types/user";

interface RequireAuthProps {
  children: ReactNode;
  role?: UserRole;
  minPlan?: Plan;
}

const PLAN_RANK: Record<Plan, number> = {
  free: 0,
  individual: 1,
  vip: 2,
};

const RequireAuth = ({ children, role, minPlan }: RequireAuthProps) => {
  const { user, isAuthenticated } = useAuth();
  const location = useLocation();

  if (!isAuthenticated || !user) {
    const returnTo = `${location.pathname}${location.search}${location.hash}`;
    const search = returnTo && returnTo !== "/" ? `?returnTo=${encodeURIComponent(returnTo)}` : "";
    return <Navigate to={`/login${search}`} replace />;
  }

  // Baranda: sesión válida pero email sin confirmar → fuera. Solo bloquea si es
  // explícitamente false; undefined (sesiones viejas sin el campo) pasa, para no
  // desloguear a nadie en el deploy. Hoy está latente (con confirmación ON no hay
  // sesión sin confirmar), pero blinda el caso si algún día se apaga en Supabase.
  if (user.emailConfirmed === false) {
    return <Navigate to="/login" replace />;
  }

  if (role && user.role !== role) {
    return <Navigate to="/" replace />;
  }

  // Admin bypasses plan restrictions
  if (user.role !== "admin" && minPlan && PLAN_RANK[user.plan] < PLAN_RANK[minPlan]) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
};

export default RequireAuth;
