import { PLANS, USER_ROLES, type Plan, type UserRole } from "@/types/user";

/**
 * Reglas de acceso por plan para la Comunidad y los Certificados.
 * Mantener en sync con `sql/migrate-community-free-readonly.sql`
 * (RLS es la fuente de verdad real; esto solo controla la UI).
 */

/** Admin siempre tiene acceso completo, sin importar el plan. */
function isAdmin(role: UserRole | null | undefined): boolean {
  return role === USER_ROLES.ADMIN;
}

/** Free, Individual, VIP y admin pueden LEER la comunidad. */
export function canReadCommunity(plan: Plan | null | undefined, role: UserRole | null | undefined): boolean {
  if (isAdmin(role)) return true;
  return plan === PLANS.FREE || plan === PLANS.INDIVIDUAL || plan === PLANS.VIP;
}

/** Solo Individual, VIP y admin pueden ESCRIBIR (publicar, comentar, reaccionar). */
export function canWriteCommunity(plan: Plan | null | undefined, role: UserRole | null | undefined): boolean {
  if (isAdmin(role)) return true;
  return plan === PLANS.INDIVIDUAL || plan === PLANS.VIP;
}

/** Free no puede completar módulos, por lo tanto no accede a certificados. */
export function canAccessCertificates(plan: Plan | null | undefined, role: UserRole | null | undefined): boolean {
  if (isAdmin(role)) return true;
  return plan === PLANS.INDIVIDUAL || plan === PLANS.VIP;
}

/**
 * El en vivo público (`/live/<token>`) es abierto para cualquiera, pero la
 * repetición (grabación) es contenido pago: solo Individual, VIP y admin.
 * Free y anónimos ven el en vivo pero no la repetición.
 */
export function canWatchReplay(plan: Plan | null | undefined, role: UserRole | null | undefined): boolean {
  if (isAdmin(role)) return true;
  return plan === PLANS.INDIVIDUAL || plan === PLANS.VIP;
}
