import type { VercelRequest, VercelResponse } from '@vercel/node';
import { z } from 'zod';
import { createClient } from '@supabase/supabase-js';
import { AwsClient } from 'aws4fetch';
import { applyCors, requireAuth } from '../_lib/auth.js';
import { applyRateLimit } from '../_lib/ratelimit.js';

const BodySchema = z.object({
  live_id: z.string().uuid(),
});

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;

// Cuánto vive la URL firmada (segundos). Corta a propósito: es contenido VIP.
const URL_TTL_SECONDS = 900; // 15 min

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (applyCors(req, res)) return;

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const user = await requireAuth(req, res);
  if (!user) return;

  const ok = await applyRateLimit(req, res, user.id, {
    requests: 30,
    window: '1 m',
    prefix: 'recording-url',
  });
  if (!ok) return;

  const parsed = BodySchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Falta live_id válido' });
  }
  const { live_id } = parsed.data;

  const r2AccountId = process.env.R2_ACCOUNT_ID;
  const r2AccessKeyId = process.env.R2_ACCESS_KEY_ID;
  const r2SecretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  const r2Bucket = process.env.R2_BUCKET;

  if (!r2AccountId || !r2AccessKeyId || !r2SecretAccessKey || !r2Bucket) {
    console.error('Missing R2 credentials');
    return res.status(500).json({ error: 'Almacenamiento de grabaciones no configurado' });
  }
  if (!SUPABASE_URL || !(SUPABASE_SERVICE_ROLE_KEY || SUPABASE_ANON_KEY)) {
    console.error('Missing Supabase env vars');
    return res.status(500).json({ error: 'Backend mal configurado' });
  }

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

  // Firmar una URL GET de vida corta contra el endpoint S3 de R2.
  try {
    const aws = new AwsClient({
      accessKeyId: r2AccessKeyId,
      secretAccessKey: r2SecretAccessKey,
      region: 'auto',
      service: 's3',
    });

    const objectUrl =
      `https://${r2AccountId}.r2.cloudflarestorage.com/${r2Bucket}/` +
      live.recording_r2_key.split('/').map(encodeURIComponent).join('/');

    const signed = await aws.sign(
      new Request(`${objectUrl}?X-Amz-Expires=${URL_TTL_SECONDS}`, { method: 'GET' }),
      { aws: { signQuery: true } },
    );

    return res.status(200).json({ url: signed.url, expiresIn: URL_TTL_SECONDS });
  } catch (err) {
    console.error('Error firmando URL R2:', err);
    return res.status(500).json({ error: 'No se pudo generar el enlace de la grabación' });
  }
}
