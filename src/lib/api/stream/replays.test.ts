import { describe, it, expect, vi, beforeEach } from "vitest";
import { listSchoolReplays, getSchoolReplay } from "./replays";
import { setLiveReplayVisibility } from "./lives";
import { supabase } from "@/lib/supabase";

vi.mock("@/lib/supabase", () => ({
  supabase: { from: vi.fn(), rpc: vi.fn() },
}));

const rpc = supabase.rpc as unknown as ReturnType<typeof vi.fn>;

describe("listSchoolReplays", () => {
  beforeEach(() => vi.clearAllMocks());

  it("calls the RPC and returns the rows", async () => {
    rpc.mockResolvedValue({ data: [{ id: "l1", can_watch: true }], error: null });
    const rows = await listSchoolReplays();
    expect(rpc).toHaveBeenCalledWith("list_school_replays");
    expect(rows).toHaveLength(1);
  });

  it("returns an empty array when data is null", async () => {
    rpc.mockResolvedValue({ data: null, error: null });
    expect(await listSchoolReplays()).toEqual([]);
  });

  it("throws on RPC error", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    rpc.mockResolvedValue({ data: null, error: new Error("boom") });
    await expect(listSchoolReplays()).rejects.toThrow("boom");
  });
});

describe("getSchoolReplay", () => {
  beforeEach(() => vi.clearAllMocks());

  it("passes the live id and returns the first row", async () => {
    rpc.mockResolvedValue({ data: [{ id: "l1", can_watch: false }], error: null });
    const row = await getSchoolReplay("l1");
    expect(rpc).toHaveBeenCalledWith("get_school_replay", { p_live_id: "l1" });
    expect(row?.id).toBe("l1");
  });

  it("returns null when there is no row", async () => {
    rpc.mockResolvedValue({ data: [], error: null });
    expect(await getSchoolReplay("l1")).toBeNull();
  });

  it("throws on RPC error", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    rpc.mockResolvedValue({ data: null, error: new Error("boom") });
    await expect(getSchoolReplay("l1")).rejects.toThrow("boom");
  });
});

describe("setLiveReplayVisibility", () => {
  const single = vi.fn();
  const eq = vi.fn(() => ({ select: () => ({ single }) }));
  const update = vi.fn(() => ({ eq }));

  beforeEach(() => {
    vi.clearAllMocks();
    (supabase.from as unknown as ReturnType<typeof vi.fn>).mockReturnValue({ update });
  });

  it("updates only replay_visibility", async () => {
    single.mockResolvedValue({ data: { id: "l1", replay_visibility: "paid" }, error: null });
    const live = await setLiveReplayVisibility("l1", "paid");
    expect(update).toHaveBeenCalledWith({ replay_visibility: "paid" });
    expect(eq).toHaveBeenCalledWith("id", "l1");
    expect(live.replay_visibility).toBe("paid");
  });

  it("throws when Supabase errors", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    single.mockResolvedValue({ data: null, error: new Error("denied") });
    await expect(setLiveReplayVisibility("l1", "all")).rejects.toThrow("denied");
  });
});
