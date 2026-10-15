import { describe, it, expect } from "vitest";
import { canWatchSchoolReplay, isReplayVisibility, REPLAY_VISIBILITIES } from "./replayVisibility";

describe("canWatchSchoolReplay", () => {
  it("lets admins watch every visibility", () => {
    for (const v of REPLAY_VISIBILITIES) expect(canWatchSchoolReplay(v, "free", "admin")).toBe(true);
  });

  it("opens 'all' to every plan", () => {
    for (const plan of ["free", "individual", "vip"] as const) {
      expect(canWatchSchoolReplay("all", plan, "student")).toBe(true);
    }
  });

  it("restricts 'paid' to individual and vip", () => {
    expect(canWatchSchoolReplay("paid", "free", "student")).toBe(false);
    expect(canWatchSchoolReplay("paid", null, "student")).toBe(false);
    expect(canWatchSchoolReplay("paid", "individual", "student")).toBe(true);
    expect(canWatchSchoolReplay("paid", "vip", "student")).toBe(true);
  });

  it("blocks 'hidden' for non-admins", () => {
    expect(canWatchSchoolReplay("hidden", "vip", "student")).toBe(false);
  });
});

describe("isReplayVisibility", () => {
  it("accepts only known values", () => {
    expect(isReplayVisibility("paid")).toBe(true);
    expect(isReplayVisibility("nope")).toBe(false);
    expect(isReplayVisibility(null)).toBe(false);
  });
});
