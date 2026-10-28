import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { readLiveVolume, saveLiveVolume } from "./volumePreference";

describe("volumen recordado del vivo", () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => vi.restoreAllMocks());

  it("sin nada guardado, al máximo", () => {
    expect(readLiveVolume()).toBe(1);
  });

  it("recuerda el último volumen", () => {
    saveLiveVolume(0.35);
    expect(readLiveVolume()).toBe(0.35);
  });

  it("casi mudo o cero no se recuerda: la clase arranca sonando", () => {
    saveLiveVolume(0.5);
    saveLiveVolume(0);
    saveLiveVolume(0.01);
    expect(readLiveVolume()).toBe(0.5);
  });

  it("un valor roto en el almacenamiento vuelve al máximo", () => {
    localStorage.setItem("live-volume", "fuerte");
    expect(readLiveVolume()).toBe(1);
    localStorage.setItem("live-volume", "7");
    expect(readLiveVolume()).toBe(1);
  });

  it("sin almacenamiento (modo privado) no rompe", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => { throw new Error("bloqueado"); });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("bloqueado"); });
    expect(() => saveLiveVolume(0.5)).not.toThrow();
    expect(readLiveVolume()).toBe(1);
  });
});
