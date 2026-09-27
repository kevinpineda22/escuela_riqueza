import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { QuotedMessage } from "./QuotedMessage";

describe("QuotedMessage", () => {
  it("muestra el nombre del autor y el extracto", () => {
    render(<QuotedMessage userName="Beto" excerpt="Hola a todos" />);

    expect(screen.getByText("Beto")).toBeInTheDocument();
    expect(screen.getByText("Hola a todos")).toBeInTheDocument();
  });

  it("muestra 'Mensaje eliminado' cuando el extracto es null", () => {
    render(<QuotedMessage userName="Beto" excerpt={null} />);

    expect(screen.getByText("Mensaje eliminado")).toBeInTheDocument();
    expect(screen.getByText("Beto")).toBeInTheDocument();
  });

  it("no es interactivo cuando no se pasa onJumpToOriginal", () => {
    render(<QuotedMessage userName="Beto" excerpt="Hola" />);

    expect(screen.queryByRole("button", { name: "Ir al mensaje original" })).not.toBeInTheDocument();
  });

  it("es un botón cuando el original está cargado, y el click no burbujea", () => {
    const onJumpToOriginal = vi.fn();
    const onBubbleClick = vi.fn();

    render(
      // Simula la burbuja que envuelve la cita en LiveChat/PublicLiveChat.
      <div onClick={onBubbleClick}>
        <QuotedMessage userName="Beto" excerpt="Hola" onJumpToOriginal={onJumpToOriginal} />
      </div>
    );

    fireEvent.click(screen.getByRole("button", { name: "Ir al mensaje original" }));

    expect(onJumpToOriginal).toHaveBeenCalledTimes(1);
    expect(onBubbleClick).not.toHaveBeenCalled();
  });
});
