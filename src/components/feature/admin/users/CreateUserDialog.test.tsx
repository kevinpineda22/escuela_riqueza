import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { CreateUserDialog } from "./CreateUserDialog";
import { createAdminUser, type AdminUser } from "@/lib/api/admin/users";
import { ApiError } from "@/lib/api/client";

vi.mock("@/lib/api/admin/users", () => ({ createAdminUser: vi.fn() }));

const create = createAdminUser as unknown as ReturnType<typeof vi.fn>;

const created: AdminUser = {
  id: "u1",
  full_name: "Liliana Fernandez",
  email: "lilianafernandez@escuelariqueza.com",
  role: "admin",
  plan: "vip",
  status: "active",
  created_at: "2026-11-06T00:00:00Z",
  updated_at: "2026-11-06T00:00:00Z",
};

function renderDialog(onCreated = vi.fn()) {
  render(<CreateUserDialog open onOpenChange={vi.fn()} onCreated={onCreated} />);
  return onCreated;
}

function fill(name: string, email: string) {
  fireEvent.change(screen.getByLabelText("Nombre completo"), { target: { value: name } });
  fireEvent.change(screen.getByLabelText("Correo"), { target: { value: email } });
}

describe("CreateUserDialog", () => {
  beforeEach(() => vi.clearAllMocks());

  it("arranca en VIP, estudiante y con el correo de acceso marcado", () => {
    renderDialog();
    expect(screen.getByRole("radio", { name: /VIP/ })).toBeChecked();
    expect(screen.getByRole("radio", { name: /Estudiante/ })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: /Enviar el correo de acceso/ })).toBeChecked();
  });

  it("no llama al servidor con un correo mal escrito", () => {
    renderDialog();
    fill("Ana Pérez", "ana@correo");
    fireEvent.click(screen.getByRole("button", { name: "Crear usuario" }));

    expect(screen.getByRole("alert")).toHaveTextContent("no parece válido");
    expect(create).not.toHaveBeenCalled();
  });

  it("crea la cuenta y muestra la contraseña temporal para copiarla", async () => {
    create.mockResolvedValue({ user: created, tempPassword: "Ab3d-EfGh-2jKm", emailSent: true });
    const onCreated = renderDialog();

    fill("  Liliana Fernandez ", " LilianaFernandez@EscuelaRiqueza.com ");
    fireEvent.click(screen.getByRole("radio", { name: /Administrador/ }));
    fireEvent.click(screen.getByRole("button", { name: "Crear usuario" }));

    await waitFor(() => expect(screen.getByText("Ab3d-EfGh-2jKm")).toBeInTheDocument());
    expect(create).toHaveBeenCalledWith({
      fullName: "Liliana Fernandez",
      email: "lilianafernandez@escuelariqueza.com",
      plan: "vip",
      role: "admin",
      sendEmail: true,
    });
    expect(onCreated).toHaveBeenCalledWith(created);
    expect(screen.getByText(/Enviamos el correo de acceso/)).toBeInTheDocument();
  });

  it("si el correo no salió, lo dice y deja la contraseña a la vista", async () => {
    create.mockResolvedValue({
      user: created, tempPassword: "Ab3d-EfGh-2jKm", emailSent: false, emailError: "dominio no verificado",
    });
    renderDialog();

    fill("Ana Pérez", "ana@correo.com");
    fireEvent.click(screen.getByRole("button", { name: "Crear usuario" }));

    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("dominio no verificado"));
    expect(screen.getByText("Ab3d-EfGh-2jKm")).toBeInTheDocument();
  });

  it("muestra el error del servidor (ej. correo ya registrado) sin perder el formulario", async () => {
    create.mockRejectedValue(new ApiError("admin_users", "Ya existe una cuenta con ese correo", 409));
    renderDialog();

    fill("Ana Pérez", "ana@correo.com");
    fireEvent.click(screen.getByRole("button", { name: "Crear usuario" }));

    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("Ya existe una cuenta con ese correo"));
    expect(screen.getByLabelText("Correo")).toHaveValue("ana@correo.com");
  });
});
