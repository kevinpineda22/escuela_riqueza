import { describe, it, expect, vi, beforeEach } from 'vitest';
import { signIn, getCurrentUser, PROFILE_COLUMNS, updatePassword, completeRequiredPasswordChange, verifyEmailLink } from './auth';
import { supabase } from '@/lib/supabase';
import { ApiError } from './client';

vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      signInWithPassword: vi.fn(),
      signOut: vi.fn(),
      getSession: vi.fn(),
      updateUser: vi.fn(),
      refreshSession: vi.fn(),
      verifyOtp: vi.fn(),
    },
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
    maybeSingle: () => Promise.resolve(result),
  };
  return thenable;
}

/** Como chain(), pero registra las columnas pedidas a profiles. */
function profilesSelectSpy(profileRow: unknown) {
  const selected: string[] = [];
  (supabase.from as any).mockImplementation((table: string) => {
    const base = chain(table === 'profiles' ? { data: profileRow, error: null } : { data: null, error: null });
    return {
      ...base,
      select: (columns: string) => {
        if (table === 'profiles') selected.push(columns);
        return base;
      },
    };
  });
  return selected;
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

  it('pide columnas explícitas de profiles (sin email ni *) y toma el email de Auth', async () => {
    const selected = profilesSelectSpy({ id: 'user-1', role: 'student', full_name: 'Alumno', plan: 'free' });

    const result = await signIn({ email: 'alumno@escuela.com', password: 'x' } as any);

    expect(selected).toEqual([PROFILE_COLUMNS]);
    expect(PROFILE_COLUMNS).not.toMatch(/\*|email/);
    expect(result.user.email).toBe('alumno@escuela.com');
  });

  it('sigue rechazando credenciales inválidas con un ApiError', async () => {
    (supabase.auth.signInWithPassword as any).mockResolvedValue({
      data: {}, error: { message: 'Invalid login credentials' },
    });

    await expect(signIn({ email: 'a@b.com', password: 'x' } as any)).rejects.toBeInstanceOf(ApiError);
  });
});

describe('getCurrentUser', () => {
  it('pide columnas explícitas de profiles y toma el email de la sesión', async () => {
    (supabase.auth.getSession as any).mockResolvedValue({
      data: { session: { user: authSuccess.data.user } },
    });
    const selected = profilesSelectSpy({ id: 'user-1', role: 'student', full_name: 'Alumno', plan: 'free' });

    const user = await getCurrentUser();

    expect(selected).toEqual([PROFILE_COLUMNS]);
    expect(user?.email).toBe('alumno@escuela.com');
  });
});

describe('contraseña temporal (alta de cohortes)', () => {
  beforeEach(() => vi.clearAllMocks());

  const sessionWith = (appMetadata: Record<string, unknown>) =>
    (supabase.auth.getSession as any).mockResolvedValue({
      data: { session: { user: { ...authSuccess.data.user, app_metadata: appMetadata } } },
    });

  it('la marca must_change_password de app_metadata llega al usuario', async () => {
    sessionWith({ must_change_password: true });
    profilesSelectSpy({ id: 'user-1', role: 'student', full_name: 'Alumno', plan: 'vip' });

    expect((await getCurrentUser())?.mustChangePassword).toBe(true);
  });

  it('sin la marca, no pide el cambio', async () => {
    sessionWith({});
    profilesSelectSpy({ id: 'user-1', role: 'student', full_name: 'Alumno', plan: 'vip' });

    expect((await getCurrentUser())?.mustChangePassword).toBe(false);
  });

  it('tras cambiarla trae una sesión nueva (la vieja todavía tiene la marca)', async () => {
    (supabase.auth.updateUser as any).mockResolvedValue({ error: null });
    (supabase.auth.refreshSession as any).mockResolvedValue({ data: {}, error: null });
    sessionWith({});
    profilesSelectSpy({ id: 'user-1', role: 'student', full_name: 'Alumno', plan: 'vip' });

    const user = await completeRequiredPasswordChange('MiClaveNueva2026');

    expect(supabase.auth.updateUser).toHaveBeenCalledWith({ password: 'MiClaveNueva2026' });
    expect(supabase.auth.refreshSession).toHaveBeenCalled();
    expect(user?.mustChangePassword).toBe(false);
  });

  it('repetir la contraseña temporal se explica en español', async () => {
    (supabase.auth.updateUser as any).mockResolvedValue({
      error: { code: 'same_password', message: 'New password should be different from the old password.' },
    });

    await expect(updatePassword('igual')).rejects.toMatchObject({
      message: 'La nueva contraseña debe ser distinta a la anterior.',
    });
  });
});

describe('verifyEmailLink (links a prueba del escáner de Outlook)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('gasta el token recién cuando se llama', async () => {
    (supabase.auth.verifyOtp as any).mockResolvedValue({ error: null });

    await verifyEmailLink('hash-123', 'recovery');

    expect(supabase.auth.verifyOtp).toHaveBeenCalledWith({ token_hash: 'hash-123', type: 'recovery' });
  });

  it('un token vencido o usado da un error claro', async () => {
    (supabase.auth.verifyOtp as any).mockResolvedValue({ error: { message: 'Token has expired or is invalid' } });

    await expect(verifyEmailLink('viejo', 'email')).rejects.toBeInstanceOf(ApiError);
    await expect(verifyEmailLink('viejo', 'email')).rejects.toMatchObject({
      message: 'Este enlace expiró o ya fue utilizado.',
    });
  });
});
