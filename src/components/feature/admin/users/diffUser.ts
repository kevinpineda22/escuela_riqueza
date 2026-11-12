import type { AdminUser, UserPatch } from "@/lib/api/admin/users";
import type { Plan, UserRole } from "@/types/user";

/** Solo manda lo que cambió: un correo intacto no toca la cuenta de Auth. */
export function diffUser(user: AdminUser, form: { fullName: string; email: string; role: UserRole; plan: Plan }): UserPatch {
  const patch: UserPatch = {};
  const fullName = form.fullName.trim();
  const email = form.email.trim().toLowerCase();
  if (fullName !== user.full_name) patch.fullName = fullName;
  if (email !== (user.email ?? "").toLowerCase()) patch.email = email;
  if (form.role !== user.role) patch.role = form.role;
  if (form.plan !== user.plan) patch.plan = form.plan;
  return patch;
}
