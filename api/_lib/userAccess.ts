// Reglas de alta y de plan compartidas por /api/admin/users y por
// scripts/onboard-cohort.mjs (que importa este .ts directo con el type
// stripping de Node 24: solo `import type` y módulos de Node, nada más).
import { randomInt } from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';

export type Plan = 'free' | 'individual' | 'vip';

export const PLAN_RANK: Record<Plan, number> = { free: 0, individual: 1, vip: 2 };

const DAY_MS = 86_400_000;

/**
 * 12 caracteres sin confundibles (sin 0/O, 1/l/I), con al menos una mayúscula,
 * una minúscula y un número, en bloques de 4 para dictarla: "Ab3d-EfGh-2jKm".
 */
export function tempPassword(): string {
  const sets = ['ABCDEFGHJKLMNPQRSTUVWXYZ', 'abcdefghijkmnpqrstuvwxyz', '23456789'];
  const all = sets.join('');
  const chars = sets.map((s) => s[randomInt(s.length)]!);
  while (chars.length < 12) chars.push(all[randomInt(all.length)]!);
  for (let i = chars.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [chars[i], chars[j]] = [chars[j]!, chars[i]!];
  }
  const s = chars.join('');
  return `${s.slice(0, 4)}-${s.slice(4, 8)}-${s.slice(8)}`;
}

/**
 * Fin de vigencia al asignar `plan`.
 * - VIP: SIN vigencia (null). Es el plan de la formación presencial: esa gente
 *   no paga la plataforma y no debe ver "Próximo cobro" ni una fecha de corte.
 * - Otro plan: conserva la fecha que ya tenía; si no tenía (venía de VIP o es
 *   nueva), 30 días desde `now`.
 */
export function periodEndFor(plan: Plan, current: string | null | undefined, now = Date.now()): string | null {
  if (plan === 'vip') return null;
  return current ?? new Date(now + 30 * DAY_MS).toISOString();
}

/**
 * Deja `plan` en la suscripción activa (la crea si no hay) y en el perfil.
 * Con la clave de servicio: el trigger que protege profiles.plan solo frena a
 * los roles de cliente.
 */
export async function applyPlan(supabase: SupabaseClient, userId: string, plan: Plan): Promise<void> {
  const { data: subs, error: readError } = await supabase
    .from('subscriptions')
    .select('id, current_period_end')
    .eq('user_id', userId)
    .eq('status', 'active')
    .order('updated_at', { ascending: false })
    .limit(1);
  if (readError) throw new Error(`suscripción: ${readError.message}`);

  const current = subs?.[0] as { id: string; current_period_end: string | null } | undefined;
  const now = new Date().toISOString();
  const fields = { plan, current_period_end: periodEndFor(plan, current?.current_period_end), updated_at: now };

  const { error: subError } = current
    ? await supabase.from('subscriptions').update(fields).eq('id', current.id)
    : await supabase.from('subscriptions').insert({ user_id: userId, status: 'active', ...fields });
  if (subError) throw new Error(`suscripción: ${subError.message}`);

  const { error: profileError } = await supabase
    .from('profiles')
    .update({ plan, updated_at: now })
    .eq('id', userId);
  if (profileError) throw new Error(`perfil: ${profileError.message}`);
}
