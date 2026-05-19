import type { VercelRequest, VercelResponse } from '@vercel/node';
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

const REDIS_URL = process.env.UPSTASH_REDIS_REST_URL;
const REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;

// Singleton del cliente Redis. Si no hay env vars, queda null y el rate limit
// FALLA ABIERTO (no bloquea) — útil para dev local sin Upstash configurado.
const redis: Redis | null =
  REDIS_URL && REDIS_TOKEN
    ? new Redis({ url: REDIS_URL, token: REDIS_TOKEN })
    : null;

if (!redis && process.env.NODE_ENV === 'production') {
  console.warn(
    '[ratelimit] UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN ausentes — rate limit deshabilitado en producción',
  );
}

interface RateLimitConfig {
  /** Cuántas requests están permitidas en la ventana. */
  requests: number;
  /** Ventana de tiempo (ej. '1 m', '10 s', '1 h'). */
  window: `${number} ${'s' | 'ms' | 'm' | 'h' | 'd'}`;
  /** Prefijo único por endpoint para no compartir el bucket. */
  prefix: string;
}

const limiters = new Map<string, Ratelimit>();

function getLimiter(config: RateLimitConfig): Ratelimit | null {
  if (!redis) return null;
  const key = `${config.prefix}:${config.requests}:${config.window}`;
  let limiter = limiters.get(key);
  if (!limiter) {
    limiter = new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(config.requests, config.window),
      prefix: `ratelimit:${config.prefix}`,
      analytics: false,
    });
    limiters.set(key, limiter);
  }
  return limiter;
}

/**
 * Aplica rate limit por `identifier` (típicamente `user.id`).
 *
 * Devuelve `true` si la request pasó. Devuelve `false` si fue bloqueada y
 * ya respondió 429 — el handler debe `return;` inmediatamente.
 *
 * Fail-open: si Upstash no está configurado o falla, deja pasar.
 */
export async function applyRateLimit(
  _req: VercelRequest,
  res: VercelResponse,
  identifier: string,
  config: RateLimitConfig,
): Promise<boolean> {
  const limiter = getLimiter(config);
  if (!limiter) return true; // no configurado → fail-open

  try {
    const { success, limit, remaining, reset } = await limiter.limit(identifier);

    res.setHeader('X-RateLimit-Limit', String(limit));
    res.setHeader('X-RateLimit-Remaining', String(Math.max(0, remaining)));
    res.setHeader('X-RateLimit-Reset', String(reset));

    if (!success) {
      const retryAfter = Math.max(1, Math.ceil((reset - Date.now()) / 1000));
      res.setHeader('Retry-After', String(retryAfter));
      res.status(429).json({
        error: 'Demasiadas requests, esperá unos segundos',
        retry_after: retryAfter,
      });
      return false;
    }
    return true;
  } catch (err) {
    console.error('[ratelimit] error consultando Upstash, dejando pasar:', err);
    return true; // fail-open ante errores de red/Redis
  }
}
