// Copia mínima de src/lib/replayVisibility.ts: las Functions de api/ no
// importan desde src/ (otro tsconfig y otro bundle). Mantener en sync con ese
// archivo y con sql/migrate-lives-replay-visibility.sql.
export type ReplayVisibility = 'hidden' | 'paid' | 'all';

export function canWatchSchoolReplay(
  visibility: unknown,
  plan: string | null | undefined,
  role: string | null | undefined,
): boolean {
  if (role === 'admin') return true;
  if (visibility === 'all') return true;
  if (visibility === 'paid') return plan === 'individual' || plan === 'vip';
  return false;
}
