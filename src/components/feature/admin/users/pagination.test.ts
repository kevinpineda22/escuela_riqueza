import { describe, it, expect } from "vitest";
import { pageNumbers, pageSlice } from "./pagination";

describe("pageSlice", () => {
  it("corta de a 20", () => {
    expect(pageSlice(89, 1)).toEqual({ page: 1, pageCount: 5, start: 0, end: 20 });
    expect(pageSlice(89, 5)).toEqual({ page: 5, pageCount: 5, start: 80, end: 89 });
  });

  it("si el filtro deja menos resultados, vuelve a la última página que existe", () => {
    expect(pageSlice(6, 4)).toEqual({ page: 1, pageCount: 1, start: 0, end: 6 });
  });

  it("sin resultados hay una página vacía, no cero", () => {
    expect(pageSlice(0, 3)).toEqual({ page: 1, pageCount: 1, start: 0, end: 0 });
  });
});

describe("pageNumbers", () => {
  it("en la primera página: vecina, salto y última", () => {
    expect(pageNumbers(1, 5)).toEqual([1, 2, null, 5]);
    expect(pageNumbers(1, 1)).toEqual([1]);
  });

  it("marca los saltos y no esconde una sola página suelta", () => {
    expect(pageNumbers(5, 10)).toEqual([1, null, 4, 5, 6, null, 10]);
    expect(pageNumbers(3, 5)).toEqual([1, 2, 3, 4, 5]);
  });
});
