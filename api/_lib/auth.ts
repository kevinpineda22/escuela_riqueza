import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;

export interface AuthedUser {
  id: string;
  email: string | undefined;
  role: 'student' | 'admin';
  plan: 'free' | 'individual' | 'vip' | null;
}

function extractToken(req: VercelRequest): string | null {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) return null;
  const token = header.slice(7).trim();
  return token || null;
}

async function getUserFromToken(token: string): Promise<AuthedUser | null> {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    console.error('Missing Supabase env vars for server-side auth');
    return null;
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: userData, error: userError } = await supabase.auth.getUser(token);
  if (userError || !userData.user) return null;

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('role, plan')
    .eq('id', userData.user.id)
    .maybeSingle();

  if (profileError || !profile) return null;

  return {
    id: userData.user.id,
    email: userData.user.email,
    role: profile.role,
    plan: profile.plan,
  };
}

/**
 * Bloquea la request si no hay JWT válido. Devuelve el user o `null` si ya
 * respondió con 401. Callers DEBEN hacer `if (!user) return;` tras llamarla.
 */
export async function requireAuth(
  req: VercelRequest,
  res: VercelResponse,
): Promise<AuthedUser | null> {
  const token = extractToken(req);
  if (!token) {
    res.status(401).json({ error: 'No autorizado: falta token Bearer' });
    return null;
  }
  const user = await getUserFromToken(token);
  if (!user) {
    res.status(401).json({ error: 'No autorizado: token inválido o expirado' });
    return null;
  }
  return user;
}

/**
 * Variante de `requireAuth` que además exige `role === 'admin'`.
 * Devuelve `null` y ya respondió 401/403 si no califica.
 */
export async function requireAdmin(
  req: VercelRequest,
  res: VercelResponse,
): Promise<AuthedUser | null> {
  const user = await requireAuth(req, res);
  if (!user) return null;
  if (user.role !== 'admin') {
    res.status(403).json({ error: 'Solo administradores' });
    return null;
  }
  return user;
}

const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || '')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

/**
 * Setea headers CORS específicos. En dev permite el origin actual; en prod
 * usa la lista `ALLOWED_ORIGINS` (env). Para preflight devuelve `true` si ya
 * respondió 204 y el handler debe retornar.
 */
export function applyCors(req: VercelRequest, res: VercelResponse): boolean {
  const origin = req.headers.origin;
  const isDev = process.env.NODE_ENV !== 'production';

  let allowedOrigin = '';
  if (origin && (isDev || ALLOWED_ORIGINS.includes(origin))) {
    allowedOrigin = origin;
  } else if (ALLOWED_ORIGINS.length > 0) {
    allowedOrigin = ALLOWED_ORIGINS[0]!;
  }

  if (allowedOrigin) {
    res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
    res.setHeader('Vary', 'Origin');
  }
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'Content-Type, Authorization, tus-resumable, upload-length, upload-metadata',
  );

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return true;
  }
  return false;
}
