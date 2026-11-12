import { describe, expect, it } from "vitest";
import { reactivateWarning } from "./reactivateWarning";

describe("reactivateWarning", () => {
  it("no avisa si la sala no tiene grabación", () => {
    expect(reactivateWarning({ recording_stream_uid: null, recording_r2_key: null })).toBeNull();
  });

  it("avisa si la sala tiene grabación en Stream", () => {
    expect(reactivateWarning({ recording_stream_uid: "fcc4d6fb", recording_r2_key: null })).toMatch(/no se vinculará sola/i);
  });

  it("avisa si la grabación ya está archivada en R2", () => {
    expect(reactivateWarning({ recording_stream_uid: null, recording_r2_key: "recordings/a/b.mp4" })).not.toBeNull();
  });
});
