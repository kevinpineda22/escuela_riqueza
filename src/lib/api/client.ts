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
 */
export async function authedFetch(input: string, init: RequestInit = {}): Promise<Response> {
  const { data: { session } } = await supabase.auth.getSession();
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
