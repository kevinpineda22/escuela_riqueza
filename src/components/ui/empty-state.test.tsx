import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { Inbox } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";

describe("EmptyState", () => {
  it("renders title and icon", () => {
    render(<EmptyState icon={Inbox} title="Sin resultados" />);
    expect(screen.getByText("Sin resultados")).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 3 })).toBeInTheDocument();
  });

  it("renders description when provided", () => {
    render(
      <EmptyState
        icon={Inbox}
        title="Vacío"
        description="No hay nada por aquí todavía"
      />,
    );
    expect(
      screen.getByText("No hay nada por aquí todavía"),
    ).toBeInTheDocument();
  });

  it("does not render description container when not provided", () => {
    render(<EmptyState icon={Inbox} title="Vacío" />);
    expect(screen.queryByText(/no hay nada/i)).not.toBeInTheDocument();
  });

  it("renders an action when passed", () => {
    render(
      <EmptyState
        icon={Inbox}
        title="Vacío"
        action={<button type="button">Crear</button>}
      />,
    );
    expect(screen.getByRole("button", { name: "Crear" })).toBeInTheDocument();
  });

  it("forwards className to root", () => {
    const { container } = render(
      <EmptyState icon={Inbox} title="Vacío" className="my-custom-class" />,
    );
    const root = container.firstElementChild as HTMLElement;
    expect(root.className).toMatch(/my-custom-class/);
  });
});
