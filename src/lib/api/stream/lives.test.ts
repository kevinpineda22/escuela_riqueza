import { describe, it, expect, vi, beforeEach } from "vitest";
import { setLivePublic, fetchLiveForRoom } from "./lives";
import { supabase } from "@/lib/supabase";

vi.mock("@/lib/supabase", () => ({
  supabase: {
    from: vi.fn(),
    rpc: vi.fn(),
  },
}));

describe("setLivePublic", () => {
  const single = vi.fn();
  const select = vi.fn(() => ({ single }));
  const eq = vi.fn(() => ({ select }));
  const update = vi.fn(() => ({ eq }));

  beforeEach(() => {
    vi.clearAllMocks();
    update.mockReturnValue({ eq });
    eq.mockReturnValue({ select });
    select.mockReturnValue({ single });
    (supabase.from as any).mockReturnValue({ update });
  });

  it("generates a token when enabling a live with no existing token", async () => {
    single.mockResolvedValue({ data: { id: "live-1", is_public: true, share_token: "abc123" }, error: null });

    await setLivePublic("live-1", true, null);

    const updates: any = (update.mock.calls[0] as any[])[0];
    expect(updates.is_public).toBe(true);
    expect(typeof updates.share_token).toBe("string");
    expect(updates.share_token).toMatch(/^[0-9a-f]{32}$/);
  });

  it("keeps the existing token when re-enabling a live that already has one", async () => {
    single.mockResolvedValue({ data: { id: "live-1", is_public: true, share_token: "existing-token" }, error: null });

    await setLivePublic("live-1", true, "existing-token");

    const updates: any = (update.mock.calls[0] as any[])[0];
    expect(updates.is_public).toBe(true);
    expect(updates.share_token).toBeUndefined();
  });

  it("keeps the token when disabling the public link", async () => {
    single.mockResolvedValue({ data: { id: "live-1", is_public: false, share_token: "existing-token" }, error: null });

    await setLivePublic("live-1", false, "existing-token");

    const updates: any = (update.mock.calls[0] as any[])[0];
    expect(updates.is_public).toBe(false);
    expect(updates.share_token).toBeUndefined();
    expect(supabase.from).toHaveBeenCalledWith("lives");
  });

  it("throws when Supabase returns an error", async () => {
    single.mockResolvedValue({ data: null, error: new Error("boom") });
    await expect(setLivePublic("live-1", true, null)).rejects.toThrow();
  });
});

describe("fetchLiveForRoom", () => {
  // Cada llamada a `from("lives")` arma su propia cadena: la primera es
  // `fetchActiveLive` (termina en `limit`), la segunda la búsqueda por id
  // (termina en `maybeSingle`).
  const mockActive = (rows: unknown[]) => ({
    select: () => ({ eq: () => ({ in: () => ({ order: () => ({ limit: () => Promise.resolve({ data: rows, error: null }) }) }) }) }),
  });
  const byIdEq = vi.fn();
  const mockById = (row: unknown) => {
    byIdEq.mockReturnValue({ maybeSingle: () => Promise.resolve({ data: row, error: null }) });
    return { select: () => ({ eq: byIdEq }) };
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("devuelve la sala activa sin buscar por id", async () => {
    (supabase.from as any).mockReturnValueOnce(mockActive([{ id: "live-1", status: "live" }]));

    const live = await fetchLiveForRoom("live-1");

    expect(live).toEqual({ id: "live-1", status: "live" });
    expect(supabase.from).toHaveBeenCalledTimes(1);
  });

  it("devuelve la sala que se estaba viendo cuando se finaliza (F33)", async () => {
    (supabase.from as any)
      .mockReturnValueOnce(mockActive([]))
      .mockReturnValueOnce(mockById({ id: "live-1", status: "ended" }));

    const live = await fetchLiveForRoom("live-1");

    expect(live).toEqual({ id: "live-1", status: "ended" });
    expect(byIdEq).toHaveBeenCalledWith("id", "live-1");
  });

  it("devuelve null si la sala que se veía ya no está finalizada ni activa", async () => {
    (supabase.from as any)
      .mockReturnValueOnce(mockActive([]))
      .mockReturnValueOnce(mockById({ id: "live-1", status: "scheduled" }));

    expect(await fetchLiveForRoom("live-1")).toBeNull();
  });

  it("devuelve null sin buscar por id cuando no había sala en pantalla", async () => {
    (supabase.from as any).mockReturnValueOnce(mockActive([]));

    expect(await fetchLiveForRoom(null)).toBeNull();
    expect(supabase.from).toHaveBeenCalledTimes(1);
  });
});
