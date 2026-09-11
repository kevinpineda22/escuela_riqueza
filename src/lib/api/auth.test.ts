import { describe, it, expect, vi, beforeEach } from 'vitest';
import { signIn } from './auth';
import { supabase } from '@/lib/supabase';
import { ApiError } from './client';

vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: { signInWithPassword: vi.fn(), signOut: vi.fn() },
    from: vi.fn(),
  },
}));

const authSuccess = {
  data: {
    user: { id: 'user-1', email: 'alumno@escuela.com', email_confirmed_at: '2026-09-01T00:00:00Z' },
    session: { access_token: 'token-abc' },
  },
  error: null,
};

/** Encadenado de supabase-js: from().select().eq()...single() */
function chain(result: unknown) {
  const thenable = {
    select: () => thenable,
    eq: () => thenable,
    order: () => thenable,
    limit: () => thenable,
    single: () => (result instanceof Error ? Promise.reject(result) : Promise.resolve(result)),
  };
  return thenable;
}

describe('signIn resilience', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (supabase.auth.signInWithPassword as any).mockResolvedValue(authSuccess);
  });

  it('inicia sesión cuando todo responde bien', async () => {
    (supabase.from as any).mockImplementation((table: string) =>
      chain(table === 'profiles'
        ? { data: { id: 'user-1', role: 'student', full_name: 'Alumno', plan: 'free' }, error: null }
        : { data: { plan: 'individual' }, error: null })
    );

    const result = await signIn({ email: 'alumno@escuela.com', password: 'x' } as any);

    expect(result.token).toBe('token-abc');
    expect(result.user.plan).toBe('individual');
  });

  // El caso del reporte: la autenticación YA fue exitosa (la sesión existe en Supabase),
  // pero una consulta secundaria falla por red inestable. Hoy la excepción escapa como
  // TypeError, no como ApiError, y AuthPage muestra "No pudimos iniciar sesión" al
  // usuario aunque quedó autenticado.
  it('no pierde la sesión si falla la consulta del perfil por red', async () => {
    (supabase.from as any).mockImplementation((table: string) =>
      chain(table === 'profiles'
        ? new TypeError('Failed to fetch')
        : { data: null, error: null })
    );

    const result = await signIn({ email: 'alumno@escuela.com', password: 'x' } as any);

    expect(result.token).toBe('token-abc');
    expect(result.user.id).toBe('user-1');
  });

  it('no pierde la sesión si falla la consulta de suscripción por red', async () => {
    (supabase.from as any).mockImplementation((table: string) =>
      chain(table === 'profiles'
        ? { data: { id: 'user-1', role: 'student', full_name: 'Alumno', plan: 'free' }, error: null }
        : new TypeError('Failed to fetch'))
    );

    const result = await signIn({ email: 'alumno@escuela.com', password: 'x' } as any);

    expect(result.token).toBe('token-abc');
    expect(result.user.plan).toBe('free');
  });

  it('sigue rechazando credenciales inválidas con un ApiError', async () => {
    (supabase.auth.signInWithPassword as any).mockResolvedValue({
      data: {}, error: { message: 'Invalid login credentials' },
    });

    await expect(signIn({ email: 'a@b.com', password: 'x' } as any)).rejects.toBeInstanceOf(ApiError);
  });
});
