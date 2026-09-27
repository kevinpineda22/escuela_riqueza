import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ReplyComposerPreview } from "./ReplyComposerPreview";

describe("ReplyComposerPreview", () => {
  it("muestra a quién se responde y el extracto", () => {
    render(<ReplyComposerPreview target={{ id: "m1", userName: "Beto", excerpt: "Hola a todos" }} onCancel={vi.fn()} />);

    expect(screen.getByText("Respondiendo a Beto")).toBeInTheDocument();
    expect(screen.getByText("Hola a todos")).toBeInTheDocument();
  });

  it("el botón X cancela la respuesta", () => {
    const onCancel = vi.fn();
    render(<ReplyComposerPreview target={{ id: "m1", userName: "Beto", excerpt: "Hola" }} onCancel={onCancel} />);

    fireEvent.click(screen.getByRole("button", { name: "Cancelar respuesta" }));

    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});
