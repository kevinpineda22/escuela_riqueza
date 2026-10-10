import { supabase } from "@/lib/supabase";
import type { Plan } from "@/types/user";
import type { UserRole } from "@/types/user";

export interface AdminUser {
  id: string;
  full_name: string;
  email?: string;
  role: UserRole;
  plan: Plan;
  status: "active" | "suspended";
  created_at: string;
  updated_at: string;
}

export interface SubscriptionInfo {
  id: string;
  user_id: string;
  plan: Plan;
  status: "active" | "canceled" | "past_due" | "trialing";
  current_period_end: string | null;
  updated_at: string;
}

// Fila que devuelven los RPC admin_list_users / admin_get_user. El email solo
// llega por estos RPC (SECURITY DEFINER, exigen rol admin): la tabla profiles
// ya no permite leerlo desde el cliente.
interface AdminProfileRow {
  id: string;
  full_name: string | null;
  email: string | null;
  role: UserRole | null;
  plan: Plan | null;
  is_suspended: boolean | null;
  created_at: string;
  updated_at: string | null;
}

function mapAdminProfile(p: AdminProfileRow): AdminUser {
  return {
    id: p.id,
    full_name: p.full_name || "Usuario sin nombre",
    email: p.email || undefined,
    role: p.role || "student",
    plan: p.plan || "free", // Se lee directamente del perfil para mayor fidelidad
    status: p.is_suspended ? "suspended" : "active",
    created_at: p.created_at,
    updated_at: p.updated_at || p.created_at,
  };
}

export async function fetchAdminUsers(): Promise<AdminUser[]> {
  const { data, error } = await supabase.rpc("admin_list_users");

  if (error) throw error;

  return ((data as AdminProfileRow[] | null) || []).map(mapAdminProfile);
}

export async function fetchUserSubscription(userId: string): Promise<SubscriptionInfo | null> {
  const { data, error } = await supabase
    .from("subscriptions")
    .select("*")
    .eq("user_id", userId)
    .eq("status", "active") // Solo traer la suscripción activa
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error && error.code !== "PGRST116") throw error;
  return data;
}

export async function updateUserStatus(userId: string, isSuspended: boolean): Promise<AdminUser> {
  const { error } = await supabase.rpc("admin_toggle_suspend", {
    target_user_id: userId,
    suspend: isSuspended
  });

  if (error) {
    console.error("Error from admin_toggle_suspend:", error);
    throw error;
  }

  // Refetch del usuario para devolver los datos actualizados
  const { data, error: fetchError } = await supabase.rpc("admin_get_user", {
    target_user_id: userId,
  });

  if (fetchError) throw fetchError;

  const row = ((data as AdminProfileRow[] | null) || [])[0];
  if (!row) throw new Error("Usuario no encontrado");

  return { ...mapAdminProfile(row), status: isSuspended ? "suspended" : "active" };
}

export async function updateUserPlan(userId: string, plan: Plan): Promise<void> {
  // Llama al RPC (Stored Procedure) que tiene permisos SECURITY DEFINER
  // para evitar problemas de RLS (403 Forbidden o 406 Not Acceptable)
  const { error } = await supabase.rpc("admin_update_user_plan", {
    target_user_id: userId,
    new_plan: plan,
  });

  if (error) {
    console.error("Error from admin_update_user_plan:", error);
    throw error;
  }
}

export async function deleteUser(userId: string): Promise<void> {
  const { error } = await supabase.rpc("admin_delete_user", {
    target_user_id: userId
  });
  
  if (error) {
    console.error("Error from admin_delete_user:", error);
    throw error;
  }
}