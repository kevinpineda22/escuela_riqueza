import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { VercelRequest, VercelResponse } from '@vercel/node';

// Authed branch (live_id): authorization by school replay visibility.
// `requireAuth` and `from('lives')` are mocked to control user and live row.
const authState: { user: { id: string; role: string; plan: string | null } } = {
  user: { id: 'u1', role: 'student', plan: 'free' },
};
const liveRow = vi.fn();

vi.mock('../_lib/auth.js', () => ({
  applyCors: vi.fn(() => false),
  requireAuth: vi.fn(async () => authState.user),
}));
vi.mock('../_lib/ratelimit.js', () => ({ applyRateLimit: vi.fn(async () => true) }));
vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    rpc: vi.fn(),
    from: vi.fn(() => ({
      select: vi.fn(() => ({ eq: vi.fn(() => ({ maybeSingle: liveRow })) })),
    })),
  })),
}));

const LIVE_ID = '123e4567-e89b-12d3-a456-426614174000';

function makeRes(): VercelResponse & { _status?: number; _json?: unknown } {
  const res = {} as VercelResponse & { _status?: number; _json?: unknown };
  res.status = vi.fn((c: number) => ((res._status = c), res));
  res.json = vi.fn((b: unknown) => ((res._json = b), res));
  res.setHeader = vi.fn();
  return res;
}

async function call(user: { role: string; plan: string | null }, live: Record<string, unknown>) {
  authState.user = { id: 'u1', ...user };
  liveRow.mockResolvedValue({
    data: { recording_r2_key: 'rec/x.mp4', recording_storage: 'r2', allowed_plans: [], status: 'ended', replay_visibility: 'hidden', ...live },
    error: null,
  });
  const { default: handler } = await import('./recording-url');
  const res = makeRes();
  await handler({ method: 'POST', headers: {}, body: { live_id: LIVE_ID }, socket: {} } as unknown as VercelRequest, res);
  return res;
}

describe('POST /api/stream/recording-url — school replay visibility (authed)', () => {
  const ORIGINAL_ENV = { ...process.env };
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.SUPABASE_URL = 'https://example.supabase.co';
    process.env.SUPABASE_ANON_KEY = 'anon-key';
    process.env.R2_ACCOUNT_ID = 'acc123';
    process.env.R2_ACCESS_KEY_ID = 'AKIDEXAMPLE';
    process.env.R2_SECRET_ACCESS_KEY = 'secretkey';
    process.env.R2_BUCKET = 'bucket';
  });
  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  it("free + 'all' is authorized", async () => {
    const res = await call({ role: 'student', plan: 'free' }, { replay_visibility: 'all' });
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it("free + 'paid' gets 403", async () => {
    const res = await call({ role: 'student', plan: 'free' }, { replay_visibility: 'paid' });
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it("individual + 'paid' is authorized", async () => {
    const res = await call({ role: 'student', plan: 'individual' }, { replay_visibility: 'paid' });
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it("vip + 'paid' is authorized", async () => {
    const res = await call({ role: 'student', plan: 'vip' }, { replay_visibility: 'paid' });
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it("'hidden' gets 403 for non-admin", async () => {
    const res = await call({ role: 'student', plan: 'vip' }, { replay_visibility: 'hidden' });
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it("'hidden' gets 403 even when allowed_plans includes the plan", async () => {
    const res = await call({ role: 'student', plan: 'vip' }, { replay_visibility: 'hidden', allowed_plans: ['vip'] });
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it('admin passes with hidden visibility', async () => {
    const res = await call({ role: 'admin', plan: 'vip' }, { replay_visibility: 'hidden' });
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it('visibility does not apply while the live is not ended', async () => {
    const res = await call({ role: 'student', plan: 'vip' }, { replay_visibility: 'all', status: 'live' });
    expect(res.status).toHaveBeenCalledWith(403);
  });
});
