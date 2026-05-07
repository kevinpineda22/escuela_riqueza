import type { User } from "@/types/user";
import { PLANS, USER_ROLES } from "@/types/user";

export const MOCK_USERS: User[] = [
  {
    id: "user-free-001",
    email: "free@escuela.com",
    fullName: "Visitante Free",
    avatarUrl: null,
    role: USER_ROLES.STUDENT,
    plan: PLANS.FREE,
    createdAt: "2026-01-15T10:00:00.000Z",
  },
  {
    id: "user-premium-001",
    email: "usuario@premium.com",
    fullName: "David Premium",
    avatarUrl: null,
    role: USER_ROLES.STUDENT,
    plan: PLANS.INDIVIDUAL,
    createdAt: "2026-02-20T10:00:00.000Z",
  },
  {
    id: "user-vip-001",
    email: "vip@escuela.com",
    fullName: "Sofía VIP",
    avatarUrl: null,
    role: USER_ROLES.STUDENT,
    plan: PLANS.VIP,
    createdAt: "2026-03-01T10:00:00.000Z",
  },
  {
    id: "user-admin-001",
    email: "admin@escuela.com",
    fullName: "Iván Mazo",
    avatarUrl: null,
    role: USER_ROLES.ADMIN,
    plan: PLANS.VIP,
    createdAt: "2026-01-01T10:00:00.000Z",
  },
];

// Credenciales mock — todas usan password "admin123"
export const MOCK_PASSWORD = "admin123";
