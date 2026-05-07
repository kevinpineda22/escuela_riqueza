import { Navigate } from "react-router-dom";
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

  if (!isAuthenticated || !user) {
    return <Navigate to="/login" replace />;
  }

  if (role && user.role !== role) {
    return <Navigate to="/" replace />;
  }

  if (minPlan && PLAN_RANK[user.plan] < PLAN_RANK[minPlan]) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
};

export default RequireAuth;
