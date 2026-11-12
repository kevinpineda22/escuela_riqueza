import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import CreatePassword from "./CreatePassword";
import { completeRequiredPasswordChange } from "@/lib/api/auth";
import { ApiError } from "@/lib/api/client";
import { useAuthStore } from "@/stores/auth.store";
import type { User } from "@/types/user";

vi.mock("@/lib/api/auth", () => ({ completeRequiredPasswordChange: vi.fn() }));
vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({ user: useAuthStore.getState().user, signOut: vi.fn(() => Promise.resolve()) }),
}));

const change = completeRequiredPasswordChange as unknown as ReturnType<typeof vi.fn>;
const user: User = {
  id: "u1",
  email: "adrian@correo.com",
  fullName: "Adrian Hoyos",
  avatarUrl: null,
  role: "student",
  plan: "vip",
  createdAt: "2026-11-04T00:00:00Z",
  mustChangePassword: true,
};

function renderAt(path: string) {
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/crear-contrasena" element={<CreatePassword />} />
        <Route path="/dashboard" element={<p>Panel</p>} />
        <Route path="/vip-live" element={<p>Sala</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

function fill(password: string, confirm = password) {
  fireEvent.change(screen.getByLabelText("Nueva contraseña"), { target: { value: password } });
  fireEvent.change(screen.getByLabelText("Repite la contraseña"), { target: { value: confirm } });
  fireEvent.click(screen.getByRole("button", { name: /Guardar y entrar/ }));
}

describe("CreatePassword", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAuthStore.setState({ user, token: "t" });
  });

  it("saluda por el nombre", () => {
    renderAt("/crear-contrasena");
    expect(screen.getByRole("heading", { name: "Adrian, crea tu contraseña" })).toBeInTheDocument();
  });

  it("guarda, quita la marca y vuelve a donde iba", async () => {
    change.mockResolvedValue({ ...user, mustChangePassword: false });
    renderAt("/crear-contrasena?returnTo=%2Fvip-live");

    fill("MiClaveNueva2026");

    expect(await screen.findByText("Sala")).toBeInTheDocument();
    expect(change).toHaveBeenCalledWith("MiClaveNueva2026");
    expect(useAuthStore.getState().user?.mustChangePassword).toBe(false);
  });

  it("un returnTo hacia otro sitio cae en el panel", async () => {
    change.mockResolvedValue({ ...user, mustChangePassword: false });
    renderAt("/crear-contrasena?returnTo=%2F%2Fmalicioso.com");

    fill("MiClaveNueva2026");

    expect(await screen.findByText("Panel")).toBeInTheDocument();
  });

  it("las contraseñas tienen que coincidir", async () => {
    renderAt("/crear-contrasena");
    fill("MiClaveNueva2026", "OtraDistinta2026");
    expect(await screen.findByText("Las contraseñas no coinciden")).toBeInTheDocument();
    expect(change).not.toHaveBeenCalled();
  });

  it("si falla, lo dice y no deja pasar", async () => {
    change.mockRejectedValue(new ApiError("same_password", "La nueva contraseña debe ser distinta a la anterior.", 422));
    renderAt("/crear-contrasena");

    fill("Kp7r-Qm2x-Ht9b");

    expect(await screen.findByRole("alert")).toHaveTextContent("distinta a la anterior");
    await waitFor(() => expect(useAuthStore.getState().user?.mustChangePassword).toBe(true));
  });
});
