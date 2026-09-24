import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, waitFor, act } from "@testing-library/react";
import SessionGuard from "./SessionGuard";
import { supabase } from "@/lib/supabase";
import { claimActiveSession } from "@/lib/api/session";
import { toast } from "@/components/ui/toaster";
import { useAuthStore } from "@/stores/auth.store";
import type { User } from "@/types/user";

const channel = { on: vi.fn(), subscribe: vi.fn() };

vi.mock("@/lib/supabase", () => ({
  supabase: {
    channel: vi.fn(() => channel),
    removeChannel: vi.fn(),
    auth: { signOut: vi.fn() },
  },
}));

vi.mock("@/lib/api/session", () => ({
  claimActiveSession: vi.fn(),
}));

vi.mock("@/components/ui/toaster", () => ({
  toast: { warning: vi.fn() },
}));

const claim = claimActiveSession as unknown as ReturnType<typeof vi.fn>;
const signOut = supabase.auth.signOut as unknown as ReturnType<typeof vi.fn>;

const student = { id: "user-1", fullName: "Alumno" } as User;

describe("SessionGuard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    channel.on.mockReturnValue(channel);
    channel.subscribe.mockReturnValue(channel);
    signOut.mockResolvedValue({ error: null });
    useAuthStore.setState({ user: student, token: "t" });
  });

  afterEach(() => {
    useAuthStore.setState({ user: null, token: null });
  });

  it("does nothing without a logged-in user", () => {
    useAuthStore.setState({ user: null, token: null });
    render(<SessionGuard />);
    expect(claim).not.toHaveBeenCalled();
    expect(supabase.channel).not.toHaveBeenCalled();
  });

  it("keeps the session when it is the active one", async () => {
    claim.mockResolvedValue("active");
    render(<SessionGuard />);
    await waitFor(() => expect(claim).toHaveBeenCalled());
    expect(signOut).not.toHaveBeenCalled();
    expect(toast.warning).not.toHaveBeenCalled();
  });

  it("signs out locally and explains why when another device took over", async () => {
    claim.mockResolvedValue("superseded");
    render(<SessionGuard />);
    await waitFor(() => expect(signOut).toHaveBeenCalledWith({ scope: "local" }));
    expect(toast.warning).toHaveBeenCalledWith("Tu sesión se cerró", expect.objectContaining({
      description: expect.stringContaining("otro dispositivo"),
    }));
  });

  it("fails open when the session cannot be verified", async () => {
    claim.mockResolvedValue("unknown");
    render(<SessionGuard />);
    await waitFor(() => expect(claim).toHaveBeenCalled());
    expect(signOut).not.toHaveBeenCalled();
  });

  it("subscribes to its own row and re-checks when the change arrives", async () => {
    claim.mockResolvedValue("active");
    render(<SessionGuard />);
    await waitFor(() => expect(claim).toHaveBeenCalledTimes(1));

    const [, filter, onChange] = channel.on.mock.calls[0];
    expect(filter).toMatchObject({ table: "user_active_sessions", filter: "user_id=eq.user-1" });

    claim.mockResolvedValue("superseded");
    await act(async () => { onChange(); });
    await waitFor(() => expect(signOut).toHaveBeenCalledWith({ scope: "local" }));
  });

  it("re-checks when the tab becomes visible again", async () => {
    claim.mockResolvedValue("active");
    render(<SessionGuard />);
    await waitFor(() => expect(claim).toHaveBeenCalledTimes(1));

    await act(async () => { document.dispatchEvent(new Event("visibilitychange")); });
    await waitFor(() => expect(claim).toHaveBeenCalledTimes(2));
  });

  it("removes the channel and listener on unmount", async () => {
    claim.mockResolvedValue("active");
    const { unmount } = render(<SessionGuard />);
    await waitFor(() => expect(claim).toHaveBeenCalled());
    unmount();
    expect(supabase.removeChannel).toHaveBeenCalledWith(channel);

    await act(async () => { document.dispatchEvent(new Event("visibilitychange")); });
    expect(claim).toHaveBeenCalledTimes(1);
  });
});
