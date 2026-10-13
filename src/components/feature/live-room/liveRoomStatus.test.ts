import { describe, it, expect } from "vitest";
import { getLiveRoomStatus, isSameLive, withEndedContinuation } from "./liveRoomStatus";
import type { LiveEvent } from "@/lib/api/stream/lives";

const liveWith = (fields: Partial<LiveEvent>) => ({ status: "scheduled", is_paused: false, ...fields }) as LiveEvent;

describe("withEndedContinuation", () => {
  it("finalizada con clase pendiente: el player sigue montado", () => {
    const ended = getLiveRoomStatus(liveWith({ status: "ended" }), true);
    expect(ended.showPlayer).toBe(false);
    expect(withEndedContinuation(ended, true)).toEqual({ ...ended, showPlayer: true });
  });

  it("sin continuación o con la sala abierta no cambia nada", () => {
    const ended = getLiveRoomStatus(liveWith({ status: "ended" }), false);
    const live = getLiveRoomStatus(liveWith({ status: "live" }), false);
    expect(withEndedContinuation(ended, false)).toBe(ended);
    expect(withEndedContinuation(live, true)).toBe(live);
  });
});

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

describe("isSameLive (F38)", () => {
  it("misma fila con otro objeto: igual (no hace falta re-renderizar)", () => {
    expect(isSameLive(liveWith({ id: "a", title: "x" }), liveWith({ id: "a", title: "x" }))).toBe(true);
  });

  it("un campo distinto: distinta", () => {
    expect(isSameLive(liveWith({ id: "a", is_paused: false }), liveWith({ id: "a", is_paused: true }))).toBe(false);
  });

  it("con null de un lado: distinta; los dos null: igual", () => {
    expect(isSameLive(null, liveWith({}))).toBe(false);
    expect(isSameLive(null, null)).toBe(true);
  });
});
