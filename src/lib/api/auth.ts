import { ApiError } from "@/lib/api/client";
import { supabase } from "@/lib/supabase";
import type { LoginInput, SignupInput } from "@/schemas/auth.schema";
import type { User } from "@/types/user";
import { PLANS, USER_ROLES } from "@/types/user";

export interface AuthResult {
  user: User;
  token: string;
}

// Convertidor de base de datos a tipo User del frontend
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mapProfileToUser = (profileData: any, authUser: any, plan: string): User => ({
  id: profileData.id,
  email: authUser.email || "",
  fullName: profileData.full_name || "Usuario",
  avatarUrl: profileData.avatar_url || null,
  role: profileData.role || USER_ROLES.STUDENT,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  plan: (plan as any) || PLANS.FREE,
  createdAt: profileData.created_at,
  emailConfirmed: Boolean(authUser?.email_confirmed_at),
});

export async function signIn(input: LoginInput): Promise<AuthResult> {
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email: input.email,
    password: input.password,
  });

  if (authError) {
    if (authError.message.includes("Invalid login credentials")) {
      throw new ApiError("invalid_credentials", "Email o contraseña incorrectos", 401);
    }
    throw new ApiError("auth_error", authError.message, 500);
  }

  if (!authData.user || !authData.session) {
    throw new ApiError("unknown", "No se pudo iniciar sesión", 500);
  }

  // Traer datos del perfil
  const { data: profileData, error: profileError } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", authData.user.id)
    .single();

  if (profileError) {
    console.error("Error fetching profile:", profileError);
  }

  // Validar si está suspendido
  if (profileData?.is_suspended) {
    await supabase.auth.signOut();
    throw new ApiError("suspended", "Tu cuenta ha sido suspendida por un administrador.", 403);
  }

  // Traer plan de suscripción activo
  const { data: subData } = await supabase
    .from("subscriptions")
    .select("plan")
    .eq("user_id", authData.user.id)
    .eq("status", "active")
    .order("updated_at", { ascending: false })
    .limit(1)
    .single();

  const plan = subData?.plan || profileData?.plan || PLANS.FREE;

  const user = mapProfileToUser(
    profileData || { id: authData.user.id, role: USER_ROLES.STUDENT, full_name: "Usuario nuevo" },
    authData.user,
    plan
  );

  return {
    user,
    token: authData.session.access_token,
  };
}

export async function signUp(input: SignupInput, plan: string = PLANS.FREE): Promise<AuthResult> {
  const { data: authData, error: authError } = await supabase.auth.signUp({
    email: input.email,
    password: input.password,
    options: {
      // Sin esto, el link de confirmación redirige a la Site URL (la home) y la
      // página /cuenta-verificada nunca se ve. Igual patrón que requestPasswordReset.
      emailRedirectTo: `${window.location.origin}/cuenta-verificada`,
      data: {
        full_name: input.fullName,
        plan: plan,
      },
    },
  });

  if (authError) {
    throw new ApiError("signup_error", authError.message, 400);
  }

  if (!authData.user || !authData.session) {
    throw new ApiError("check_email", "Revisa tu correo para confirmar la cuenta", 200);
  }

  // El perfil se crea automáticamente gracias al Trigger en Postgres
  const user: User = {
    id: authData.user.id,
    email: input.email,
    fullName: input.fullName,
    avatarUrl: null,
    role: USER_ROLES.STUDENT,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    plan: (plan as any),
    createdAt: new Date().toISOString(),
    emailConfirmed: Boolean(authData.user.email_confirmed_at),
  };

  return {
    user,
    token: authData.session.access_token,
  };
}

export async function signOut(): Promise<void> {
  await supabase.auth.signOut();
}

export async function requestPasswordReset(email: string): Promise<void> {
  const redirectTo = `${window.location.origin}/restablecer-contrasena`;
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo,
  });

  if (error) {
    throw new ApiError("reset_email_error", error.message, 400);
  }
}

export async function updatePassword(newPassword: string): Promise<void> {
  const { error } = await supabase.auth.updateUser({ password: newPassword });

  if (error) {
    if (error.message.toLowerCase().includes("session")) {
      throw new ApiError(
        "no_recovery_session",
        "El enlace expiró o ya fue utilizado. Solicita uno nuevo.",
        401
      );
    }
    throw new ApiError("update_password_error", error.message, 400);
  }
}

export async function getCurrentUser(): Promise<User | null> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) {
    return null;
  }

  const { data: profileData, error: profileError } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", session.user.id)
    .maybeSingle(); // Changed from .single() to maybeSingle() to avoid throw if not found

  if (profileError) {
    console.warn("[getCurrentUser] profileError:", profileError);
  }

  // Validar suspensión
  if (profileData?.is_suspended) {
    await supabase.auth.signOut();
    return null;
  }

  const { data: subData, error: subError } = await supabase
    .from("subscriptions")
    .select("plan")
    .eq("user_id", session.user.id)
    .eq("status", "active")
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle(); // Changed from .single() to maybeSingle()

  if (subError) {
    console.warn("[getCurrentUser] subError:", subError);
  }

  return mapProfileToUser(
    profileData || { id: session.user.id, role: USER_ROLES.STUDENT },
    session.user,
    subData?.plan || profileData?.plan || PLANS.FREE
  );
}