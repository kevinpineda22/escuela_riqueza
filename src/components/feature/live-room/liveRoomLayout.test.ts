import { describe, it, expect } from "vitest";
import { getLiveRoomLayout } from "./liveRoomLayout";

describe("getLiveRoomLayout", () => {
  it("celular vertical: apilado", () => {
    expect(getLiveRoomLayout(false, false)).toBe("stacked");
  });

  it("pantalla amplia: lado a lado", () => {
    expect(getLiveRoomLayout(true, false)).toBe("side");
  });

  it("horizontal con poca altura: compacto, sea cual sea el ancho", () => {
    expect(getLiveRoomLayout(true, true)).toBe("compact"); // 844×390
    expect(getLiveRoomLayout(false, true)).toBe("compact"); // 667×375
  });
});
