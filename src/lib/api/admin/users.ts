import { supabase } from "@/lib/supabase";
import { ApiError, authedFetch } from "@/lib/api/client";
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

export interface ActiveSubscription {
  plan: Plan;
  /** null = sin vigencia (VIP: formación presencial, no paga la plataforma). */
  endDate: string | null;
}

/** Suscripción activa de cada usuario, en UNA consulta (antes era una por fila). */
export async function fetchActiveSubscriptions(): Promise<Record<string, ActiveSubscription>> {
  const { data, error } = await supabase
    .from("subscriptions")
    .select("user_id, plan, current_period_end, updated_at")
    .eq("status", "active")
    .order("updated_at", { ascending: false });

  if (error) throw error;

  const map: Record<string, ActiveSubscription> = {};
  for (const row of (data ?? []) as { user_id: string; plan: Plan; current_period_end: string | null }[]) {
    // Orden descendente: la primera de cada usuario es la más reciente.
    if (!map[row.user_id]) map[row.user_id] = { plan: row.plan, endDate: row.current_period_end };
  }
  return map;
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

// ── Endpoint /api/admin/users ─────────────────────────────────────────────
// Crear, editar el correo de login o borrar la cuenta de Auth necesita la clave
// de servicio: pasa por la Vercel Function (solo admins), no por RPC.

export async function adminUsersRequest<T>(body: Record<string, unknown>): Promise<T> {
  const res = await authedFetch("/api/admin/users", { method: "POST", body: JSON.stringify(body) });
  const data = (await res.json().catch(() => null)) as ({ error?: string } & T) | null;
  if (!res.ok) {
    throw new ApiError("admin_users", data?.error || "No se pudo completar la operación", res.status);
  }
  return data as T;
}

export interface AccessDelivery {
  /** Contraseña temporal: mostrarla UNA vez para que el admin la pueda pasar a mano. */
  tempPassword: string;
  emailSent: boolean;
  emailError?: string;
}

interface AccessDeliveryResponse {
  temp_password: string;
  email_sent: boolean;
  email_error?: string;
}

const toDelivery = (r: AccessDeliveryResponse): AccessDelivery => ({
  tempPassword: r.temp_password,
  emailSent: r.email_sent,
  ...(r.email_error ? { emailError: r.email_error } : {}),
});

export interface NewUserInput {
  fullName: string;
  email: string;
  plan: Plan;
  role: UserRole;
  /** Manda el correo con la contraseña temporal. */
  sendEmail: boolean;
}

export async function createAdminUser(input: NewUserInput): Promise<{ user: AdminUser } & AccessDelivery> {
  const r = await adminUsersRequest<{ user: AdminProfileRow } & AccessDeliveryResponse>({
    action: "create",
    full_name: input.fullName,
    email: input.email,
    plan: input.plan,
    role: input.role,
    send_email: input.sendEmail,
  });
  return { user: mapAdminProfile(r.user), ...toDelivery(r) };
}

export interface UserPatch {
  fullName?: string;
  email?: string;
  role?: UserRole;
  plan?: Plan;
}

export async function updateAdminUser(userId: string, patch: UserPatch): Promise<AdminUser> {
  const r = await adminUsersRequest<{ user: AdminProfileRow }>({
    action: "update",
    user_id: userId,
    ...(patch.fullName !== undefined ? { full_name: patch.fullName } : {}),
    ...(patch.email !== undefined ? { email: patch.email } : {}),
    ...(patch.role !== undefined ? { role: patch.role } : {}),
    ...(patch.plan !== undefined ? { plan: patch.plan } : {}),
  });
  return mapAdminProfile(r.user);
}

export async function updateUserPlan(userId: string, plan: Plan): Promise<void> {
  await updateAdminUser(userId, { plan });
}

/** Contraseña temporal nueva + correo de acceso. Obliga a cambiarla al entrar. */
export async function resendAccess(userId: string): Promise<AccessDelivery> {
  return toDelivery(await adminUsersRequest<AccessDeliveryResponse>({ action: "resend_access", user_id: userId }));
}

/** Borra la cuenta de Auth (y con ella el perfil): el correo queda libre. */
export async function deleteUser(userId: string): Promise<void> {
  await adminUsersRequest<{ ok: true }>({ action: "delete", user_id: userId });
}
