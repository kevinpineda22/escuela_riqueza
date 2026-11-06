import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { VercelRequest, VercelResponse } from '@vercel/node';

const mocks = vi.hoisted(() => {
  process.env.SUPABASE_URL = 'https://test.supabase.co';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-key';
  process.env.RESEND_API_KEY = 're_test';
  return {
    admin: {
      createUser: vi.fn(),
      updateUserById: vi.fn(),
      getUserById: vi.fn(),
      deleteUser: vi.fn(),
    },
    from: vi.fn(),
    send: vi.fn(),
    requireAdmin: vi.fn(),
  };
});

vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({ auth: { admin: mocks.admin }, from: mocks.from }),
}));
vi.mock('resend', () => ({
  Resend: class {
    emails = { send: mocks.send };
  },
}));
vi.mock('../_lib/auth.js', () => ({
  applyCors: () => false,
  requireAdmin: mocks.requireAdmin,
}));

import handler from './users';

const ADMIN_ID = '11111111-1111-4111-8111-111111111111';
const USER_ID = '22222222-2222-4222-8222-222222222222';

const profileRow = {
  id: USER_ID,
  full_name: 'Martin Ciro',
  email: 'andres_1612@outlook.com',
  role: 'student',
  plan: 'vip',
  is_suspended: false,
  created_at: '2026-11-06T00:00:00Z',
  updated_at: '2026-11-06T00:00:00Z',
};

/** Builder encadenable de supabase-js: cualquier método devuelve el builder; await → result. */
function query(result: unknown = { data: null, error: null }) {
  const calls: Record<string, unknown[][]> = {};
  const builder: Record<string, unknown> = {};
  for (const m of ['select', 'eq', 'order', 'limit', 'update', 'insert', 'upsert', 'delete']) {
    builder[m] = vi.fn((...args: unknown[]) => {
      (calls[m] ??= []).push(args);
      return builder;
    });
  }
  builder.maybeSingle = vi.fn(() => Promise.resolve(result));
  builder.then = (resolve: (v: unknown) => unknown, reject: (e: unknown) => unknown) =>
    Promise.resolve(result).then(resolve, reject);
  return Object.assign(builder, { calls });
}

function call(body: unknown) {
  const res = {
    statusCode: 0,
    body: undefined as unknown,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(payload: unknown) {
      this.body = payload;
      return this;
    },
    setHeader: vi.fn(),
    end: vi.fn(),
  };
  const req = { method: 'POST', headers: {}, body } as unknown as VercelRequest;
  return handler(req, res as unknown as VercelResponse).then(() => res);
}

describe('POST /api/admin/users', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireAdmin.mockResolvedValue({ id: ADMIN_ID, role: 'admin', email: 'admin@escuela.com', plan: 'vip' });
    mocks.send.mockResolvedValue({ data: { id: 'email-1' }, error: null });
  });

  it('crea la cuenta VIP sin vigencia, marca el cambio de contraseña y manda el acceso', async () => {
    mocks.admin.createUser.mockResolvedValue({ data: { user: { id: USER_ID } }, error: null });
    const subs = query({ data: [{ id: 'sub-1', current_period_end: '2026-12-06T00:00:00Z' }], error: null });
    const profiles = query({ data: profileRow, error: null });
    mocks.from.mockImplementation((table: string) =>
      table === 'subscriptions' ? subs : table === 'profiles' ? profiles : query(),
    );

    const res = await call({
      action: 'create',
      email: '  Andres_1612@Outlook.com ',
      full_name: 'Martin Ciro',
      plan: 'vip',
    });

    expect(res.statusCode).toBe(201);
    const created = mocks.admin.createUser.mock.calls[0]![0];
    expect(created.email).toBe('andres_1612@outlook.com');
    expect(created.email_confirm).toBe(true);
    expect(created.app_metadata).toEqual({ must_change_password: true });
    // VIP: la suscripción que creó el trigger (30 días) queda sin vigencia.
    expect(subs.calls.update![0]![0]).toMatchObject({ plan: 'vip', current_period_end: null });
    expect(mocks.send).toHaveBeenCalledOnce();
    const sent = mocks.send.mock.calls[0]![0];
    expect(sent.to).toBe('andres_1612@outlook.com');
    const body = res.body as { temp_password: string; email_sent: boolean };
    expect(sent.text).toContain(body.temp_password);
    expect(body.email_sent).toBe(true);
  });

  it('si el correo falla, la cuenta queda creada y devuelve la contraseña para pasarla a mano', async () => {
    mocks.admin.createUser.mockResolvedValue({ data: { user: { id: USER_ID } }, error: null });
    mocks.from.mockImplementation((table: string) =>
      table === 'profiles' ? query({ data: profileRow, error: null }) : query({ data: [], error: null }),
    );
    mocks.send.mockResolvedValue({ data: null, error: { message: 'dominio no verificado' } });

    const res = await call({ action: 'create', email: 'a@b.com', full_name: 'Ana Pérez', plan: 'free' });

    expect(res.statusCode).toBe(201);
    expect(res.body).toMatchObject({ email_sent: false, email_error: 'dominio no verificado' });
    expect((res.body as { temp_password: string }).temp_password).toMatch(/^.{4}-.{4}-.{4}$/);
  });

  it('un correo que ya tiene cuenta da 409, no un error genérico', async () => {
    mocks.admin.createUser.mockResolvedValue({
      data: { user: null },
      error: { code: 'email_exists', message: 'A user with this email address has already been registered' },
    });

    const res = await call({ action: 'create', email: 'a@b.com', full_name: 'Ana Pérez', plan: 'vip' });

    expect(res.statusCode).toBe(409);
    expect(res.body).toEqual({ error: 'Ya existe una cuenta con ese correo' });
  });

  it('un admin no puede quitarse a sí mismo el rol', async () => {
    const res = await call({ action: 'update', user_id: ADMIN_ID, role: 'student' });

    expect(res.statusCode).toBe(400);
    expect(mocks.from).not.toHaveBeenCalled();
  });

  it('un admin no puede borrar su propia cuenta', async () => {
    const res = await call({ action: 'delete', user_id: ADMIN_ID });

    expect(res.statusCode).toBe(400);
    expect(mocks.admin.deleteUser).not.toHaveBeenCalled();
  });

  it('borrar elimina la cuenta de Auth (libera el correo)', async () => {
    mocks.admin.deleteUser.mockResolvedValue({ error: null });

    const res = await call({ action: 'delete', user_id: USER_ID });

    expect(res.statusCode).toBe(200);
    expect(mocks.admin.deleteUser).toHaveBeenCalledWith(USER_ID);
  });

  it('reenviar acceso vuelve a poner la marca DESPUÉS de cambiar la contraseña', async () => {
    mocks.admin.getUserById.mockResolvedValue({
      data: { user: { id: USER_ID, email: 'a@b.com', app_metadata: { provider: 'email' } } },
      error: null,
    });
    mocks.admin.updateUserById.mockResolvedValue({ error: null });
    mocks.from.mockImplementation((table: string) =>
      table === 'profiles' ? query({ data: profileRow, error: null }) : query(),
    );

    const res = await call({ action: 'resend_access', user_id: USER_ID });

    expect(res.statusCode).toBe(200);
    const [first, second] = mocks.admin.updateUserById.mock.calls;
    expect(first![1]).toHaveProperty('password');
    // El trigger borra la marca al cambiar la contraseña: va en una segunda escritura.
    expect(second![1]).toEqual({ app_metadata: { provider: 'email', must_change_password: true } });
  });

  it('rechaza un body inválido con el mensaje del campo', async () => {
    const res = await call({ action: 'create', email: 'no-es-correo', full_name: 'Ana', plan: 'vip' });

    expect(res.statusCode).toBe(400);
    expect(res.body).toEqual({ error: 'Correo inválido' });
  });
});
