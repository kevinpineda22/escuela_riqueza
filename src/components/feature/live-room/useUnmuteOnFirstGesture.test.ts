import { describe, it, expect, vi, afterEach } from "vitest";
import { renderHook } from "@testing-library/react";
import { useUnmuteOnFirstGesture } from "./useUnmuteOnFirstGesture";

describe("useUnmuteOnFirstGesture", () => {
  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("con el sonido bloqueado, el primer toque en cualquier parte lo activa", () => {
    const enable = vi.fn();
    renderHook(() => useUnmuteOnFirstGesture(true, enable));
    const chat = document.createElement("button");
    document.body.appendChild(chat);

    chat.click();

    expect(enable).toHaveBeenCalledTimes(1);
  });

  it("escribir en el chat también cuenta", () => {
    const enable = vi.fn();
    renderHook(() => useUnmuteOnFirstGesture(true, enable));

    document.dispatchEvent(new KeyboardEvent("keydown", { key: "h" }));

    expect(enable).toHaveBeenCalledTimes(1);
  });

  it("los controles de sonido no cuentan: tienen su propia acción", () => {
    const enable = vi.fn();
    renderHook(() => useUnmuteOnFirstGesture(true, enable));
    const prompt = document.createElement("div");
    prompt.setAttribute("data-audio-control", "");
    const dismiss = document.createElement("button");
    prompt.appendChild(dismiss);
    document.body.appendChild(prompt);

    dismiss.click();
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "m" }));

    expect(enable).not.toHaveBeenCalled();
  });

  it("sin bloqueo no escucha nada", () => {
    const enable = vi.fn();
    renderHook(() => useUnmuteOnFirstGesture(false, enable));

    document.body.click();

    expect(enable).not.toHaveBeenCalled();
  });

  it("al resolverse el bloqueo deja de escuchar", () => {
    const enable = vi.fn();
    const { rerender } = renderHook(({ active }) => useUnmuteOnFirstGesture(active, enable), { initialProps: { active: true } });
    rerender({ active: false });

    document.body.click();

    expect(enable).not.toHaveBeenCalled();
  });
});
