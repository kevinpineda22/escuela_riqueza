import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fetchAdminUsers, updateUserStatus } from './users';
import { supabase } from '@/lib/supabase';

vi.mock('@/lib/supabase', () => ({
  supabase: {
    rpc: vi.fn(),
    from: vi.fn(),
  },
}));

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
    (supabase.rpc as any).mockResolvedValue({ data: [row], error: null });

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
    (supabase.rpc as any).mockResolvedValue({ data: null, error: err });

    await expect(fetchAdminUsers()).rejects.toBe(err);
  });

  it('updateUserStatus suspende por RPC y relee el usuario con admin_get_user', async () => {
    (supabase.rpc as any).mockImplementation((fn: string) =>
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
    (supabase.rpc as any).mockImplementation((fn: string) =>
      Promise.resolve(fn === 'admin_toggle_suspend' ? { error: null } : { data: [], error: null })
    );

    await expect(updateUserStatus('u1', false)).rejects.toThrow('Usuario no encontrado');
  });
});
