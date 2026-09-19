import { describe, it, expect } from "vitest";
import { mergeMessagesById } from "./mergeMessagesById";

describe("mergeMessagesById", () => {
  it("appends new messages without duplicating existing ones", () => {
    const current = [{ id: "1", created_at: "2026-01-01T00:00:00.000Z" }];
    const incoming = [
      { id: "1", created_at: "2026-01-01T00:00:00.000Z" },
      { id: "2", created_at: "2026-01-01T00:00:05.000Z" },
    ];

    const result = mergeMessagesById(current, incoming);

    expect(result.map((m) => m.id)).toEqual(["1", "2"]);
  });

  it("keeps chronological order regardless of arrival order", () => {
    const current = [{ id: "2", created_at: "2026-01-01T00:00:05.000Z" }];
    const incoming = [{ id: "1", created_at: "2026-01-01T00:00:00.000Z" }];

    const result = mergeMessagesById(current, incoming);

    expect(result.map((m) => m.id)).toEqual(["1", "2"]);
  });

  it("returns the same list when there is nothing new", () => {
    const current = [{ id: "1", created_at: "2026-01-01T00:00:00.000Z" }];
    const result = mergeMessagesById(current, []);
    expect(result).toEqual(current);
  });
});
