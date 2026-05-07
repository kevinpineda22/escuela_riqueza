import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import type { Plan, UserRole } from "@/types/user";

interface RequireRoleOptions {
  role?: UserRole;
  minPlan?: Plan;
  redirectTo?: string;
}

const PLAN_RANK: Record<Plan, number> = {
  free: 0,
  individual: 1,
  vip: 2,
};

export function useRequireRole({ role, minPlan, redirectTo = "/login" }: RequireRoleOptions = {}) {
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuth();

  useEffect(() => {
    if (!isAuthenticated || !user) {
      navigate(redirectTo, { replace: true });
      return;
    }
    if (role && user.role !== role) {
      navigate("/", { replace: true });
      return;
    }
    if (minPlan && PLAN_RANK[user.plan] < PLAN_RANK[minPlan]) {
      navigate("/dashboard", { replace: true });
    }
  }, [isAuthenticated, user, role, minPlan, redirectTo, navigate]);

  return { user, isAuthenticated };
}
