import { describe, it, expect } from "vitest";
import { formatReplayDuration } from "./format";

describe("formatReplayDuration", () => {
  it("returns null for missing or non-positive durations", () => {
    expect(formatReplayDuration(null)).toBeNull();
    expect(formatReplayDuration(0)).toBeNull();
  });
  it("formats minutes only", () => {
    expect(formatReplayDuration(45 * 60)).toBe("45 min");
  });
  it("formats hours and minutes", () => {
    expect(formatReplayDuration(80 * 60)).toBe("1 h 20 min");
    expect(formatReplayDuration(120 * 60)).toBe("2 h");
  });
});
