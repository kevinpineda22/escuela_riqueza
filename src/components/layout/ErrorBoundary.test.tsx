import { describe, expect, it, vi, beforeAll, afterAll } from "vitest";
import { useState } from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import ErrorBoundary from "@/components/layout/ErrorBoundary";

const Bomb = ({ shouldThrow }: { shouldThrow: boolean }) => {
  if (shouldThrow) throw new Error("Boom! algo se rompió");
  return <div>todo bien</div>;
};

const Toggleable = () => {
  const [explode, setExplode] = useState(true);
  return (
    <ErrorBoundary
      fallback={(_err, reset) => (
        <button
          type="button"
          onClick={() => {
            setExplode(false);
            reset();
          }}
        >
          recover
        </button>
      )}
    >
      <Bomb shouldThrow={explode} />
    </ErrorBoundary>
  );
};

describe("ErrorBoundary", () => {
  // React logs errors caught by boundaries to console.error — silenciamos para que el output del test quede limpio
  let spy: ReturnType<typeof vi.spyOn>;
  beforeAll(() => {
    spy = vi.spyOn(console, "error").mockImplementation(() => {});
  });
  afterAll(() => {
    spy.mockRestore();
  });

  it("renderiza children cuando no hay error", () => {
    render(
      <ErrorBoundary>
        <Bomb shouldThrow={false} />
      </ErrorBoundary>,
    );
    expect(screen.getByText("todo bien")).toBeInTheDocument();
  });

  it("muestra fallback default cuando un hijo lanza", () => {
    render(
      <ErrorBoundary>
        <Bomb shouldThrow />
      </ErrorBoundary>,
    );
    expect(screen.getByText(/ocurrió un error inesperado/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /intentar de nuevo/i })).toBeInTheDocument();
  });

  it("usa fallback custom cuando se provee", () => {
    render(
      <ErrorBoundary fallback={(err) => <p>custom: {err.message}</p>}>
        <Bomb shouldThrow />
      </ErrorBoundary>,
    );
    expect(screen.getByText(/custom: boom! algo se rompió/i)).toBeInTheDocument();
  });

  it("reset reintenta el render y limpia el estado de error", () => {
    render(<Toggleable />);
    fireEvent.click(screen.getByRole("button", { name: "recover" }));
    expect(screen.getByText("todo bien")).toBeInTheDocument();
  });
});
