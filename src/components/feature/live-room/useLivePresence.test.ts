import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import type { User } from "@/types/user";
import { useLivePresence } from "./useLivePresence";

type SyncHandler = () => void;

const mocks = vi.hoisted(() => {
  const channel = {
    handlers: [] as (() => void)[],
    on: vi.fn(),
    subscribe: vi.fn(),
    track: vi.fn(),
    untrack: vi.fn(),
    presenceState: vi.fn(),
  };
  return { channel, supabaseChannel: vi.fn(), removeChannel: vi.fn() };
});

vi.mock("@/lib/supabase", () => ({
  supabase: { channel: mocks.supabaseChannel, removeChannel: mocks.removeChannel },
}));

const user = { id: "u1", fullName: "Ana Ruiz", avatarUrl: null, plan: "vip" } as User;

function sync() {
  act(() => {
    mocks.channel.handlers.forEach((handler) => handler());
  });
}

describe("useLivePresence", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.channel.handlers = [];
    mocks.channel.on.mockImplementation((_type: string, _filter: unknown, handler: SyncHandler) => {
      mocks.channel.handlers.push(handler);
      return mocks.channel;
    });
    mocks.channel.subscribe.mockImplementation((callback: (status: string) => void) => {
      callback("SUBSCRIBED");
      return mocks.channel;
    });
    mocks.channel.track.mockResolvedValue("ok");
    mocks.channel.untrack.mockResolvedValue("ok");
    mocks.channel.presenceState.mockReturnValue({
      u1: [{ user_id: "u1", full_name: "Ana Ruiz", avatar_url: null, plan: "vip", online_at: "x" }],
      "anon-9": [{ name: "Invitado", anonymous: true, online_at: "x" }],
    });
    mocks.supabaseChannel.mockReturnValue(mocks.channel);
  });

  it("por defecto se trackea con su key de usuario", () => {
    renderHook(() => useLivePresence({ liveId: "live-1", user, enabled: true }));

    expect(mocks.supabaseChannel).toHaveBeenCalledWith("live_presence:live-1", { config: { presence: { key: "u1" } } });
    expect(mocks.channel.track).toHaveBeenCalledTimes(1);
  });

  it("sin usuario ni anonId no se suscribe", () => {
    renderHook(() => useLivePresence({ liveId: "live-1", user: null, enabled: true }));

    expect(mocks.supabaseChannel).not.toHaveBeenCalled();
  });

  it("observeOnly: se suscribe sin user ni anonId, no hace track y actualiza los conteos", () => {
    const { result, unmount } = renderHook(() => useLivePresence({ liveId: "live-1", user: null, enabled: true, observeOnly: true }));

    expect(mocks.supabaseChannel).toHaveBeenCalledWith("live_presence:live-1", { config: {} });
    expect(mocks.channel.subscribe).toHaveBeenCalledTimes(1);
    expect(mocks.channel.track).not.toHaveBeenCalled();

    sync();
    expect(result.current.totalViewers).toBe(2);
    expect(result.current.viewers).toHaveLength(1);

    unmount();
    expect(mocks.channel.untrack).not.toHaveBeenCalled();
    expect(mocks.removeChannel).toHaveBeenCalledWith(mocks.channel);
  });

  it("observeOnly con enabled false no se suscribe", () => {
    renderHook(() => useLivePresence({ liveId: "live-1", user: null, enabled: false, observeOnly: true }));

    expect(mocks.supabaseChannel).not.toHaveBeenCalled();
  });
});
