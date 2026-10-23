import { beforeEach, describe, expect, it, vi } from "vitest";

const getLandingTexts = vi.fn();

vi.mock("@/lib/api/admin/landing", () => ({
  getLandingTexts: () => getLandingTexts(),
  updateLandingText: vi.fn(),
  invalidateLandingTextsCache: vi.fn(),
}));

const STORAGE_KEY = "landing-texts-v1";

// El store lee la copia local al importarse: cada test importa uno nuevo.
async function freshStore() {
  vi.resetModules();
  const mod = await import("./admin.store");
  return mod.useAdminStore;
}

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

describe("admin.store — copia local de textos", () => {
  beforeEach(() => {
    localStorage.clear();
    getLandingTexts.mockReset();
  });

  it("sin copia local arranca sin textos y no listo", async () => {
    const store = await freshStore();
    expect(store.getState().values).toEqual({});
    expect(store.getState().ready).toBe(false);
  });

  it("con copia local pinta esos textos desde el primer render", async () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ hero_title: "Una Escuela de" }));
    const store = await freshStore();
    expect(store.getState().values).toEqual({ hero_title: "Una Escuela de" });
    expect(store.getState().ready).toBe(true);
  });

  it("guarda en la copia local lo que trae la base", async () => {
    getLandingTexts.mockResolvedValue({ hero_title: "Nuevo" });
    const store = await freshStore();
    store.getState().ensureLoaded();
    await flush();
    expect(store.getState().values).toEqual({ hero_title: "Nuevo" });
    expect(store.getState().ready).toBe(true);
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!)).toEqual({ hero_title: "Nuevo" });
  });

  it("un vacío por error de red no pisa la copia local", async () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ hero_title: "Una Escuela de" }));
    getLandingTexts.mockResolvedValue({});
    const store = await freshStore();
    store.getState().ensureLoaded();
    await flush();
    expect(store.getState().values).toEqual({ hero_title: "Una Escuela de" });
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!)).toEqual({ hero_title: "Una Escuela de" });
  });

  it("una copia local corrupta se ignora", async () => {
    localStorage.setItem(STORAGE_KEY, "{no es json");
    const store = await freshStore();
    expect(store.getState().values).toEqual({});
    expect(store.getState().ready).toBe(false);
  });
});
