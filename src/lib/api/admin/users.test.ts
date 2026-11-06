import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import { createAdminUser, deleteUser, fetchActiveSubscriptions, fetchAdminUsers, updateUserStatus } from './users';
import { supabase } from '@/lib/supabase';
import { authedFetch } from '@/lib/api/client';

vi.mock('@/lib/supabase', () => ({
  supabase: {
    rpc: vi.fn(),
    from: vi.fn(),
  },
}));

vi.mock('@/lib/api/client', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  authedFetch: vi.fn(),
}));

const rpc = supabase.rpc as unknown as Mock;
const from = supabase.from as unknown as Mock;
const fetchMock = authedFetch as unknown as Mock;

const jsonResponse = (status: number, body: unknown) =>
  ({ ok: status >= 200 && status < 300, status, json: () => Promise.resolve(body) }) as Response;

const row = {
  id: 'u1',
  full_name: 'Ana',
  email: 'ana@escuela.com',
  role: 'student',
  plan: 'vip',
  is_suspended: false,
  created_at: '2026-09-01T00:00:00Z',
  updated_at: null,
};

describe('admin users API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('fetchAdminUsers usa el RPC admin_list_users y conserva el email', async () => {
    rpc.mockResolvedValue({ data: [row], error: null });

    const users = await fetchAdminUsers();

    expect(supabase.rpc).toHaveBeenCalledWith('admin_list_users');
    expect(supabase.from).not.toHaveBeenCalled();
    expect(users).toEqual([
      {
        id: 'u1',
        full_name: 'Ana',
        email: 'ana@escuela.com',
        role: 'student',
        plan: 'vip',
        status: 'active',
        created_at: '2026-09-01T00:00:00Z',
        updated_at: '2026-09-01T00:00:00Z',
      },
    ]);
  });

  it('fetchAdminUsers propaga el error del RPC', async () => {
    const err = { code: '42501', message: 'Not authorized' };
    rpc.mockResolvedValue({ data: null, error: err });

    await expect(fetchAdminUsers()).rejects.toBe(err);
  });

  it('updateUserStatus suspende por RPC y relee el usuario con admin_get_user', async () => {
    rpc.mockImplementation((fn: string) =>
      Promise.resolve(fn === 'admin_toggle_suspend' ? { error: null } : { data: [{ ...row, is_suspended: true }], error: null })
    );

    const updated = await updateUserStatus('u1', true);

    expect(supabase.rpc).toHaveBeenCalledWith('admin_toggle_suspend', { target_user_id: 'u1', suspend: true });
    expect(supabase.rpc).toHaveBeenCalledWith('admin_get_user', { target_user_id: 'u1' });
    expect(supabase.from).not.toHaveBeenCalled();
    expect(updated.status).toBe('suspended');
    expect(updated.email).toBe('ana@escuela.com');
  });

  it('updateUserStatus falla si admin_get_user no devuelve filas', async () => {
    rpc.mockImplementation((fn: string) =>
      Promise.resolve(fn === 'admin_toggle_suspend' ? { error: null } : { data: [], error: null })
    );

    await expect(updateUserStatus('u1', false)).rejects.toThrow('Usuario no encontrado');
  });

  it('fetchActiveSubscriptions trae todo en una consulta y se queda con la más reciente', async () => {
    const order = vi.fn().mockResolvedValue({
      data: [
        { user_id: 'u1', plan: 'vip', current_period_end: null },
        { user_id: 'u1', plan: 'free', current_period_end: '2026-10-01T00:00:00Z' },
        { user_id: 'u2', plan: 'individual', current_period_end: '2026-12-01T00:00:00Z' },
      ],
      error: null,
    });
    const eq = vi.fn(() => ({ order }));
    from.mockReturnValue({ select: vi.fn(() => ({ eq })) });

    const subs = await fetchActiveSubscriptions();

    expect(supabase.from).toHaveBeenCalledTimes(1);
    expect(eq).toHaveBeenCalledWith('status', 'active');
    expect(subs).toEqual({
      u1: { plan: 'vip', endDate: null },
      u2: { plan: 'individual', endDate: '2026-12-01T00:00:00Z' },
    });
  });

  it('createAdminUser manda la acción al endpoint y devuelve la contraseña temporal', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(201, { user: row, temp_password: 'Ab3d-EfGh-2jKm', email_sent: true }),
    );

    const result = await createAdminUser({
      fullName: 'Ana', email: 'ana@escuela.com', plan: 'vip', role: 'student', sendEmail: true,
    });

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/admin/users');
    expect(JSON.parse(init.body)).toEqual({
      action: 'create', full_name: 'Ana', email: 'ana@escuela.com', plan: 'vip', role: 'student', send_email: true,
    });
    expect(result.tempPassword).toBe('Ab3d-EfGh-2jKm');
    expect(result.emailSent).toBe(true);
    expect(result.user.email).toBe('ana@escuela.com');
  });

  it('un error del endpoint llega con su mensaje', async () => {
    fetchMock.mockResolvedValue(jsonResponse(409, { error: 'Ya existe una cuenta con ese correo' }));

    await expect(
      createAdminUser({ fullName: 'Ana', email: 'ana@escuela.com', plan: 'vip', role: 'student', sendEmail: true }),
    ).rejects.toThrow('Ya existe una cuenta con ese correo');
  });

  it('deleteUser borra por el endpoint (cuenta de Auth), no por RPC', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, { ok: true }));

    await deleteUser('u1');

    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ action: 'delete', user_id: 'u1' });
    expect(supabase.rpc).not.toHaveBeenCalled();
  });
});
