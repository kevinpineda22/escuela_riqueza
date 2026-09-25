import { describe, it, expect } from "vitest";
import { getLiveRoomStatus } from "./liveRoomStatus";
import type { LiveEvent } from "@/lib/api/stream/lives";

const liveWith = (fields: Partial<LiveEvent>) => ({ status: "scheduled", is_paused: false, ...fields }) as LiveEvent;

describe("getLiveRoomStatus", () => {
  it("programada sin señal: ni en vivo ni player", () => {
    expect(getLiveRoomStatus(liveWith({}), false)).toEqual({ isLive: false, isEnded: false, isPaused: false, showPlayer: false });
  });

  it("programada con señal de OBS: monta el player sin estar en vivo", () => {
    const status = getLiveRoomStatus(liveWith({}), true);
    expect(status.showPlayer).toBe(true);
    expect(status.isLive).toBe(false);
  });

  it("en vivo pausada: el player sigue montado (H7) pero no cuenta como en vivo", () => {
    const status = getLiveRoomStatus(liveWith({ status: "live", is_paused: true }), false);
    expect(status).toEqual({ isLive: false, isEnded: false, isPaused: true, showPlayer: true });
  });

  it("finalizada con OBS todavía conectado: muestra el cierre, no el player (F33)", () => {
    const status = getLiveRoomStatus(liveWith({ status: "ended" }), true);
    expect(status.isEnded).toBe(true);
    expect(status.showPlayer).toBe(false);
  });
});
