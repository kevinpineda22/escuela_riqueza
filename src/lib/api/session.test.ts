import { describe, it, expect, vi, beforeEach } from "vitest";
import { claimActiveSession } from "./session";
import { supabase } from "@/lib/supabase";

vi.mock("@/lib/supabase", () => ({
  supabase: {
    rpc: vi.fn(),
  },
}));

const rpc = supabase.rpc as unknown as ReturnType<typeof vi.fn>;

describe("claimActiveSession", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  it("returns active when the RPC confirms this session", async () => {
    rpc.mockResolvedValue({ data: true, error: null });
    await expect(claimActiveSession()).resolves.toBe("active");
    expect(rpc).toHaveBeenCalledWith("claim_active_session");
  });

  it("returns superseded when a newer session owns the account", async () => {
    rpc.mockResolvedValue({ data: false, error: null });
    await expect(claimActiveSession()).resolves.toBe("superseded");
  });

  it("fails open when the RPC returns an error (e.g. migration not applied)", async () => {
    rpc.mockResolvedValue({ data: null, error: { message: "function does not exist" } });
    await expect(claimActiveSession()).resolves.toBe("unknown");
  });

  it("fails open on a network error", async () => {
    rpc.mockRejectedValue(new TypeError("Failed to fetch"));
    await expect(claimActiveSession()).resolves.toBe("unknown");
  });

  it("fails open on an unexpected payload", async () => {
    rpc.mockResolvedValue({ data: null, error: null });
    await expect(claimActiveSession()).resolves.toBe("unknown");
  });
});
