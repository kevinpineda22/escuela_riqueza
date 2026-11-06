import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { Resend } from 'resend';
import { z } from 'zod';
import { applyCors, requireAdmin } from '../_lib/auth.js';
import { accessEmail } from '../_lib/accessEmail.js';
import { applyPlan, tempPassword } from '../_lib/userAccess.js';

/**
 * Gestión de usuarios desde /admin/users: lo que el navegador no puede hacer
 * con la clave anónima (crear cuentas, cambiar el correo de login, borrar la
 * cuenta de Auth). Solo admins (JWT + profiles.role = 'admin').
 *
 * Una sola función con `action` en el body para no sumar una Vercel Function
 * por operación.
 *
 * Alta y "reenviar acceso" usan la misma mecánica que el alta de cohortes
 * (scripts/onboard-cohort.mjs): contraseña temporal + `must_change_password`
 * en app_metadata, que la app obliga a cambiar al entrar
 * (sql/migrate-must-change-password.sql). La contraseña temporal vuelve en la
 * respuesta para que el admin pueda pasarla a mano si el correo no llega.
 */

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const RESEND_API_KEY = process.env.RESEND_API_KEY || '';
const APP_URL = (process.env.APP_URL || 'https://www.escueladelariqueza.com').replace(/\/$/, '');
const EMAIL_FROM = process.env.EMAIL_FROM || 'Escuela de la Riqueza <hola@escueladelariqueza.com>';

const plan = z.enum(['free', 'individual', 'vip']);
const role = z.enum(['student', 'admin']);
const email = z.string().trim().toLowerCase().pipe(z.email({ message: 'Correo inválido' }));
const fullName = z.string().trim().min(2, 'Escribe el nombre completo').max(120);
const userId = z.uuid();

export const bodySchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('create'),
    email,
    full_name: fullName,
    plan,
    role: role.default('student'),
    send_email: z.boolean().default(true),
  }),
  z.object({
    action: z.literal('update'),
    user_id: userId,
    full_name: fullName.optional(),
    email: email.optional(),
    role: role.optional(),
    plan: plan.optional(),
  }),
  z.object({ action: z.literal('resend_access'), user_id: userId }),
  z.object({ action: z.literal('delete'), user_id: userId }),
]);

type Body = z.infer<typeof bodySchema>;

const PROFILE_COLUMNS = 'id, full_name, email, role, plan, is_suspended, created_at, updated_at';

class HttpError extends Error {
  readonly status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

function isEmailTaken(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  return error.code === 'email_exists' || /already (been )?registered|already exists/i.test(error.message ?? '');
}

async function readProfile(supabase: SupabaseClient, id: string) {
  const { data, error } = await supabase.from('profiles').select(PROFILE_COLUMNS).eq('id', id).maybeSingle();
  if (error) throw new HttpError(500, `No se pudo leer el perfil: ${error.message}`);
  if (!data) throw new HttpError(404, 'Usuario no encontrado');
  return data;
}

/** Manda el correo de acceso. Nunca lanza: el alta ya está hecha y el admin tiene la contraseña. */
async function sendAccessEmail(
  supabase: SupabaseClient,
  user: { id: string; email: string; fullName: string },
  password: string,
): Promise<{ email_sent: boolean; email_error?: string }> {
  if (!RESEND_API_KEY) return { email_sent: false, email_error: 'El envío de correos no está configurado' };
  const { subject, html, text } = accessEmail({
    firstName: user.fullName.split(/\s+/)[0] ?? '',
    email: user.email,
    tempPassword: password,
    loginUrl: `${APP_URL}/login`,
  });
  try {
    const { data, error } = await new Resend(RESEND_API_KEY).emails.send({
      from: EMAIL_FROM,
      to: user.email,
      subject,
      html,
      text,
    });
    if (error) return { email_sent: false, email_error: error.message };
    // Traza (no idempotencia: cada envío es un acto explícito del admin).
    await supabase.from('notification_log').insert({
      user_id: user.id,
      event_type: 'admin_access',
      dedupe_key: new Date().toISOString(),
      provider_message_id: data?.id ?? null,
    });
    return { email_sent: true };
  } catch (err) {
    return { email_sent: false, email_error: (err as Error).message };
  }
}

/**
 * Contraseña temporal nueva + marca de cambio obligatorio. Dos escrituras: el
 * trigger de sql/migrate-must-change-password.sql borra la marca en CUALQUIER
 * cambio de contraseña, también en este.
 */
async function setTemporaryPassword(supabase: SupabaseClient, id: string, appMetadata: Record<string, unknown>) {
  const password = tempPassword();
  const { error: pwError } = await supabase.auth.admin.updateUserById(id, { password });
  if (pwError) throw new HttpError(500, `No se pudo cambiar la contraseña: ${pwError.message}`);
  const { error: flagError } = await supabase.auth.admin.updateUserById(id, {
    app_metadata: { ...appMetadata, must_change_password: true },
  });
  if (flagError) throw new HttpError(500, `No se pudo marcar el cambio de contraseña: ${flagError.message}`);
  return password;
}

async function createUser(supabase: SupabaseClient, body: Extract<Body, { action: 'create' }>) {
  const password = tempPassword();
  const { data, error } = await supabase.auth.admin.createUser({
    email: body.email,
    password,
    // La escuela da fe del correo: sin esto la cuenta no puede entrar hasta confirmar.
    email_confirm: true,
    user_metadata: { full_name: body.full_name },
    app_metadata: { must_change_password: true },
  });
  if (isEmailTaken(error)) throw new HttpError(409, 'Ya existe una cuenta con ese correo');
  if (error || !data.user) throw new HttpError(500, `No se pudo crear la cuenta: ${error?.message ?? 'sin usuario'}`);

  const id = data.user.id;
  // El trigger handle_new_user ya creó perfil y suscripción free: completarlos.
  const { error: profileError } = await supabase
    .from('profiles')
    .update({ full_name: body.full_name, role: body.role, updated_at: new Date().toISOString() })
    .eq('id', id);
  if (profileError) throw new HttpError(500, `Cuenta creada, pero falló el perfil: ${profileError.message}`);
  try {
    await applyPlan(supabase, id, body.plan);
  } catch (err) {
    throw new HttpError(500, `Cuenta creada, pero falló el plan: ${(err as Error).message}`);
  }

  const delivery = body.send_email
    ? await sendAccessEmail(supabase, { id, email: body.email, fullName: body.full_name }, password)
    : { email_sent: false };
  return { user: await readProfile(supabase, id), temp_password: password, ...delivery };
}

async function updateUser(
  supabase: SupabaseClient,
  callerId: string,
  body: Extract<Body, { action: 'update' }>,
) {
  if (body.user_id === callerId && body.role && body.role !== 'admin') {
    throw new HttpError(400, 'No puedes quitarte a ti mismo el rol de administrador');
  }
  const current = await readProfile(supabase, body.user_id);

  if (body.email && body.email !== current.email) {
    const { error } = await supabase.auth.admin.updateUserById(body.user_id, {
      email: body.email,
      email_confirm: true,
    });
    if (isEmailTaken(error)) throw new HttpError(409, 'Ese correo ya lo usa otra cuenta');
    if (error) throw new HttpError(500, `No se pudo cambiar el correo: ${error.message}`);
  }
  if (body.full_name && body.full_name !== current.full_name) {
    // Best effort: el nombre que muestra la app sale de profiles.
    await supabase.auth.admin.updateUserById(body.user_id, { user_metadata: { full_name: body.full_name } });
  }

  const profilePatch: Record<string, string> = {};
  if (body.full_name) profilePatch.full_name = body.full_name;
  if (body.email) profilePatch.email = body.email;
  if (body.role) profilePatch.role = body.role;
  if (Object.keys(profilePatch).length > 0) {
    const { error } = await supabase
      .from('profiles')
      .update({ ...profilePatch, updated_at: new Date().toISOString() })
      .eq('id', body.user_id);
    if (error) throw new HttpError(500, `No se pudo actualizar el perfil: ${error.message}`);
  }
  if (body.plan) {
    try {
      await applyPlan(supabase, body.user_id, body.plan);
    } catch (err) {
      throw new HttpError(500, `No se pudo cambiar el plan: ${(err as Error).message}`);
    }
  }
  return { user: await readProfile(supabase, body.user_id) };
}

async function resendAccess(supabase: SupabaseClient, id: string) {
  const { data, error } = await supabase.auth.admin.getUserById(id);
  if (error || !data.user) throw new HttpError(404, 'Usuario no encontrado');
  if (!data.user.email) throw new HttpError(400, 'La cuenta no tiene correo');
  const profile = await readProfile(supabase, id);
  const password = await setTemporaryPassword(supabase, id, data.user.app_metadata ?? {});
  const delivery = await sendAccessEmail(
    supabase,
    { id, email: data.user.email, fullName: profile.full_name ?? '' },
    password,
  );
  return { temp_password: password, ...delivery };
}

async function deleteUser(supabase: SupabaseClient, callerId: string, id: string) {
  if (id === callerId) throw new HttpError(400, 'No puedes eliminar tu propia cuenta');
  // Borra la cuenta de Auth: perfil y datos cuelgan de auth.users. Sin esto el
  // correo queda ocupado y no se puede volver a dar de alta.
  const { error } = await supabase.auth.admin.deleteUser(id);
  if (error) throw new HttpError(500, `No se pudo eliminar: ${error.message}`);
  return { ok: true };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (applyCors(req, res)) return;
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  const caller = await requireAdmin(req, res);
  if (!caller) return;

  if (!SUPABASE_URL || !SERVICE_KEY) {
    console.error('[admin/users] faltan variables de Supabase');
    return res.status(503).json({ error: 'Gestión de usuarios no configurada' });
  }

  const parsed = bodySchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Datos inválidos' });
  }
  const body = parsed.data;

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  try {
    switch (body.action) {
      case 'create':
        return res.status(201).json(await createUser(supabase, body));
      case 'update':
        return res.status(200).json(await updateUser(supabase, caller.id, body));
      case 'resend_access':
        return res.status(200).json(await resendAccess(supabase, body.user_id));
      case 'delete':
        return res.status(200).json(await deleteUser(supabase, caller.id, body.user_id));
    }
  } catch (err) {
    if (err instanceof HttpError) return res.status(err.status).json({ error: err.message });
    console.error('[admin/users]', body.action, err);
    return res.status(500).json({ error: 'Error inesperado' });
  }
}
