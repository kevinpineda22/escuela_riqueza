import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { applyCors } from './_lib/auth.js';
import { applyRateLimit } from './_lib/ratelimit.js';

/**
 * POST /api/errors — el navegador reporta una falla (src/lib/errors/errorReporter.ts).
 *
 * Público a propósito: también falla la landing, sin sesión. Por eso: límite por
 * IP, cuerpo validado y recortado, y el usuario se resuelve desde el token (si lo
 * hay), nunca desde el cuerpo. Responde 204 aunque no pueda guardar: el reporte
 * de un error no puede generar otro error visible.
 */

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const BodySchema = z.object({
  code: z.string().regex(/^[A-Z0-9]{6}$/),
  kind: z.enum(['platform', 'network', 'offline', 'timeout']),
  source: z.string().trim().min(1).max(40),
  message: z.string().trim().min(1).transform((s) => s.slice(0, 500)),
  status: z.number().int().min(0).max(999).nullable().optional(),
  request: z.string().max(300).nullable().optional(),
  path: z.string().max(300).nullable().optional(),
  occurrences: z.number().int().min(1).max(10000).optional(),
  detail: z.record(z.string(), z.unknown()).nullable().optional(),
});

function clientIp(req: VercelRequest): string {
  const forwarded = req.headers['x-forwarded-for'];
  const first = Array.isArray(forwarded) ? forwarded[0] : forwarded?.split(',')[0];
  return first?.trim() || req.socket?.remoteAddress || 'unknown';
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (applyCors(req, res)) return;
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  // Una caída de la plataforma hace fallar a todos a la vez: 20/min por IP alcanza
  // para saber que pasó sin llenar la tabla.
  const ok = await applyRateLimit(req, res, clientIp(req), { requests: 20, window: '1 m', prefix: 'client-errors' });
  if (!ok) return;

  const parsed = BodySchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Reporte inválido' });
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) return res.status(204).end();

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // Usuario desde el token, si vino. Un token vencido no impide guardar el reporte.
  let userId: string | null = null;
  const auth = req.headers.authorization;
  if (auth?.startsWith('Bearer ')) {
    const { data } = await supabase.auth.getUser(auth.slice(7).trim());
    userId = data.user?.id ?? null;
  }

  // Detalle acotado: si es grande se guarda recortado como texto, nunca un JSON roto.
  const detailJson = parsed.data.detail ? JSON.stringify(parsed.data.detail) : null;
  const detail = detailJson === null ? null : detailJson.length <= 2000 ? parsed.data.detail : { truncated: detailJson.slice(0, 2000) };
  const userAgent = String(req.headers['user-agent'] ?? '').slice(0, 300) || null;

  const { error } = await supabase.from('client_errors').insert({
    code: parsed.data.code,
    kind: parsed.data.kind,
    source: parsed.data.source,
    message: parsed.data.message,
    status: parsed.data.status ?? null,
    request: parsed.data.request ?? null,
    path: parsed.data.path ?? null,
    occurrences: parsed.data.occurrences ?? 1,
    user_id: userId,
    user_agent: userAgent,
    detail,
  });
  if (error) console.error('[errors] no se pudo guardar el reporte:', error.message);

  return res.status(204).end();
}
