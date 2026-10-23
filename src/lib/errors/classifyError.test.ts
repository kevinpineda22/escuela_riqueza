import { describe, expect, it } from "vitest";
import { ApiError } from "@/lib/api/client";
import { classifyError, classifyMediaFailure, describeKind, describeMediaFailure, kindFromStatus } from "./classifyError";

describe("classifyError", () => {
  it("sin conexión es siempre de la red, sea cual sea el error", () => {
    expect(classifyError(new Error("cualquier cosa"), { online: false }).kind).toBe("offline");
  });

  it("los 'no hubo respuesta' de cada navegador son de la red", () => {
    for (const msg of ["Failed to fetch", "NetworkError when attempting to fetch resource.", "Load failed", "The network connection was lost."]) {
      expect(classifyError(new TypeError(msg), { online: true }).kind).toBe("network");
    }
  });

  it("un pedido cortado por tiempo es timeout", () => {
    expect(classifyError(new DOMException("aborted", "AbortError"), { online: true }).kind).toBe("timeout");
    expect(classifyError(new DOMException("t", "TimeoutError"), { online: true }).kind).toBe("timeout");
  });

  it("separa por status HTTP", () => {
    expect(classifyError(new ApiError("X", "boom", 500), { online: true })).toMatchObject({ kind: "platform", status: 500 });
    expect(classifyError(new ApiError("UNAUTHENTICATED", "Sesión expirada", 401), { online: true }).kind).toBe("session");
    expect(classifyError(new ApiError("BAD", "dato", 400), { online: true }).kind).toBe("rejected");
    expect(classifyError(new ApiError("GW", "gateway", 504), { online: true }).kind).toBe("timeout");
  });

  it("entiende los errores de supabase-js", () => {
    expect(classifyError({ code: "23505", message: "duplicate key" }, { online: true }).kind).toBe("rejected");
    expect(classifyError({ code: "PGRST301", message: "JWT expired" }, { online: true }).kind).toBe("session");
    expect(classifyError({ code: "42P01", message: "relation does not exist" }, { online: true }).kind).toBe("platform");
    expect(classifyError({ message: "TypeError: Failed to fetch", details: "" }, { online: true }).kind).toBe("network");
  });

  it("un bug del código es de la plataforma", () => {
    expect(classifyError(new TypeError("Cannot read properties of undefined (reading 'id')"), { online: true }).kind).toBe("platform");
  });
});

describe("kindFromStatus", () => {
  it("un 2xx no es error", () => {
    expect(kindFromStatus(200)).toBeNull();
  });
});

describe("describeKind", () => {
  it("la falla de plataforma muestra el código para el reporte", () => {
    expect(describeKind("platform", "K7F2QA")).toContain("Código: K7F2QA");
    expect(describeKind("network")).toMatch(/internet/);
  });
});

describe("classifyMediaFailure", () => {
  it("una respuesta HTTP de error es de la plataforma", () => {
    expect(classifyMediaFailure({ status: 404, online: true })).toBe("platform");
    expect(classifyMediaFailure({ status: 413, hlsType: "network", online: true })).toBe("platform");
    expect(classifyMediaFailure({ status: 503, online: true })).toBe("platform");
  });

  it("un pedido sin respuesta es de la red", () => {
    expect(classifyMediaFailure({ status: 0, hlsType: "network", online: true })).toBe("network");
    expect(classifyMediaFailure({ mediaErrorCode: 2, online: true })).toBe("network");
  });

  it("un video que no se puede decodificar es de la plataforma", () => {
    expect(classifyMediaFailure({ mediaErrorCode: 3, online: true })).toBe("platform");
    expect(classifyMediaFailure({ hlsType: "media", online: true })).toBe("platform");
  });

  it("sin internet manda sobre todo lo demás", () => {
    expect(classifyMediaFailure({ status: 503, online: false })).toBe("offline");
  });

  it("un video que solo deja de avanzar es ambiguo: red lenta", () => {
    expect(classifyMediaFailure({ stalled: true, online: true })).toBe("timeout");
  });
});

describe("describeMediaFailure", () => {
  it("en vivo, una traba sin error no culpa al alumno", () => {
    expect(describeMediaFailure("timeout", null, { live: true })).toMatch(/tu internet o la señal de la clase/);
    expect(describeMediaFailure("platform", "ABC123")).toContain("Código: ABC123");
  });
});
