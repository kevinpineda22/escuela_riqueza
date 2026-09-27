import { describe, it, expect, vi } from "vitest";
import { scrollWithinList } from "./scrollWithinList";

function rect(top: number, height: number): DOMRect {
  return { top, bottom: top + height, height, left: 0, right: 0, width: 0, x: 0, y: top, toJSON: () => ({}) };
}

/** A list showing y=100..400 (clientHeight 300) and an element at the given position. */
function setup(elTop: number, elHeight: number) {
  const list = document.createElement("div");
  const el = document.createElement("div");
  Object.defineProperty(list, "clientHeight", { value: 300 });
  list.getBoundingClientRect = () => rect(100, 300);
  el.getBoundingClientRect = () => rect(elTop, elHeight);
  const scrollBy = vi.fn();
  list.scrollBy = scrollBy as unknown as typeof list.scrollBy;
  return { list, el, scrollBy };
}

describe("scrollWithinList", () => {
  it("nearest: scrolls down just enough (plus margin) when the element overflows the bottom", () => {
    const { list, el, scrollBy } = setup(380, 50);
    scrollWithinList(list, el, "nearest");
    expect(scrollBy).toHaveBeenCalledWith({ top: 42, behavior: "smooth" });
  });

  it("nearest: scrolls up when the element is above the visible area", () => {
    const { list, el, scrollBy } = setup(80, 50);
    scrollWithinList(list, el, "nearest");
    expect(scrollBy).toHaveBeenCalledWith({ top: -32, behavior: "smooth" });
  });

  it("nearest: does nothing when the element is already visible", () => {
    const { list, el, scrollBy } = setup(200, 50);
    scrollWithinList(list, el, "nearest");
    expect(scrollBy).not.toHaveBeenCalled();
  });

  it("center: centers the element in the list", () => {
    const { list, el, scrollBy } = setup(500, 40);
    scrollWithinList(list, el, "center");
    // 500 - 100 - (300 - 40) / 2 = 270
    expect(scrollBy).toHaveBeenCalledWith({ top: 270, behavior: "smooth" });
  });

  it("falls back to scrollTop when scrollBy with options is unsupported", () => {
    const { list, el } = setup(380, 50);
    list.scrollBy = (() => {
      throw new TypeError("unsupported");
    }) as unknown as typeof list.scrollBy;
    scrollWithinList(list, el, "nearest");
    expect(list.scrollTop).toBe(42);
  });
});
