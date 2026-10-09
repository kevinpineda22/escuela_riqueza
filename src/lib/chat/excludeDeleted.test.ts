import { describe, it, expect } from "vitest";
import { excludeDeleted } from "./excludeDeleted";

const messages = [{ id: "m1" }, { id: "m2" }, { id: "m3" }];

describe("excludeDeleted", () => {
  it("quita los ids marcados como eliminados", () => {
    expect(excludeDeleted(messages, new Set(["m2"])).map((m) => m.id)).toEqual(["m1", "m3"]);
  });

  it("devuelve la misma lista si no hay nada que quitar", () => {
    expect(excludeDeleted(messages, new Set())).toBe(messages);
    expect(excludeDeleted(messages, new Set(["otro"]))).toBe(messages);
  });
});
