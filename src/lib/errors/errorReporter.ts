// Registro de fallas en /api/errors (tabla client_errors), con un código corto
// que el usuario ve y puede pasar al reportar.
//
// - Plataforma: cada falla se registra (sin repetir la misma en 1 minuto).
// - Red: NO una por una — sin internet tampoco se podrían enviar. Se cuentan y se
//   manda un resumen cuando la conexión vuelve.
// - Sesión y rechazos (dato inválido): no se registran; no son fallas.
//
// Sin imports de Supabase: el cliente de Supabase usa `trackedFetch` de acá. El
// token se pide por `setReporterTokenProvider`, que registra src/lib/supabase.ts.

import {
  classifyError,
  classifyMediaFailure,
  kindFromStatus,
  NETWORK_KINDS,
  type ErrorKind,
  type MediaFailureInfo,
} from "./classifyError";

const ENDPOINT = "/api/errors";
/** Tope por carga de página: una caída no puede generar cientos de envíos. */
const MAX_REPORTS_PER_PAGE = 30;
const DEDUPE_MS = 60_000;
/** Un aviso de error explica la falla de transporte de los últimos segundos. */
const RECENT_FAILURE_MS = 6_000;
const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

export interface ReportContext {
  /** Dónde se capturó: supabase, api, boundary, global, toast… */
  source: string;
  /** "GET /rest/v1/lessons", sin query string. */
  request?: string | null;
  status?: number | null;
  detail?: Record<string, unknown>;
  /** Clasificación ya resuelta por quien reporta (p. ej. una falla de video). */
  kind?: ErrorKind;
}

export interface ReportResult {
  kind: ErrorKind;
  /** Código para el usuario. Solo en fallas de plataforma. */
  code: string | null;
}

interface PendingNetwork {
  kind: ErrorKind;
  count: number;
  message: string;
  request: string | null;
  since: number;
}

// El fetch global en el momento de cada llamada (los tests lo reemplazan). No hay
// riesgo de recursión: trackedFetch no se instala como window.fetch.
const nativeFetch: typeof fetch = (...args) => globalThis.fetch(...args);

let tokenProvider: (() => Promise<string | null>) | null = null;
let sentThisPage = 0;
const recentPlatform = new Map<string, { code: string; at: number }>();
let pendingNetwork: PendingNetwork | null = null;
let lastFailure: (ReportResult & { at: number }) | null = null;

export function setReporterTokenProvider(provider: () => Promise<string | null>): void {
  tokenProvider = provider;
}

export function newErrorCode(): string {
  const bytes = new Uint8Array(6);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => CODE_ALPHABET[b % CODE_ALPHABET.length]).join("");
}

function currentPath(): string | null {
  return typeof location === "undefined" ? null : location.pathname.slice(0, 300);
}

async function send(payload: Record<string, unknown>): Promise<void> {
  if (sentThisPage >= MAX_REPORTS_PER_PAGE) return;
  sentThisPage++;
  try {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    const token = tokenProvider ? await tokenProvider().catch(() => null) : null;
    if (token) headers.Authorization = `Bearer ${token}`;
    // keepalive: el reporte sale aunque el usuario cierre o cambie de página.
    await nativeFetch(ENDPOINT, { method: "POST", headers, body: JSON.stringify({ ...payload, path: currentPath() }), keepalive: true });
  } catch {
    /* reportar un error nunca puede generar otro */
  }
}

/** Manda el resumen de fallas de red acumuladas, si las hay. */
export function flushNetworkFailures(): void {
  if (!pendingNetwork || (typeof navigator !== "undefined" && !navigator.onLine)) return;
  const pending = pendingNetwork;
  pendingNetwork = null;
  void send({
    code: newErrorCode(),
    kind: pending.kind,
    source: "network-summary",
    message: pending.message.slice(0, 500),
    request: pending.request,
    occurrences: Math.min(pending.count, 10000),
    detail: { since: new Date(pending.since).toISOString() },
  });
}

export function reportError(err: unknown, ctx: ReportContext): ReportResult {
  const classified = classifyError(err);
  const kind = ctx.kind ?? (ctx.status != null ? kindFromStatus(ctx.status) : null) ?? classified.kind;
  const now = Date.now();

  if (kind === "session" || kind === "rejected") {
    lastFailure = { kind, code: null, at: now };
    return { kind, code: null };
  }

  if (NETWORK_KINDS.has(kind)) {
    pendingNetwork = pendingNetwork
      ? { ...pendingNetwork, count: pendingNetwork.count + 1, message: classified.message, request: ctx.request ?? pendingNetwork.request }
      : { kind, count: 1, message: classified.message, request: ctx.request ?? null, since: now };
    lastFailure = { kind, code: null, at: now };
    return { kind, code: null };
  }

  const key = `${ctx.source}|${ctx.request ?? ""}|${classified.message}`;
  const seen = recentPlatform.get(key);
  if (seen && now - seen.at < DEDUPE_MS) {
    lastFailure = { kind, code: seen.code, at: now };
    return { kind, code: seen.code };
  }

  const code = newErrorCode();
  recentPlatform.set(key, { code, at: now });
  lastFailure = { kind, code, at: now };
  void send({
    code,
    kind: "platform",
    source: ctx.source.slice(0, 40),
    message: classified.message.slice(0, 500),
    status: ctx.status ?? classified.status,
    request: ctx.request ?? null,
    detail: ctx.detail ?? null,
  });
  return { kind, code };
}

/**
 * Un video que no se pudo ver: lives, grabaciones, clases. Lo llama el
 * reproductor al RENDIRSE (agotó sus reintentos), no en cada error que se
 * recupera solo: lo que se registra es lo que el usuario vio fallar.
 */
export function reportMediaFailure(
  player: string,
  info: MediaFailureInfo & { message: string; detail?: Record<string, unknown> },
): ReportResult {
  const { message, detail, ...media } = info;
  return reportError(new Error(message), {
    source: player,
    kind: classifyMediaFailure(media),
    status: media.status && media.status > 0 ? media.status : null,
    detail: {
      ...detail,
      ...(media.mediaErrorCode ? { mediaErrorCode: media.mediaErrorCode } : {}),
      ...(media.hlsType ? { hlsType: media.hlsType } : {}),
      ...(media.stalled ? { stalled: true } : {}),
    },
  });
}

/**
 * La falla de transporte de los últimos segundos, una sola vez: la usa el aviso
 * de error para explicar la causa sin que cada llamada tenga que pasarla.
 */
export function takeRecentFailure(): ReportResult | null {
  const failure = lastFailure;
  lastFailure = null;
  if (!failure || Date.now() - failure.at > RECENT_FAILURE_MS) return null;
  return { kind: failure.kind, code: failure.code };
}

function describeRequest(input: RequestInfo | URL, init?: RequestInit): string {
  const method = (init?.method ?? (input instanceof Request ? input.method : "GET")).toUpperCase();
  const raw = input instanceof Request ? input.url : String(input);
  try {
    const url = new URL(raw, typeof location === "undefined" ? "http://localhost" : location.href);
    const sameOrigin = typeof location !== "undefined" && url.origin === location.origin;
    const isSupabase = url.pathname.startsWith("/rest/") || url.pathname.startsWith("/auth/") || url.pathname.startsWith("/storage/");
    // Sin query string: puede traer ids, filtros o tokens.
    return `${method} ${sameOrigin || isSupabase ? "" : url.host}${url.pathname}`.slice(0, 300);
  } catch {
    return `${method} ${raw.split("?")[0]}`.slice(0, 300);
  }
}

function sourceOf(request: string): string {
  if (/ \/(rest|auth|storage|functions)\//.test(request)) return "supabase";
  if (/ \/api\//.test(request)) return "api";
  return "fetch";
}

/**
 * `fetch` que registra las fallas: lo usan el cliente de Supabase y `authedFetch`.
 * Un 5xx es de la plataforma; un pedido sin respuesta, de la red. No cambia el
 * resultado: devuelve la misma respuesta y relanza el mismo error.
 */
export const trackedFetch: typeof fetch = async (input, init) => {
  const request = describeRequest(input, init);
  if (request.includes(ENDPOINT)) return nativeFetch(input, init);
  try {
    const res = await nativeFetch(input, init);
    if (res.status >= 500 || res.status === 408) {
      reportError({ status: res.status, message: `HTTP ${res.status}` }, { source: sourceOf(request), request, status: res.status });
    } else {
      // Hubo respuesta: la conexión volvió. Sale el resumen de lo que falló antes.
      flushNetworkFailures();
    }
    return res;
  } catch (err) {
    // Cancelado por la propia app (cambio de pantalla): no es una falla.
    if (!init?.signal?.aborted) reportError(err, { source: sourceOf(request), request });
    throw err;
  }
};

const IGNORED_GLOBAL = /ResizeObserver loop|^Script error\.?$|Non-Error promise rejection captured/i;

/** Errores que nadie capturó (bugs) y vuelta de la conexión. Una vez, en main.tsx. */
export function installGlobalErrorCapture(): void {
  if (typeof window === "undefined") return;
  window.addEventListener("error", (event) => {
    if (IGNORED_GLOBAL.test(event.message ?? "")) return;
    reportError(event.error ?? event.message, {
      source: "global",
      detail: event.filename ? { file: event.filename.split("?")[0].slice(-120), line: event.lineno } : undefined,
    });
  });
  window.addEventListener("unhandledrejection", (event) => {
    const reason: unknown = event.reason;
    const message = reason instanceof Error ? reason.message : String(reason ?? "");
    if (IGNORED_GLOBAL.test(message)) return;
    reportError(reason, { source: "global" });
  });
  window.addEventListener("online", flushNetworkFailures);
}

/** Solo para tests: estado limpio entre casos. */
export function __resetReporterForTests(): void {
  sentThisPage = 0;
  recentPlatform.clear();
  pendingNetwork = null;
  lastFailure = null;
  tokenProvider = null;
}
