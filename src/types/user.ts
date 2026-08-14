export const PLANS = {
  FREE: "free",
  INDIVIDUAL: "individual",
  VIP: "vip",
} as const;

export type Plan = (typeof PLANS)[keyof typeof PLANS];

export const USER_ROLES = {
  STUDENT: "student",
  ADMIN: "admin",
} as const;

export type UserRole = (typeof USER_ROLES)[keyof typeof USER_ROLES];

export interface User {
  id: string;
  email: string;
  fullName: string;
  avatarUrl: string | null;
  role: UserRole;
  plan: Plan;
  createdAt: string;
  /** true si el usuario ya confirmó su email. Opcional a propósito: sesiones
   *  guardadas antes de este campo quedan `undefined` y el guard NO las bloquea
   *  (solo bloquea cuando es explícitamente `false`). */
  emailConfirmed?: boolean;
}
