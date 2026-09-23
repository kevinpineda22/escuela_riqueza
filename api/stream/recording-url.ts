import type { VercelRequest, VercelResponse } from '@vercel/node';
import { z } from 'zod';
import { createClient } from '@supabase/supabase-js';
import { AwsClient } from 'aws4fetch';
import { applyCors, requireAuth } from '../_lib/auth.js';
import { applyRateLimit } from '../_lib/ratelimit.js';

// Identifica el live por `live_id` y autoriza contra `allowed_plans` del
// usuario logueado. Es la única rama del endpoint: la repetición de un live
// público (`/live/:token`) también pasa por acá con sesión iniciada — la
// rama anónima por `share_token` fue eliminada porque firmaba una URL de R2
// sin validar el plan de quien la pedía (ver docs/CHANGELOG.md 2026-09-22).
const BodySchema = z.object({
  live_id: z.string().uuid(),
});

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;

// Cuánto vive la URL firmada (segundos). Corta a propósito: es contenido VIP.
const URL_TTL_SECONDS = 900; // 15 min

interface R2Credentials {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
}

function getR2Credentials(): R2Credentials | null {
  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  const bucket = process.env.R2_BUCKET;
  if (!accountId || !accessKeyId || !secretAccessKey || !bucket) return null;
  return { accountId, accessKeyId, secretAccessKey, bucket };
}

/**
 * Firma una URL GET de vida corta contra el endpoint S3-compatible de R2 para
 * el `key` dado. Extraída como función pura (sin `req`/`res`) para poder
 * testearla sin mockear Vercel.
 */
export async function signR2RecordingUrl(
  creds: R2Credentials,
  key: string,
  ttlSeconds: number = URL_TTL_SECONDS,
): Promise<string> {
  const aws = new AwsClient({
    accessKeyId: creds.accessKeyId,
    secretAccessKey: creds.secretAccessKey,
    region: 'auto',
    service: 's3',
  });

  const objectUrl =
    `https://${creds.accountId}.r2.cloudflarestorage.com/${creds.bucket}/` +
    key.split('/').map(encodeURIComponent).join('/');

  const signed = await aws.sign(
    new Request(`${objectUrl}?X-Amz-Expires=${ttlSeconds}`, { method: 'GET' }),
    { aws: { signQuery: true } },
  );

  return signed.url;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (applyCors(req, res)) return;

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const parsed = BodySchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Falta live_id válido' });
  }

  if (!SUPABASE_URL || !(SUPABASE_SERVICE_ROLE_KEY || SUPABASE_ANON_KEY)) {
    console.error('Missing Supabase env vars');
    return res.status(500).json({ error: 'Backend mal configurado' });
  }

  const r2Creds = getR2Credentials();
  if (!r2Creds) {
    console.error('Missing R2 credentials');
    return res.status(500).json({ error: 'Almacenamiento de grabaciones no configurado' });
  }

  const user = await requireAuth(req, res);
  if (!user) return;

  const ok = await applyRateLimit(req, res, user.id, {
    requests: 30,
    window: '1 m',
    prefix: 'recording-url',
  });
  if (!ok) return;

  const { live_id } = parsed.data;

  // Cliente con service role: leemos el live y autorizamos nosotros
  // (comparando el plan del usuario contra allowed_plans).
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY || SUPABASE_ANON_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: live, error } = await supabase
    .from('lives')
    .select('recording_r2_key, recording_storage, allowed_plans')
    .eq('id', live_id)
    .maybeSingle();

  if (error) {
    console.error('Supabase error:', error);
    return res.status(500).json({ error: 'Error consultando la grabación' });
  }
  if (!live) {
    return res.status(404).json({ error: 'Grabación no encontrada' });
  }

  // Autorización: el plan del usuario debe estar en allowed_plans (admin siempre pasa).
  const allowed: string[] = Array.isArray(live.allowed_plans) ? live.allowed_plans : [];
  const authorized = user.role === 'admin' || (user.plan != null && allowed.includes(user.plan));
  if (!authorized) {
    return res.status(403).json({ error: 'Tu plan no incluye acceso a esta grabación' });
  }

  // Esta grabación tiene que estar en R2 (las viejas siguen en Stream por otro camino).
  if (live.recording_storage !== 'r2' || !live.recording_r2_key) {
    return res.status(409).json({ error: 'Esta grabación aún no está archivada en R2' });
  }

  try {
    const url = await signR2RecordingUrl(r2Creds, live.recording_r2_key);
    return res.status(200).json({ url, expiresIn: URL_TTL_SECONDS });
  } catch (err) {
    console.error('Error firmando URL R2:', err);
    return res.status(500).json({ error: 'No se pudo generar el enlace de la grabación' });
  }
}
