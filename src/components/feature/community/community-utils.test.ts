import { describe, it, expect } from "vitest";
import type { CommunityComment } from "@/lib/api/community";
import { mergeComments } from "./community-utils";

const comment = (id: string, created_at: string): CommunityComment => ({
  id,
  post_id: "p",
  author_id: "a",
  parent_id: null,
  body: id,
  like_count: 0,
  created_at,
  updated_at: created_at,
  author: null,
});

describe("mergeComments", () => {
  it("no duplica lo que ya vino del servidor", () => {
    const a = comment("a", "2026-10-01T10:00:00Z");
    expect(mergeComments([a], [a])).toEqual([a]);
  });

  it("conserva un comentario propio más nuevo que la respuesta (refetch que salió antes)", () => {
    const a = comment("a", "2026-10-01T10:00:00Z");
    const mine = comment("mine", "2026-10-01T10:05:00Z");
    expect(mergeComments([a], [a, mine])).toEqual([a, mine]);
  });

  it("descarta lo viejo que el servidor ya no trae (eliminado)", () => {
    const a = comment("a", "2026-10-01T10:00:00Z");
    const gone = comment("gone", "2026-10-01T09:00:00Z");
    expect(mergeComments([a], [gone, a])).toEqual([a]);
  });
});
