import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type * as ReporterModule from "./errorReporter";

type Reporter = typeof ReporterModule;

const fetchMock = vi.fn<typeof fetch>();

/** El reporter captura `window.fetch` al importarse: cada test importa uno nuevo. */
async function load(): Promise<Reporter> {
  vi.resetModules();
  vi.stubGlobal("fetch", fetchMock);
  window.fetch = fetchMock;
  return import("./errorReporter");
}

function setOnline(online: boolean) {
  Object.defineProperty(navigator, "onLine", { value: online, configurable: true });
}

const reports = () =>
  fetchMock.mock.calls
    .filter(([url]) => String(url).includes("/api/errors"))
    .map(([, init]) => JSON.parse(String(init?.body)));

const flush = () => new Promise((r) => setTimeout(r, 0));

describe("errorReporter", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }));
    setOnline(true);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    setOnline(true);
  });

  it("una falla de plataforma se registra con un código para el usuario", async () => {
    const r = await load();
    const result = r.reportError(new TypeError("Cannot read properties of undefined"), { source: "boundary" });
    await flush();
    expect(result.kind).toBe("platform");
    expect(result.code).toMatch(/^[A-Z0-9]{6}$/);
    expect(reports()).toEqual([expect.objectContaining({ code: result.code, kind: "platform", source: "boundary" })]);
  });

  it("la misma falla en el mismo minuto no se registra dos veces", async () => {
    const r = await load();
    const a = r.reportError(new Error("boom"), { source: "api", request: "POST /api/x" });
    const b = r.reportError(new Error("boom"), { source: "api", request: "POST /api/x" });
    await flush();
    expect(b.code).toBe(a.code);
    expect(reports()).toHaveLength(1);
  });

  it("las fallas de red se cuentan y salen juntas cuando vuelve la conexión", async () => {
    const r = await load();
    setOnline(false);
    for (let i = 0; i < 3; i++) r.reportError(new TypeError("Failed to fetch"), { source: "supabase", request: "GET /rest/v1/lessons" });
    await flush();
    expect(reports()).toHaveLength(0);

    setOnline(true);
    r.flushNetworkFailures();
    await flush();
    expect(reports()).toEqual([expect.objectContaining({ kind: "offline", occurrences: 3, source: "network-summary" })]);
  });

  it("sesión vencida y datos inválidos no se registran", async () => {
    const r = await load();
    expect(r.reportError({ status: 401, message: "x" }, { source: "api" }).kind).toBe("session");
    expect(r.reportError({ code: "23505", message: "duplicate" }, { source: "supabase" }).kind).toBe("rejected");
    await flush();
    expect(reports()).toHaveLength(0);
  });

  it("trackedFetch: un 5xx es de la plataforma y devuelve la misma respuesta", async () => {
    const r = await load();
    fetchMock.mockResolvedValueOnce(new Response("x", { status: 503 }));
    const res = await r.trackedFetch("https://abc.supabase.co/rest/v1/lessons?select=*&module_id=in.(1,2)");
    await flush();
    expect(res.status).toBe(503);
    const [report] = reports();
    expect(report).toMatchObject({ kind: "platform", status: 503, source: "supabase", request: "GET /rest/v1/lessons" });
    expect(report.request).not.toContain("module_id"); // sin query string
  });

  it("trackedFetch: un pedido sin respuesta es de la red y relanza el mismo error", async () => {
    const r = await load();
    const err = new TypeError("Failed to fetch");
    fetchMock.mockRejectedValueOnce(err);
    await expect(r.trackedFetch("/api/stream/recording-url", { method: "POST" })).rejects.toBe(err);
    expect(r.takeRecentFailure()).toEqual({ kind: "network", code: null });
  });

  it("trackedFetch: un pedido cancelado por la app no cuenta como falla", async () => {
    const r = await load();
    const controller = new AbortController();
    controller.abort();
    fetchMock.mockRejectedValueOnce(new DOMException("aborted", "AbortError"));
    await expect(r.trackedFetch("/api/x", { signal: controller.signal })).rejects.toThrow();
    expect(r.takeRecentFailure()).toBeNull();
  });

  it("la falla reciente se entrega una sola vez", async () => {
    const r = await load();
    r.reportError(new Error("boom"), { source: "api" });
    expect(r.takeRecentFailure()?.kind).toBe("platform");
    expect(r.takeRecentFailure()).toBeNull();
  });

  it("manda el token de sesión si lo hay", async () => {
    const r = await load();
    r.setReporterTokenProvider(async () => "tok-123");
    r.reportError(new Error("boom"), { source: "api" });
    await flush();
    await flush();
    const call = fetchMock.mock.calls.find(([url]) => String(url).includes("/api/errors"));
    expect(new Headers(call?.[1]?.headers).get("Authorization")).toBe("Bearer tok-123");
  });
});

describe("reportMediaFailure", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }));
    setOnline(true);
  });
  afterEach(() => vi.unstubAllGlobals());

  it("un video rechazado por el servidor se registra como plataforma con su código", async () => {
    const r = await load();
    const result = r.reportMediaFailure("live", { message: "manifestLoadError", status: 404, hlsType: "network" });
    await flush();
    expect(result).toMatchObject({ kind: "platform" });
    expect(reports()).toEqual([expect.objectContaining({ kind: "platform", source: "live", status: 404 })]);
  });

  it("un video que solo se trabó se cuenta como red lenta, no como plataforma", async () => {
    const r = await load();
    const result = r.reportMediaFailure("replay-r2", { message: "sin avance", stalled: true });
    await flush();
    expect(result).toEqual({ kind: "timeout", code: null });
    expect(reports()).toHaveLength(0);
  });
});
