import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { startPagePolling } from "./pagePolling";

function setVisibility(state: "visible" | "hidden") {
  Object.defineProperty(document, "visibilityState", { value: state, configurable: true });
  document.dispatchEvent(new Event("visibilitychange"));
}

describe("startPagePolling", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    setVisibility("visible");
  });
  afterEach(() => {
    setVisibility("visible");
    vi.useRealTimers();
  });

  it("consulta en cada intervalo con la pestaña visible", () => {
    const tick = vi.fn();
    const stop = startPagePolling(tick, 3000);
    vi.advanceTimersByTime(9000);
    expect(tick).toHaveBeenCalledTimes(3);
    stop();
  });

  it("no consulta con la pestaña oculta y consulta al instante al volver", () => {
    const tick = vi.fn();
    const stop = startPagePolling(tick, 3000);
    setVisibility("hidden");
    vi.advanceTimersByTime(30000);
    expect(tick).not.toHaveBeenCalled();

    setVisibility("visible");
    expect(tick).toHaveBeenCalledTimes(1);
    stop();
  });

  it("al detenerse no vuelve a consultar", () => {
    const tick = vi.fn();
    const stop = startPagePolling(tick, 3000);
    stop();
    vi.advanceTimersByTime(9000);
    setVisibility("hidden");
    setVisibility("visible");
    expect(tick).not.toHaveBeenCalled();
  });
});
