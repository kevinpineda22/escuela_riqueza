import { describe, it, expect } from "vitest";
import { Suspense } from "react";
import { render, screen, act } from "@testing-library/react";
import { lazyPage } from "./lazyPage";

const Page = () => <p>página</p>;

describe("lazyPage", () => {
  it("renderiza la página cuando el módulo llega", async () => {
    const LazyPage = lazyPage(() => Promise.resolve({ default: Page }));
    render(
      <Suspense fallback={<p>cargando</p>}>
        <LazyPage />
      </Suspense>,
    );

    expect(await screen.findByText("página")).toBeInTheDocument();
  });

  it("si Vite resuelve el módulo vacío (recarga en curso), espera en vez de romper", async () => {
    // Lo que pasa cuando main.tsx cancela vite:preloadError.
    const LazyPage = lazyPage(() => Promise.resolve(undefined as unknown as { default: typeof Page }));
    render(
      <Suspense fallback={<p>cargando</p>}>
        <LazyPage />
      </Suspense>,
    );

    await act(() => new Promise((r) => setTimeout(r, 20)));
    expect(screen.getByText("cargando")).toBeInTheDocument();
  });
});
