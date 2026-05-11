import { supabase } from "@/lib/supabase";

export interface DashboardMetrics {
  totalUsers: number;
  usersByPlan: {
    free: number;
    individual: number;
    vip: number;
  };
  totalRevenue: number;
  publishedModules: number;
  topLessons: {
    title: string;
    views: number;
  }[];
}

export async function fetchDashboardMetrics(): Promise<DashboardMetrics> {
  // 1. Total users & Users by Plan
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

  // Cálculo temporal de ingresos (Mock)
  // A futuro esto vendrá de Stripe Webhooks a la tabla subscriptions
  const totalRevenue = (usersByPlan.individual * 29) + (usersByPlan.vip * 99);

  // 2. Published Modules
  const { count: publishedModules, error: modError } = await supabase
    .from("modules")
    .select("*", { count: "exact", head: true })
    .eq("is_published", true);

  if (modError) throw modError;

  // 3. Top Lessons (from user_lesson_progress)
  // This uses a raw query to group and count. We can do it by fetching all or via RPC.
  // For MVP, fetch all progress or create a view. We'll fetch all and aggregate in JS for simplicity since data is small, 
  // or use RPC. Let's do a simple join if Supabase supports it, or aggregate in JS.
  const { data: progressData, error: progError } = await supabase
    .from("user_lesson_progress")
    .select("lesson_id");

  if (progError) throw progError;

  const viewsMap: Record<string, number> = {};
  progressData?.forEach(p => {
    viewsMap[p.lesson_id] = (viewsMap[p.lesson_id] || 0) + 1;
  });

  const { data: lessonsData } = await supabase
    .from("lessons")
    .select("id, title");

  const topLessons = lessonsData
    ?.map(l => ({
      title: l.title,
      views: viewsMap[l.id] || 0
    }))
    .sort((a, b) => b.views - a.views)
    .slice(0, 5) || [];

  return {
    totalUsers,
    usersByPlan,
    totalRevenue,
    publishedModules: publishedModules || 0,
    topLessons,
  };
}
