import { describe, it, expect, vi, beforeEach } from "vitest";
import { setLivePublic, fetchLiveForRoom, publicLiveHasRecording, setLiveReplayPublic } from "./lives";
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

describe("setLiveReplayPublic", () => {
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

  it("updates replay_is_public to true", async () => {
    single.mockResolvedValue({ data: { id: "live-1", replay_is_public: true }, error: null });

    await setLiveReplayPublic("live-1", true);

    expect(supabase.from).toHaveBeenCalledWith("lives");
    const updates: any = (update.mock.calls[0] as any[])[0];
    expect(updates).toEqual({ replay_is_public: true });
    expect(eq).toHaveBeenCalledWith("id", "live-1");
  });

  it("updates replay_is_public to false", async () => {
    single.mockResolvedValue({ data: { id: "live-1", replay_is_public: false }, error: null });

    await setLiveReplayPublic("live-1", false);

    const updates: any = (update.mock.calls[0] as any[])[0];
    expect(updates).toEqual({ replay_is_public: false });
  });

  it("throws when Supabase returns an error", async () => {
    single.mockResolvedValue({ data: null, error: new Error("boom") });
    await expect(setLiveReplayPublic("live-1", true)).rejects.toThrow();
  });
});

describe("publicLiveHasRecording", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns true when the RPC reports a linked recording", async () => {
    (supabase.rpc as any).mockResolvedValue({ data: true, error: null });

    const result = await publicLiveHasRecording("token-1");

    expect(result).toBe(true);
    expect(supabase.rpc).toHaveBeenCalledWith("public_live_has_recording", { p_token: "token-1" });
  });

  it("returns false when the RPC reports no recording", async () => {
    (supabase.rpc as any).mockResolvedValue({ data: false, error: null });

    const result = await publicLiveHasRecording("token-1");

    expect(result).toBe(false);
  });

  it("returns false (never throws) when Supabase returns an error", async () => {
    (supabase.rpc as any).mockResolvedValue({ data: null, error: new Error("boom") });

    const result = await publicLiveHasRecording("token-1");

    expect(result).toBe(false);
  });
});
