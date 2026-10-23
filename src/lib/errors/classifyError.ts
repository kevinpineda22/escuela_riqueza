// ¿De quién es este error? Separa lo que es de la RED del usuario de lo que es
// de la PLATAFORMA (código propio, Vercel, Supabase, Cloudflare). Los avisos
// decían "No se pudo guardar" sin causa: ni el alumno ni el equipo sabían si
// era su internet o un bug.

// Sin imports de la app a propósito: lo usa el fetch del cliente de Supabase, y
// importar @/lib/api/client (que importa Supabase) armaba un ciclo. ApiError se
// reconoce por su forma: trae `status` como cualquier error HTTP.

export type ErrorKind =
  /** El navegador sabe que no hay internet. */
  | "offline"
  /** El pedido nunca recibió respuesta: se cortó en el camino. */
  | "network"
  /** Tardó demasiado: red lenta (o servidor lento). */
  | "timeout"
  /** El servidor respondió con error, o falló el código de la app. */
  | "platform"
  /** Sesión vencida o sin permiso. */
  | "session"
  /** El servidor rechazó el pedido (dato inválido, conflicto): no es una falla. */
  | "rejected";

export interface ClassifiedError {
  kind: ErrorKind;
  /** Status HTTP si lo hubo. */
  status: number | null;
  /** Mensaje técnico, para el registro. */
  message: string;
}

/** Tipos que son de la red del usuario: no se registran uno por uno. */
export const NETWORK_KINDS: ReadonlySet<ErrorKind> = new Set(["offline", "network", "timeout"]);

// Mensajes con los que cada navegador reporta "no hubo respuesta".
const NETWORK_MESSAGE = /failed to fetch|networkerror|network request failed|load failed|network connection was lost|err_internet|err_network|fetch failed/i;

export function kindFromStatus(status: number): ErrorKind | null {
  if (status === 401 || status === 403) return "session";
  if (status === 408 || status === 504) return "timeout";
  if (status >= 500) return "platform";
  if (status >= 400) return "rejected";
  return null;
}

function messageOf(err: unknown): string {
  if (err instanceof Error) return err.message || err.name;
  if (typeof err === "string") return err;
  if (err && typeof err === "object" && "message" in err && typeof err.message === "string") return err.message;
  try {
    return JSON.stringify(err).slice(0, 300);
  } catch {
    return String(err);
  }
}

export function classifyError(
  err: unknown,
  { online = typeof navigator === "undefined" ? true : navigator.onLine }: { online?: boolean } = {},
): ClassifiedError {
  const message = messageOf(err);
  const base = { message, status: null as number | null };

  if (!online) return { ...base, kind: "offline" };

  const name = err && typeof err === "object" && "name" in err ? String(err.name) : "";
  if (name === "AbortError" || name === "TimeoutError") return { ...base, kind: "timeout" };

  if (typeof Response !== "undefined" && err instanceof Response) {
    return { ...base, status: err.status, message: `HTTP ${err.status}`, kind: kindFromStatus(err.status) ?? "platform" };
  }

  // Errores de supabase-js / PostgREST: { code, message, details, hint } o un status.
  if (err && typeof err === "object") {
    const status = "status" in err && typeof err.status === "number" ? err.status : null;
    const code = "code" in err && typeof err.code === "string" ? err.code : "";
    if (code === "PGRST301" || code === "42501") return { ...base, status, kind: "session" };
    if (status !== null && kindFromStatus(status)) return { ...base, status, kind: kindFromStatus(status)! };
    // 23xxx: el dato violó una regla (duplicado, foránea). No es una falla.
    if (/^23\d{3}$/.test(code)) return { ...base, status, kind: "rejected" };
  }

  if (NETWORK_MESSAGE.test(message)) return { ...base, kind: "network" };

  // Cualquier otra cosa es un error del servidor o un bug del código: plataforma.
  return { ...base, kind: "platform" };
}

/** Frase corta para el usuario: qué pasó y de quién es. */
export function describeKind(kind: ErrorKind, code?: string | null): string {
  switch (kind) {
    case "offline":
      return "No tienes conexión a internet. Revisa tu red e intenta de nuevo.";
    case "network":
      return "Tu conexión a internet falló. Revisa tu red e intenta de nuevo.";
    case "timeout":
      return "La conexión está muy lenta. Intenta de nuevo en un momento.";
    case "session":
      return "Tu sesión venció o no tienes permiso. Inicia sesión de nuevo.";
    case "rejected":
      return "No se pudo completar con esos datos.";
    case "platform":
      return code
        ? `Falla de la plataforma, ya quedó registrada. Código: ${code}`
        : "Falla de la plataforma, ya quedó registrada.";
  }
}

/** Lo que se sabe de una falla de video al momento de rendirse. */
export interface MediaFailureInfo {
  /** Status HTTP del último pedido fallido (manifest, segmento, MP4), si lo hubo. */
  status?: number | null;
  /** `video.error.code`: 1 abortado, 2 red, 3 decodificación, 4 formato. */
  mediaErrorCode?: number | null;
  /** Tipo de error de hls.js. */
  hlsType?: "network" | "media" | "other" | null;
  /** Se rindió porque el video no avanzaba, sin un error concreto. */
  stalled?: boolean;
  online?: boolean;
}

/**
 * ¿De quién es que un video no se vea? Una respuesta HTTP de error es de la
 * plataforma (video inexistente, URL firmada rechazada, Cloudflare caído); un
 * pedido sin respuesta, de la red; un video que no se puede decodificar, de la
 * plataforma. Un video que solo deja de avanzar es AMBIGUO (internet del alumno
 * o señal de la clase): se registra como "red lenta" y el mensaje lo dice así.
 */
export function classifyMediaFailure({
  status,
  mediaErrorCode,
  hlsType,
  stalled,
  online = typeof navigator === "undefined" ? true : navigator.onLine,
}: MediaFailureInfo): ErrorKind {
  if (!online) return "offline";
  if (status && status > 0) {
    if (status === 408 || status === 504) return "timeout";
    if (status >= 400) return "platform";
  }
  if (mediaErrorCode === 3 || mediaErrorCode === 4) return "platform";
  if (mediaErrorCode === 1 || mediaErrorCode === 2) return "network";
  if (hlsType === "network") return "network";
  if (hlsType === "media") return "platform";
  if (stalled) return "timeout";
  return "platform";
}

/** Frase para la pantalla de un video que no se pudo ver. */
export function describeMediaFailure(kind: ErrorKind, code?: string | null, { live = false } = {}): string {
  if (kind === "timeout") {
    return live
      ? "La transmisión dejó de llegar: puede ser tu internet o la señal de la clase."
      : "El video dejó de cargar: tu conexión está muy lenta.";
  }
  return describeKind(kind, code);
}
