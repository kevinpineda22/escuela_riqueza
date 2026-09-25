import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { useChatScroll } from "./useChatScroll";
import { ChatJumpToLatest } from "@/components/feature/ChatJumpToLatest";

function Harness({ count }: { count: number }) {
  const { listRef, handleScroll, unseenCount, jumpToLatest } = useChatScroll(count, true);
  return (
    <>
      <div data-testid="list" ref={listRef} onScroll={handleScroll} />
      <ChatJumpToLatest count={unseenCount} onClick={jumpToLatest} />
    </>
  );
}

// jsdom no hace layout: se fijan a mano las medidas del contenedor.
function setScrollMetrics(el: HTMLElement, { scrollHeight, scrollTop }: { scrollHeight: number; scrollTop: number }) {
  Object.defineProperty(el, "scrollHeight", { configurable: true, value: scrollHeight });
  Object.defineProperty(el, "clientHeight", { configurable: true, value: 400 });
  el.scrollTop = scrollTop;
}

describe("useChatScroll (F19)", () => {
  it("al final: acompaña los mensajes nuevos sin mostrar aviso", () => {
    const { rerender } = render(<Harness count={10} />);
    const list = screen.getByTestId("list");
    setScrollMetrics(list, { scrollHeight: 1200, scrollTop: 800 });

    rerender(<Harness count={12} />);

    expect(list.scrollTop).toBe(1200);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("leyendo arriba: respeta la posición y cuenta los mensajes que llegan", () => {
    const { rerender } = render(<Harness count={10} />);
    const list = screen.getByTestId("list");
    setScrollMetrics(list, { scrollHeight: 1200, scrollTop: 200 });
    fireEvent.scroll(list);

    rerender(<Harness count={13} />);

    expect(list.scrollTop).toBe(200);
    expect(screen.getByRole("button", { name: "3 mensajes nuevos" })).toBeInTheDocument();
  });

  it("el aviso lleva al final y retoma el seguimiento", async () => {
    const { rerender } = render(<Harness count={10} />);
    const list = screen.getByTestId("list");
    setScrollMetrics(list, { scrollHeight: 1200, scrollTop: 200 });
    fireEvent.scroll(list);
    rerender(<Harness count={11} />);

    fireEvent.click(screen.getByRole("button", { name: "1 mensaje nuevo" }));

    expect(list.scrollTop).toBe(1200);
    await waitFor(() => expect(screen.queryByRole("button")).not.toBeInTheDocument());
  });

  it("volver al final a mano también apaga el aviso", async () => {
    const { rerender } = render(<Harness count={10} />);
    const list = screen.getByTestId("list");
    setScrollMetrics(list, { scrollHeight: 1200, scrollTop: 200 });
    fireEvent.scroll(list);
    rerender(<Harness count={12} />);
    expect(screen.getByRole("button", { name: "2 mensajes nuevos" })).toBeInTheDocument();

    list.scrollTop = 790;
    fireEvent.scroll(list);

    await waitFor(() => expect(screen.queryByRole("button")).not.toBeInTheDocument());
  });
});

describe("useChatScroll — cambios de alto (F15)", () => {
  // jsdom no trae ResizeObserver: uno mínimo que permite disparar el cambio a mano.
  let resize: (() => void) | null = null;
  const observe = vi.fn();
  const disconnect = vi.fn();
  class FakeResizeObserver {
    constructor(cb: () => void) {
      resize = cb;
    }
    observe = observe;
    disconnect = disconnect;
  }

  afterEach(() => {
    vi.unstubAllGlobals();
    observe.mockClear();
    disconnect.mockClear();
    resize = null;
  });

  it("al final: si la lista se achica (teclado, rotación) sigue mostrando lo último", () => {
    vi.stubGlobal("ResizeObserver", FakeResizeObserver);
    render(<Harness count={10} />);
    const list = screen.getByTestId("list");
    setScrollMetrics(list, { scrollHeight: 1200, scrollTop: 800 });

    // El teclado achica la lista: el último mensaje queda debajo del borde.
    Object.defineProperty(list, "clientHeight", { configurable: true, value: 150 });
    resize?.();

    expect(list.scrollTop).toBe(1200);
  });

  it("leyendo arriba: deja de observar, así un cambio de alto no lo mueve", () => {
    vi.stubGlobal("ResizeObserver", FakeResizeObserver);
    render(<Harness count={10} />);
    const list = screen.getByTestId("list");
    expect(observe).toHaveBeenCalledTimes(1);
    // El desmontaje del test anterior también desconecta: medir desde acá.
    disconnect.mockClear();

    setScrollMetrics(list, { scrollHeight: 1200, scrollTop: 200 });
    fireEvent.scroll(list);

    expect(disconnect).toHaveBeenCalledTimes(1);
    expect(observe).toHaveBeenCalledTimes(1);
    expect(list.scrollTop).toBe(200);
  });
});
