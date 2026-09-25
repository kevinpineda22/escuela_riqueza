import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { signR2RecordingUrl } from './recording-url';

// `signR2RecordingUrl` es la lógica de firma compartida entre la rama
// autenticada (dashboard/admin, `live_id`) y la rama pública de repetición
// abierta (`share_token`, gated por `replay_is_public`) de recording-url.ts
// — se extrajo para que ambas ramas firmen exactamente igual y para poder
// testearla sin mockear `VercelRequest`/`VercelResponse`.
const creds = {
  accountId: 'acc123',
  accessKeyId: 'AKIDEXAMPLE',
  secretAccessKey: 'secretkey',
  bucket: 'recordings-bucket',
};

describe('signR2RecordingUrl', () => {
  it('firma una URL apuntando al endpoint S3 de la cuenta y bucket correctos', async () => {
    const url = await signR2RecordingUrl(creds, 'lives/2026-09-12/vivo.mp4');
    expect(url.startsWith('https://acc123.r2.cloudflarestorage.com/recordings-bucket/lives/2026-09-12/vivo.mp4')).toBe(true);
  });

  it('URL-encodea cada segmento del key preservando las barras', async () => {
    const url = await signR2RecordingUrl(creds, 'lives/2026 09 12/vivo final.mp4');
    expect(url).toContain('lives/2026%2009%2012/vivo%20final.mp4');
  });

  it('usa el TTL default de 900s si no se pasa uno explícito', async () => {
    const url = await signR2RecordingUrl(creds, 'key.mp4');
    expect(url).toContain('X-Amz-Expires=900');
  });

  it('respeta un TTL explícito distinto del default', async () => {
    const url = await signR2RecordingUrl(creds, 'key.mp4', 60);
    expect(url).toContain('X-Amz-Expires=60');
  });

  it('produce una firma (query params de autenticación AWS SigV4)', async () => {
    const url = await signR2RecordingUrl(creds, 'key.mp4');
    expect(url).toContain('X-Amz-Signature=');
    expect(url).toContain('X-Amz-Credential=');
  });
});

// ---- Rama pública (`share_token`) del handler ----
//
// Mockeamos `@supabase/supabase-js` para controlar la respuesta de la RPC
// `get_public_live` y así probar el gate de `replay_is_public` sin una base
// real. `requireAuth`/`applyRateLimit` se dejan pasar (fail-open, como en
// dev sin Upstash) para aislar el comportamiento del endpoint.
const rpcMock = vi.fn();

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    rpc: rpcMock,
    from: vi.fn(),
  })),
}));

function makeReq(body: unknown): VercelRequest {
  return {
    method: 'POST',
    headers: {},
    body,
    socket: { remoteAddress: '127.0.0.1' },
  } as unknown as VercelRequest;
}

function makeRes(): VercelResponse & { _status?: number; _json?: unknown } {
  const res: any = {};
  res.status = vi.fn((code: number) => {
    res._status = code;
    return res;
  });
  res.json = vi.fn((body: unknown) => {
    res._json = body;
    return res;
  });
  res.setHeader = vi.fn();
  res.end = vi.fn();
  return res;
}

describe('POST /api/stream/recording-url — rama pública (share_token)', () => {
  const ORIGINAL_ENV = { ...process.env };

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.SUPABASE_URL = 'https://example.supabase.co';
    process.env.SUPABASE_ANON_KEY = 'anon-key';
    process.env.R2_ACCOUNT_ID = 'acc123';
    process.env.R2_ACCESS_KEY_ID = 'AKIDEXAMPLE';
    process.env.R2_SECRET_ACCESS_KEY = 'secretkey';
    process.env.R2_BUCKET = 'recordings-bucket';
  });

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  it('firma la URL cuando la sala tiene replay_is_public = true', async () => {
    rpcMock.mockResolvedValue({
      data: [{ replay_is_public: true, recording_storage: 'r2', recording_r2_key: 'lives/open/vivo.mp4' }],
      error: null,
    });

    const { default: handler } = await import('./recording-url');
    const req = makeReq({ share_token: 'a-valid-share-token-123' });
    const res = makeRes();

    await handler(req, res);

    expect(rpcMock).toHaveBeenCalledWith('get_public_live', { p_token: 'a-valid-share-token-123' });
    expect(res.status).toHaveBeenCalledWith(200);
    expect((res._json as any).url).toContain('lives/open/vivo.mp4');
  });

  it('rechaza con 403 cuando replay_is_public es false', async () => {
    rpcMock.mockResolvedValue({
      data: [{ replay_is_public: false, recording_storage: 'r2', recording_r2_key: 'lives/paid/vivo.mp4' }],
      error: null,
    });

    const { default: handler } = await import('./recording-url');
    const req = makeReq({ share_token: 'a-valid-share-token-123' });
    const res = makeRes();

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
  });

  it('rechaza con 404 cuando el token no corresponde a ninguna sala pública', async () => {
    rpcMock.mockResolvedValue({ data: [], error: null });

    const { default: handler } = await import('./recording-url');
    const req = makeReq({ share_token: 'a-valid-share-token-123' });
    const res = makeRes();

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('rechaza con 400 cuando el share_token es demasiado corto', async () => {
    const { default: handler } = await import('./recording-url');
    const req = makeReq({ share_token: 'short' });
    const res = makeRes();

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(rpcMock).not.toHaveBeenCalled();
  });
});

describe('POST /api/stream/recording-url — rama autenticada (live_id) sigue intacta', () => {
  const ORIGINAL_ENV = { ...process.env };

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.SUPABASE_URL = 'https://example.supabase.co';
    process.env.SUPABASE_ANON_KEY = 'anon-key';
    process.env.R2_ACCOUNT_ID = 'acc123';
    process.env.R2_ACCESS_KEY_ID = 'AKIDEXAMPLE';
    process.env.R2_SECRET_ACCESS_KEY = 'secretkey';
    process.env.R2_BUCKET = 'recordings-bucket';
  });

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  it('sigue exigiendo JWT (401 sin Authorization) — no se salteó por agregar la rama pública', async () => {
    const { default: handler } = await import('./recording-url');
    const req = makeReq({ live_id: '123e4567-e89b-12d3-a456-426614174000' });
    const res = makeRes();

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(rpcMock).not.toHaveBeenCalled();
  });
});
