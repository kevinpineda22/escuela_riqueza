import { describe, it, expect } from "vitest";
import { pickWeightedAd, type ActiveAdVideo } from "./ads";

const make = (sponsorId: string, sponsorWeight: number, videoIds: string[]): ActiveAdVideo[] =>
  videoIds.map((vid) => ({
    videoId: vid,
    streamUid: `uid-${vid}`,
    sponsorId,
    sponsorName: `sponsor-${sponsorId}`,
    sponsorWeight,
  }));

describe("pickWeightedAd", () => {
  it("returns null on empty catalog", () => {
    expect(pickWeightedAd([])).toBeNull();
  });

  it("picks the only sponsor if there is only one", () => {
    const catalog = make("A", 10, ["v1", "v2"]);
    const picked = pickWeightedAd(catalog, () => 0);
    expect(picked?.sponsorId).toBe("A");
    expect(["v1", "v2"]).toContain(picked?.videoId);
  });

  it("respects weights when picking a sponsor", () => {
    // A has weight 90, B has weight 10. rng=0.5 → 0.5*100 = 50 → falls in A's bucket.
    const catalog = [
      ...make("A", 90, ["va"]),
      ...make("B", 10, ["vb"]),
    ];
    expect(pickWeightedAd(catalog, () => 0.5)?.sponsorId).toBe("A");
    // rng such that r > 90 → B. 0.95*100 = 95.
    expect(pickWeightedAd(catalog, () => 0.95)?.sponsorId).toBe("B");
  });

  it("falls back to uniform when all weights are zero", () => {
    const catalog = [
      ...make("A", 0, ["va"]),
      ...make("B", 0, ["vb"]),
    ];
    const picked = pickWeightedAd(catalog, () => 0);
    expect(picked).not.toBeNull();
    expect(["va", "vb"]).toContain(picked!.videoId);
  });

  it("picks uniformly among videos within the chosen sponsor", () => {
    const catalog = make("A", 10, ["v1", "v2", "v3"]);
    // First call to rng picks sponsor (only A → always A). Second picks video index.
    let calls = 0;
    const rng = () => {
      const seq = [0.1, 0]; // sponsor pick irrelevant, video pick: 0 → idx 0 → "v1"
      return seq[calls++ % seq.length];
    };
    expect(pickWeightedAd(catalog, rng)?.videoId).toBe("v1");
  });
});
