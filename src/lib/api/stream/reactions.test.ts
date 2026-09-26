import { describe, it, expect, vi, beforeEach } from "vitest";
import { supabase } from "@/lib/supabase";
import {
  aggregateReactions,
  applyReactionAdded,
  applyReactionRemoved,
  fetchLiveReactions,
  addReaction,
  removeReaction,
  fetchPublicLiveReactions,
  isReactionKey,
  type ReactionRow,
} from "./reactions";

vi.mock("@/lib/supabase", () => ({
  supabase: {
    from: vi.fn(),
    rpc: vi.fn(),
  },
}));

const from = supabase.from as unknown as ReturnType<typeof vi.fn>;
const rpc = supabase.rpc as unknown as ReturnType<typeof vi.fn>;

describe("isReactionKey", () => {
  it("accepts only the 4 approved keys", () => {
    expect(isReactionKey("heart")).toBe(true);
    expect(isReactionKey("fire")).toBe(true);
    expect(isReactionKey("clap")).toBe(true);
    expect(isReactionKey("raised_hands")).toBe(true);
    expect(isReactionKey("thumbs_up")).toBe(false);
  });
});

describe("aggregateReactions", () => {
  const row = (message_id: string, user_id: string, emoji: ReactionRow["emoji"]): ReactionRow => ({
    message_id,
    user_id,
    emoji,
  });

  it("counts reactions per message and emoji", () => {
    const rows = [row("m1", "a", "heart"), row("m1", "b", "heart"), row("m1", "a", "fire"), row("m2", "a", "clap")];
    const result = aggregateReactions(rows, "a");

    expect(result.get("m1")).toEqual({
      heart: { count: 2, mine: true },
      fire: { count: 1, mine: true },
    });
    expect(result.get("m2")).toEqual({ clap: { count: 1, mine: true } });
  });

  it("marks mine=false when the current user has no rows for that emoji", () => {
    const rows = [row("m1", "b", "heart")];
    const result = aggregateReactions(rows, "a");
    expect(result.get("m1")).toEqual({ heart: { count: 1, mine: false } });
  });

  it("returns an empty map for no rows", () => {
    expect(aggregateReactions([], "a").size).toBe(0);
  });
});

describe("applyReactionAdded", () => {
  it("increments a fresh emoji on a message with no reactions yet", () => {
    const result = applyReactionAdded(new Map(), { message_id: "m1", user_id: "b", emoji: "heart" }, "a");
    expect(result.get("m1")).toEqual({ heart: { count: 1, mine: false } });
  });

  it("increments an existing count and preserves other emojis", () => {
    const current = new Map([["m1", { heart: { count: 1, mine: false }, fire: { count: 2, mine: true } }]]);
    const result = applyReactionAdded(current, { message_id: "m1", user_id: "c", emoji: "heart" }, "a");
    expect(result.get("m1")).toEqual({
      heart: { count: 2, mine: false },
      fire: { count: 2, mine: true },
    });
  });

  it("sets mine=true when the added row belongs to the current user", () => {
    const result = applyReactionAdded(new Map(), { message_id: "m1", user_id: "a", emoji: "fire" }, "a");
    expect(result.get("m1")?.fire?.mine).toBe(true);
  });

  it("does not double-count a duplicate echo of the user's own reaction", () => {
    const current = new Map([["m1", { heart: { count: 1, mine: true } }]]);
    const result = applyReactionAdded(current, { message_id: "m1", user_id: "a", emoji: "heart" }, "a");
    expect(result.get("m1")).toEqual({ heart: { count: 1, mine: true } });
  });

  it("returns a new Map instance (React-state friendly)", () => {
    const current = new Map();
    const result = applyReactionAdded(current, { message_id: "m1", user_id: "a", emoji: "heart" }, "a");
    expect(result).not.toBe(current);
  });
});

describe("applyReactionRemoved", () => {
  it("decrements an existing count", () => {
    const current = new Map([["m1", { heart: { count: 2, mine: true } }]]);
    const result = applyReactionRemoved(current, { message_id: "m1", user_id: "a", emoji: "heart" }, "a");
    expect(result.get("m1")).toEqual({ heart: { count: 1, mine: false } });
  });

  it("removes the emoji entry entirely once count reaches 0", () => {
    const current = new Map([["m1", { heart: { count: 1, mine: true } }]]);
    const result = applyReactionRemoved(current, { message_id: "m1", user_id: "a", emoji: "heart" }, "a");
    expect(result.get("m1")).toEqual({});
  });

  it("flips mine to false when the removed row was the current user's own, even if the count stays above 0", () => {
    const current = new Map([["m1", { heart: { count: 2, mine: true } }]]);
    const result = applyReactionRemoved(current, { message_id: "m1", user_id: "a", emoji: "heart" }, "a");
    expect(result.get("m1")).toEqual({ heart: { count: 1, mine: false } });
  });

  it("never lets a count go negative for a stale/duplicate delete", () => {
    const current = new Map([["m1", { heart: { count: 1, mine: true } }]]);
    const once = applyReactionRemoved(current, { message_id: "m1", user_id: "a", emoji: "heart" }, "a");
    const twice = applyReactionRemoved(once, { message_id: "m1", user_id: "a", emoji: "heart" }, "a");
    expect(twice.get("m1")?.heart).toBeUndefined();
  });

  // Regresión: con 2+ personas en el mismo emoji, la actualización optimista de
  // quitar MI reacción + el eco de Realtime del mismo DELETE descontaban dos
  // veces y borraban la reacción del OTRO espectador de todas las pantallas.
  it("my own delete echo after the optimistic removal does not remove another viewer's reaction", () => {
    const current = new Map([["m1", { heart: { count: 2, mine: true } }]]); // yo (a) + b
    const optimistic = applyReactionRemoved(current, { message_id: "m1", user_id: "a", emoji: "heart" }, "a");
    expect(optimistic.get("m1")?.heart).toEqual({ count: 1, mine: false });
    const echo = applyReactionRemoved(optimistic, { message_id: "m1", user_id: "a", emoji: "heart" }, "a");
    expect(echo.get("m1")?.heart).toEqual({ count: 1, mine: false });
  });

  it("another viewer's delete still decrements my view while I keep mine", () => {
    const current = new Map([["m1", { heart: { count: 2, mine: true } }]]);
    const next = applyReactionRemoved(current, { message_id: "m1", user_id: "b", emoji: "heart" }, "a");
    expect(next.get("m1")?.heart).toEqual({ count: 1, mine: true });
  });

  it("is a no-op for a delete on a message the map has no record of", () => {
    const current = new Map();
    const result = applyReactionRemoved(current, { message_id: "unknown", user_id: "a", emoji: "heart" }, "a");
    expect(result).toBe(current);
    expect(result.size).toBe(0);
  });

  it("is a no-op for a delete of an emoji the message has no count for", () => {
    const current = new Map([["m1", { heart: { count: 1, mine: true } }]]);
    const result = applyReactionRemoved(current, { message_id: "m1", user_id: "a", emoji: "fire" }, "a");
    expect(result).toBe(current);
  });
});

describe("fetchLiveReactions", () => {
  beforeEach(() => vi.clearAllMocks());

  it("queries the whole live in one request", async () => {
    const eq = vi.fn().mockResolvedValue({ data: [{ message_id: "m1", user_id: "a", emoji: "heart" }], error: null });
    from.mockReturnValue({ select: () => ({ eq }) });

    const result = await fetchLiveReactions("live-1");

    expect(from).toHaveBeenCalledWith("live_message_reactions");
    expect(eq).toHaveBeenCalledWith("live_id", "live-1");
    expect(result).toEqual([{ message_id: "m1", user_id: "a", emoji: "heart" }]);
  });

  it("throws on error", async () => {
    from.mockReturnValue({ select: () => ({ eq: () => Promise.resolve({ data: null, error: { message: "boom" } }) }) });
    await expect(fetchLiveReactions("live-1")).rejects.toBeTruthy();
  });
});

describe("addReaction / removeReaction", () => {
  beforeEach(() => vi.clearAllMocks());

  it("inserts message_id, live_id, user_id and emoji", async () => {
    const insert = vi.fn().mockResolvedValue({ error: null });
    from.mockReturnValue({ insert });

    await addReaction("m1", "live-1", "heart", "user-1");

    expect(insert).toHaveBeenCalledWith({ message_id: "m1", live_id: "live-1", user_id: "user-1", emoji: "heart" });
  });

  it("treats a unique_violation retry as success, not an error", async () => {
    const insert = vi.fn().mockResolvedValue({ error: { code: "23505" } });
    from.mockReturnValue({ insert });
    await expect(addReaction("m1", "live-1", "heart", "user-1")).resolves.toBeUndefined();
  });

  it("removeReaction scopes the delete to message, emoji and the current user", async () => {
    const eq3 = vi.fn().mockResolvedValue({ error: null });
    const eq2 = vi.fn(() => ({ eq: eq3 }));
    const eq1 = vi.fn(() => ({ eq: eq2 }));
    const del = vi.fn(() => ({ eq: eq1 }));
    from.mockReturnValue({ delete: del });

    await removeReaction("m1", "heart", "user-1");

    expect(eq1).toHaveBeenCalledWith("message_id", "m1");
    expect(eq2).toHaveBeenCalledWith("emoji", "heart");
    expect(eq3).toHaveBeenCalledWith("user_id", "user-1");
  });
});

describe("fetchPublicLiveReactions", () => {
  beforeEach(() => vi.clearAllMocks());

  it("maps RPC rows into a ReactionsByMessage with mine always false", async () => {
    rpc.mockResolvedValue({ data: [{ message_id: "m1", emoji: "heart", total: 3 }], error: null });
    const result = await fetchPublicLiveReactions("token-1");
    expect(rpc).toHaveBeenCalledWith("get_public_live_reactions", { p_token: "token-1" });
    expect(result.get("m1")).toEqual({ heart: { count: 3, mine: false } });
  });

  it("ignores rows with an unrecognized emoji key", async () => {
    rpc.mockResolvedValue({ data: [{ message_id: "m1", emoji: "unknown", total: 1 }], error: null });
    const result = await fetchPublicLiveReactions("token-1");
    expect(result.size).toBe(0);
  });

  it("throws on RPC error", async () => {
    rpc.mockResolvedValue({ data: null, error: { message: "boom" } });
    await expect(fetchPublicLiveReactions("token-1")).rejects.toBeTruthy();
  });
});
