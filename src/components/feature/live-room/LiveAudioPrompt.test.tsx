import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { LiveAudioPrompt } from "./LiveAudioPrompt";

describe("LiveAudioPrompt (F01)", () => {
  it("activar sonido ejecuta una sola acción por toque (F02)", () => {
    const onEnable = vi.fn();
    render(<LiveAudioPrompt visible retryHint={false} onEnable={onEnable} onDismiss={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: /Activar sonido/ }));

    expect(onEnable).toHaveBeenCalledTimes(1);
  });

  it("permite seguir sin sonido", () => {
    const onDismiss = vi.fn();
    render(<LiveAudioPrompt visible retryHint={false} onEnable={vi.fn()} onDismiss={onDismiss} />);

    fireEvent.click(screen.getByRole("button", { name: "Seguir sin sonido" }));

    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it("avisa cuando el navegador rechazó el sonido", () => {
    render(<LiveAudioPrompt visible retryHint onEnable={vi.fn()} onDismiss={vi.fn()} />);
    expect(screen.getByRole("alert")).toHaveTextContent("No se pudo activar el sonido");
  });

  it("oculto no renderiza nada", () => {
    render(<LiveAudioPrompt visible={false} retryHint={false} onEnable={vi.fn()} onDismiss={vi.fn()} />);
    expect(screen.queryByRole("group")).not.toBeInTheDocument();
  });
});
