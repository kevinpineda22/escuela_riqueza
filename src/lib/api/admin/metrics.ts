import { supabase } from "@/lib/supabase";

export type MetricsPeriod = "7d" | "month" | "year" | "all";

export interface DashboardMetrics {
  totalUsers: number;
  newUsersInPeriod: number;
  usersByPlan: {
    free: number;
    individual: number;
    vip: number;
  };
  totalRevenue: number;
  revenueInPeriod: number;
  publishedModules: number;
  topLessons: {
    title: string;
    views: number;
  }[];
}

/**
 * Convierte el período seleccionado en el filtro a una fecha "since".
 * Si retorna null, significa "Histórico" (sin filtro).
 */
function periodToSince(period: MetricsPeriod): Date | null {
  const now = new Date();
  switch (period) {
    case "7d": {
      const d = new Date(now);
      d.setDate(d.getDate() - 7);
      return d;
    }
    case "month": {
      // Desde el día 1 del mes actual a las 00:00
      return new Date(now.getFullYear(), now.getMonth(), 1);
    }
    case "year": {
      return new Date(now.getFullYear(), 0, 1);
    }
    case "all":
    default:
      return null;
  }
}

export async function fetchDashboardMetrics(
  period: MetricsPeriod = "all"
): Promise<DashboardMetrics> {
  const since = periodToSince(period);
  const sinceIso = since ? since.toISOString() : null;

  // 1. Total users + usuarios por plan (cumulativo, sin filtro)
  const { data: usersData, error: usersError } = await supabase
    .from("profiles")
    .select("plan");

  if (usersError) throw usersError;

  let totalUsers = 0;
  const usersByPlan = { free: 0, individual: 0, vip: 0 };

  usersData?.forEach((u) => {
    totalUsers++;
    if (u.plan === "free" || u.plan === "anon") usersByPlan.free++;
    if (u.plan === "individual") usersByPlan.individual++;
    if (u.plan === "vip") usersByPlan.vip++;
  });

  // Ingreso estimado cumulativo (sin filtro de período)
  const totalRevenue = usersByPlan.individual * 29 + usersByPlan.vip * 99;

  // 2. Módulos publicados (cumulativo)
  const { count: publishedModules, error: modError } = await supabase
    .from("modules")
    .select("*", { count: "exact", head: true })
    .eq("is_published", true);

  if (modError) throw modError;

  // 3. Top lecciones filtradas por período (RPC SECURITY DEFINER)
  const { data: topLessonsData, error: topError } = await supabase.rpc(
    "admin_get_top_lessons",
    { limit_count: 5, since: sinceIso }
  );
  if (topError) console.error("Error fetching top lessons:", topError);

  const topLessons = (topLessonsData || []).map(
    (row: { title: string; views: number }) => ({
      title: row.title,
      views: Number(row.views) || 0,
    })
  );

  // 4. Nuevos usuarios en el período
  const { data: newUsersCount, error: newErr } = await supabase.rpc(
    "admin_count_new_users",
    { since: sinceIso }
  );
  if (newErr) console.error("Error fetching new users:", newErr);

  // 5. Ingresos del período (hoy: estimación sobre suscripciones cuyo updated_at cae en el rango)
  const { data: revenuePeriod, error: revErr } = await supabase.rpc(
    "admin_revenue_in_period",
    { since: sinceIso }
  );
  if (revErr) console.error("Error fetching revenue in period:", revErr);

  return {
    totalUsers,
    newUsersInPeriod: Number(newUsersCount) || 0,
    usersByPlan,
    totalRevenue,
    revenueInPeriod: Number(revenuePeriod) || 0,
    publishedModules: publishedModules || 0,
    topLessons,
  };
}
