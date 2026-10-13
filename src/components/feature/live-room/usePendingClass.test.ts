import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import type { RefObject } from "react";
import type { LiveHLSPlayerHandle, LiveLatencyMode } from "@/components/feature/LiveHLSPlayer";
import { usePendingClass, PENDING_CLASS_MIN_BEHIND_S } from "./usePendingClass";

function playerAt(currentTime: number, end: number): RefObject<LiveHLSPlayerHandle | null> {
  const handle = {
    video: { currentTime } as HTMLVideoElement,
    getSeekableRange: () => ({ start: 0, end }),
  };
  return { current: handle as unknown as LiveHLSPlayerHandle };
}

function run(ref: RefObject<LiveHLSPlayerHandle | null>, mode: LiveLatencyMode) {
  return renderHook(({ m }) => usePendingClass(ref, m, 0), { initialProps: { m: mode } });
}

const tick = () => act(() => { vi.advanceTimersByTime(2000); });

describe("usePendingClass", () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  it("en dvr, más de 45 s detrás del filo hay clase pendiente", () => {
    const { result } = run(playerAt(1000 - (PENDING_CLASS_MIN_BEHIND_S + 1), 1000), "dvr");
    expect(result.current).toBe(false);
    tick();
    expect(result.current).toBe(true);
  });

  it("en dvr, a 45 s o menos del filo no hay clase pendiente", () => {
    const { result } = run(playerAt(1000 - PENDING_CLASS_MIN_BEHIND_S, 1000), "dvr");
    tick();
    expect(result.current).toBe(false);
  });

  it("deja de estar pendiente cuando el alumno vuelve al filo", () => {
    const ref = playerAt(900, 1000);
    const { result } = run(ref, "dvr");
    tick();
    expect(result.current).toBe(true);
    (ref.current?.video as { currentTime: number }).currentTime = 990;
    tick();
    expect(result.current).toBe(false);
  });

  it.each(["smooth", "low"] as const)("en %s nunca hay clase pendiente, aunque vaya muy atrasado", (mode) => {
    const { result } = run(playerAt(100, 1000), mode);
    tick();
    expect(result.current).toBe(false);
  });

  it("al salir de dvr descarta un muestreo viejo", () => {
    const ref = playerAt(100, 1000);
    const { result, rerender } = run(ref, "dvr");
    tick();
    expect(result.current).toBe(true);
    rerender({ m: "smooth" });
    expect(result.current).toBe(false);
  });

  it("sin player (ref vacío) no hay clase pendiente", () => {
    const { result } = run({ current: null }, "dvr");
    tick();
    expect(result.current).toBe(false);
  });
});
