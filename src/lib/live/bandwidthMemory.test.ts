import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { readBandwidthEstimate, saveBandwidthEstimate } from "./bandwidthMemory";

const DAY = 24 * 60 * 60 * 1000;

function setConnectionType(type: string | undefined) {
  Object.defineProperty(navigator, "connection", {
    configurable: true,
    value: type === undefined ? undefined : { type },
  });
}

describe("velocidad recordada para arrancar nítido", () => {
  beforeEach(() => {
    localStorage.clear();
    setConnectionType(undefined);
  });
  afterEach(() => {
    delete (navigator as unknown as Record<string, unknown>).connection;
    vi.restoreAllMocks();
  });

  it("sin medición previa no hay estimación: el reproductor hace su prueba", () => {
    expect(readBandwidthEstimate()).toBeNull();
  });

  it("recuerda lo medido", () => {
    saveBandwidthEstimate(6_200_000, 1_000);
    expect(readBandwidthEstimate(2_000)).toBe(6_200_000);
  });

  it("una medición de hace más de 3 días ya no sirve", () => {
    saveBandwidthEstimate(6_000_000, 0);
    expect(readBandwidthEstimate(2 * DAY)).toBe(6_000_000);
    expect(readBandwidthEstimate(4 * DAY)).toBeNull();
  });

  it("wifi y datos se recuerdan por separado", () => {
    setConnectionType("wifi");
    saveBandwidthEstimate(20_000_000, 0);
    setConnectionType("cellular");
    expect(readBandwidthEstimate(1)).toBeNull();
    saveBandwidthEstimate(2_000_000, 0);
    expect(readBandwidthEstimate(1)).toBe(2_000_000);
    setConnectionType("wifi");
    expect(readBandwidthEstimate(1)).toBe(20_000_000);
  });

  it("descarta mediciones absurdas (cortes, pedazos del caché)", () => {
    saveBandwidthEstimate(NaN, 0);
    saveBandwidthEstimate(50, 0);
    saveBandwidthEstimate(9e9, 0);
    expect(readBandwidthEstimate(1)).toBeNull();
  });

  it("datos rotos o sin almacenamiento no rompen", () => {
    localStorage.setItem("live-bandwidth", "{roto");
    expect(readBandwidthEstimate()).toBeNull();
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("bloqueado"); });
    expect(() => saveBandwidthEstimate(5_000_000)).not.toThrow();
  });
});
