import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import RequireAuth, { CREATE_PASSWORD_PATH } from "./RequireAuth";
import type { User } from "@/types/user";

let mockUser: User | null = null;
vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({ user: mockUser, isAuthenticated: Boolean(mockUser) }),
}));

const student = (extra: Partial<User> = {}): User => ({
  id: "u1",
  email: "alumno@escuela.com",
  fullName: "Alumno",
  avatarUrl: null,
  role: "student",
  plan: "vip",
  createdAt: "2026-11-04T00:00:00Z",
  ...extra,
});

function WhereAmI() {
  const location = useLocation();
  return <p>en {location.pathname}{location.search}</p>;
}

function renderAt(path: string) {
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/dashboard" element={<RequireAuth><p>Panel</p></RequireAuth>} />
        <Route path={CREATE_PASSWORD_PATH} element={<RequireAuth><p>Crear contraseña</p></RequireAuth>} />
        <Route path="*" element={<WhereAmI />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("RequireAuth — contraseña temporal", () => {
  it("con contraseña temporal, antes de cualquier pantalla pide crear la propia", () => {
    mockUser = student({ mustChangePassword: true });
    renderAt("/dashboard");
    expect(screen.getByText("Crear contraseña")).toBeInTheDocument();
    expect(screen.queryByText("Panel")).not.toBeInTheDocument();
  });

  it("la pantalla de crear contraseña no se redirige a sí misma", () => {
    mockUser = student({ mustChangePassword: true });
    renderAt(CREATE_PASSWORD_PATH);
    expect(screen.getByText("Crear contraseña")).toBeInTheDocument();
  });

  it("sin la marca, entra normal", () => {
    mockUser = student({ mustChangePassword: false });
    renderAt("/dashboard");
    expect(screen.getByText("Panel")).toBeInTheDocument();
  });

  it("sesiones guardadas antes de la marca (undefined) entran normal", () => {
    mockUser = student();
    renderAt("/dashboard");
    expect(screen.getByText("Panel")).toBeInTheDocument();
  });
});
