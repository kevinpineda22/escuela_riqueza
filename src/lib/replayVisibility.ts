import { PLANS, USER_ROLES, type Plan, type UserRole } from "@/types/user";

/**
 * Visibilidad de la repetición de un live finalizado para los alumnos.
 * Mantener en sync con `sql/migrate-lives-replay-visibility.sql` y con
 * `api/_lib/replayVisibility.ts` (api/ no importa desde src/, por eso hay
 * una copia mínima allá). La fuente de verdad real es el servidor; esto
 * solo controla la UI.
 */
export const REPLAY_VISIBILITIES = ["hidden", "paid", "all"] as const;

export type ReplayVisibility = (typeof REPLAY_VISIBILITIES)[number];

export function isReplayVisibility(value: unknown): value is ReplayVisibility {
  return typeof value === "string" && (REPLAY_VISIBILITIES as readonly string[]).includes(value);
}

/** Admin siempre; "all" cualquier plan; "paid" solo Individual y VIP; "hidden" nadie más. */
export function canWatchSchoolReplay(
  visibility: ReplayVisibility,
  plan: Plan | null | undefined,
  role: UserRole | null | undefined,
): boolean {
  if (role === USER_ROLES.ADMIN) return true;
  if (visibility === "all") return true;
  if (visibility === "paid") return plan === PLANS.INDIVIDUAL || plan === PLANS.VIP;
  return false;
}
