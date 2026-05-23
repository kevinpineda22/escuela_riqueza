import { supabase } from "@/lib/supabase";

export class ApiError extends Error {
  readonly code: string;
  readonly status: number;

  constructor(code: string, message: string, status: number = 400) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.status = status;
  }
}

/**
 * `fetch` envuelto que agrega el JWT de Supabase como `Authorization: Bearer …`.
 * Usar para llamar Vercel Functions protegidas (`/api/*`). Si no hay sesión
 * tira `ApiError("UNAUTHENTICATED")` antes de salir a la red.
 *
 * Refresca proactivamente el token si está a menos de 60s de expirar, para
 * evitar 401s por race entre el reloj del cliente y la validación del server.
 */
export async function authedFetch(input: string, init: RequestInit = {}): Promise<Response> {
  let { data: { session } } = await supabase.auth.getSession();

  // Si el token vence en <60s (o ya venció), forzamos refresh antes de salir.
  const nowSec = Math.floor(Date.now() / 1000);
  if (session?.expires_at && session.expires_at - nowSec < 60) {
    const { data: refreshed, error } = await supabase.auth.refreshSession();
    if (error || !refreshed.session) {
      throw new ApiError("UNAUTHENTICATED", "Sesión expirada, iniciá sesión de nuevo", 401);
    }
    session = refreshed.session;
  }

  if (!session?.access_token) {
    throw new ApiError("UNAUTHENTICATED", "Sesión expirada, iniciá sesión de nuevo", 401);
  }
  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${session.access_token}`);
  if (init.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  return fetch(input, { ...init, headers });
}
