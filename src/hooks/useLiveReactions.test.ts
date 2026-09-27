import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { useLiveReactions } from "./useLiveReactions";
import { supabase } from "@/lib/supabase";
import { toast } from "@/components/ui/toaster";

// El hook abre su PROPIO canal (`live_reactions_${liveId}`), separado del de
// mensajes de LiveChat — ver useLiveReactions.ts. Un solo canal mock alcanza
// acá porque el hook se prueba de forma aislada.
const channel = { on: vi.fn(), subscribe: vi.fn() };

vi.mock("@/lib/supabase", () => ({
  supabase: {
    from: vi.fn(),
    channel: vi.fn(() => channel),
    removeChannel: vi.fn(),
  },
}));

vi.mock("@/components/ui/toaster", () => ({
  toast: { error: vi.fn() },
}));

const from = supabase.from as unknown as ReturnType<typeof vi.fn>;

type RealtimeReactionRow = { message_id: string; user_id: string; emoji: string };

const insertHandler = () => channel.on.mock.calls[0][2] as (payload: { new: RealtimeReactionRow }) => void;
const deleteHandler = () => channel.on.mock.calls[1][2] as (payload: { old: Partial<RealtimeReactionRow> }) => void;
const statusCallback = () => channel.subscribe.mock.calls[0][0] as (status: string) => void;

/** Cadena completa de `supabase.from("live_message_reactions")` usada por reactions.ts. */
function makeFromMock() {
  const selectIn = vi.fn().mockResolvedValue({ data: [], error: null });
  const selectEq = vi.fn(() => ({ in: selectIn }));
  const select = vi.fn(() => ({ eq: selectEq }));
  const insert = vi.fn().mockResolvedValue({ error: null });
  const deleteEq3 = vi.fn().mockResolvedValue({ error: null });
  const deleteEq2 = vi.fn(() => ({ eq: deleteEq3 }));
  const deleteEq1 = vi.fn(() => ({ eq: deleteEq2 }));
  const del = vi.fn(() => ({ eq: deleteEq1 }));
  return { select, selectEq, selectIn, insert, delete: del, deleteEq1, deleteEq2, deleteEq3 };
}

describe("useLiveReactions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    channel.on.mockReturnValue(channel);
    channel.subscribe.mockReturnValue(channel);
  });

  it("loads the snapshot once historyReady flips true, scoped to the current messageIds", async () => {
    const mocks = makeFromMock();
    mocks.selectIn.mockResolvedValue({ data: [{ message_id: "m1", user_id: "b", emoji: "heart" }], error: null });
    from.mockReturnValue(mocks);

    const { result, rerender } = renderHook(
      ({ historyReady, messageIds }: { historyReady: boolean; messageIds: string[] }) =>
        useLiveReactions({ liveId: "live-1", userId: "a", messageIds, historyReady }),
      { initialProps: { historyReady: false, messageIds: [] as string[] } }
    );

    // El historial todavía no resolvió: nada se pide.
    expect(from).not.toHaveBeenCalled();

    rerender({ historyReady: true, messageIds: ["m1"] });

    await waitFor(() => expect(result.current.reactions.get("m1")).toEqual({ heart: { count: 1, mine: false } }));
    expect(mocks.selectEq).toHaveBeenCalledWith("live_id", "live-1");
    expect(mocks.selectIn).toHaveBeenCalledWith("message_id", ["m1"]);
  });

  it("preserves a realtime insert that arrives while the initial snapshot is still loading", async () => {
    const mocks = makeFromMock();
    let resolveSnapshot: (value: { data: unknown[]; error: null }) => void = () => {};
    mocks.selectIn.mockReturnValue(new Promise((resolve) => { resolveSnapshot = resolve; }));
    from.mockReturnValue(mocks);

    const { result, rerender } = renderHook(
      ({ historyReady, messageIds }: { historyReady: boolean; messageIds: string[] }) =>
        useLiveReactions({ liveId: "live-1", userId: "a", messageIds, historyReady }),
      { initialProps: { historyReady: false, messageIds: [] as string[] } }
    );
    rerender({ historyReady: true, messageIds: ["m1"] });

    // El evento de Realtime llega ANTES de que el snapshot resuelva.
    act(() => {
      insertHandler()({ new: { message_id: "m1", user_id: "b", emoji: "fire" } });
    });
    expect(result.current.reactions.get("m1")).toEqual({ fire: { count: 1, mine: false } });

    // El snapshot resuelve vacío — el merge debe conservar el evento bufferizado.
    await act(async () => {
      resolveSnapshot({ data: [], error: null });
    });

    expect(result.current.reactions.get("m1")).toEqual({ fire: { count: 1, mine: false } });
  });

  it("rolls back an optimistic toggle and toasts when the server call fails", async () => {
    const mocks = makeFromMock();
    mocks.insert.mockRejectedValue(new Error("boom"));
    from.mockReturnValue(mocks);

    const { result } = renderHook(() =>
      useLiveReactions({ liveId: "live-1", userId: "a", messageIds: [], historyReady: false })
    );

    await act(async () => {
      await result.current.toggleReaction("m1", "heart");
    });

    expect(result.current.reactions.get("m1")).toBeUndefined();
    expect(toast.error).toHaveBeenCalledWith("No se pudo guardar tu reacción");
  });

  it("removes a reaction and does not roll back once the server confirms the delete", async () => {
    const mocks = makeFromMock();
    from.mockReturnValue(mocks);
    mocks.selectIn.mockResolvedValue({ data: [{ message_id: "m1", user_id: "a", emoji: "heart" }], error: null });

    const { result, rerender } = renderHook(
      ({ historyReady, messageIds }: { historyReady: boolean; messageIds: string[] }) =>
        useLiveReactions({ liveId: "live-1", userId: "a", messageIds, historyReady }),
      { initialProps: { historyReady: false, messageIds: [] as string[] } }
    );
    rerender({ historyReady: true, messageIds: ["m1"] });
    await waitFor(() => expect(result.current.reactions.get("m1")?.heart?.mine).toBe(true));

    await act(async () => {
      await result.current.toggleReaction("m1", "heart");
    });

    expect(mocks.deleteEq1).toHaveBeenCalledWith("message_id", "m1");
    expect(mocks.deleteEq2).toHaveBeenCalledWith("emoji", "heart");
    expect(mocks.deleteEq3).toHaveBeenCalledWith("user_id", "a");
    expect(result.current.reactions.get("m1")?.heart).toBeUndefined();
  });

  it("does not resync on the very first SUBSCRIBED", async () => {
    const mocks = makeFromMock();
    from.mockReturnValue(mocks);

    renderHook(() => useLiveReactions({ liveId: "live-1", userId: "a", messageIds: ["m1"], historyReady: false }));

    act(() => statusCallback()("SUBSCRIBED"));

    // historyReady sigue en false y esta es la primera vez que se suscribe:
    // ningún resync debería haber pedido nada todavía.
    expect(from).not.toHaveBeenCalled();
  });

  it("resyncs the snapshot after a real reconnect (SUBSCRIBED after having dropped)", async () => {
    const mocks = makeFromMock();
    from.mockReturnValue(mocks);

    renderHook(() => useLiveReactions({ liveId: "live-1", userId: "a", messageIds: ["m1"], historyReady: false }));

    act(() => statusCallback()("SUBSCRIBED"));
    expect(from).not.toHaveBeenCalled();

    act(() => statusCallback()("CHANNEL_ERROR"));
    act(() => statusCallback()("SUBSCRIBED"));

    await waitFor(() => expect(mocks.select).toHaveBeenCalledTimes(1));
    expect(mocks.selectIn).toHaveBeenCalledWith("message_id", ["m1"]);
  });

  it("a delete event with an unrecognized emoji or missing fields is ignored", async () => {
    const mocks = makeFromMock();
    from.mockReturnValue(mocks);

    const { result } = renderHook(() =>
      useLiveReactions({ liveId: "live-1", userId: "a", messageIds: [], historyReady: false })
    );

    act(() => {
      deleteHandler()({ old: { message_id: "m1", user_id: "b" } });
    });

    expect(result.current.reactions.size).toBe(0);
  });
});
