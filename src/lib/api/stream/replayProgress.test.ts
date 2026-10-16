import { describe, it, expect, vi, beforeEach } from "vitest";
import { getReplayProgress, saveReplayProgress } from "./replayProgress";
import { supabase } from "@/lib/supabase";

vi.mock("@/lib/supabase", () => ({
  supabase: {
    auth: { getSession: vi.fn() },
    from: vi.fn(),
  },
}));

const from = vi.mocked(supabase.from);
const getSession = vi.mocked(supabase.auth.getSession);

describe("getReplayProgress", () => {
  const maybeSingle = vi.fn();
  const eq = vi.fn(() => ({ maybeSingle }));
  const select = vi.fn(() => ({ eq }));

  beforeEach(() => {
    vi.clearAllMocks();
    from.mockReturnValue({ select } as never);
  });

  it("reads the row for the live", async () => {
    maybeSingle.mockResolvedValue({ data: { position_seconds: 120, duration_seconds: 3600 }, error: null });
    await expect(getReplayProgress("live-1")).resolves.toEqual({ position_seconds: 120, duration_seconds: 3600 });
    expect(from).toHaveBeenCalledWith("user_replay_progress");
    expect(eq).toHaveBeenCalledWith("live_id", "live-1");
  });

  it("returns null when there is no row", async () => {
    maybeSingle.mockResolvedValue({ data: null, error: null });
    await expect(getReplayProgress("live-1")).resolves.toBeNull();
  });

  it("returns null when the read fails", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    maybeSingle.mockResolvedValue({ data: null, error: { message: "boom" } });
    await expect(getReplayProgress("live-1")).resolves.toBeNull();
    spy.mockRestore();
  });
});

describe("saveReplayProgress", () => {
  const upsert = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    upsert.mockResolvedValue({ error: null });
    from.mockReturnValue({ upsert } as never);
    getSession.mockResolvedValue({ data: { session: { user: { id: "user-1" } } } } as never);
  });

  it("upserts the floored position with the user and live ids", async () => {
    await saveReplayProgress("live-1", 42.9, 3600.4);
    expect(from).toHaveBeenCalledWith("user_replay_progress");
    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({ user_id: "user-1", live_id: "live-1", position_seconds: 42, duration_seconds: 3600 }),
    );
  });

  it("stores a null duration when it is unknown", async () => {
    await saveReplayProgress("live-1", 10, NaN);
    expect(upsert).toHaveBeenCalledWith(expect.objectContaining({ duration_seconds: null }));
  });

  it("does nothing without a session", async () => {
    getSession.mockResolvedValue({ data: { session: null } } as never);
    await saveReplayProgress("live-1", 10, 100);
    expect(upsert).not.toHaveBeenCalled();
  });

  it("does not throw when the upsert fails", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    upsert.mockResolvedValue({ error: { message: "boom" } });
    await expect(saveReplayProgress("live-1", 10, 100)).resolves.toBeUndefined();
    spy.mockRestore();
  });
});
