import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { EditUserForm } from "./EditUserForm";
import { diffUser } from "./diffUser";
import type { AdminUser } from "@/lib/api/admin/users";

const user: AdminUser = {
  id: "u1",
  full_name: "Carlos Giraldo",
  email: "carlos.giraldoc4@gmail.com",
  role: "student",
  plan: "free",
  status: "active",
  created_at: "2026-10-01T00:00:00Z",
  updated_at: "2026-10-01T00:00:00Z",
};

describe("diffUser", () => {
  it("solo manda lo que cambió", () => {
    expect(
      diffUser(user, { fullName: "Carlos Giraldo", email: "carlos.giraldoc4@gmail.com", role: "student", plan: "vip" }),
    ).toEqual({ plan: "vip" });
  });

  it("un correo igual con otras mayúsculas o espacios no cuenta como cambio", () => {
    expect(
      diffUser(user, { fullName: " Carlos Giraldo ", email: " Carlos.GiraldoC4@gmail.com", role: "student", plan: "free" }),
    ).toEqual({});
  });

  it("normaliza el correo nuevo", () => {
    expect(
      diffUser(user, { fullName: "Carlos Giraldo", email: " Nuevo@Correo.com ", role: "student", plan: "free" }),
    ).toEqual({ email: "nuevo@correo.com" });
  });
});

describe("EditUserForm", () => {
  it("un admin no puede cambiarse su propio rol", () => {
    render(<EditUserForm user={{ ...user, role: "admin" }} currentUserId="u1" onSaved={() => {}} onCancel={() => {}} />);
    expect(screen.getByRole("radio", { name: /Estudiante/ })).toBeDisabled();
    expect(screen.getByText("No puedes cambiar tu propio rol.")).toBeInTheDocument();
  });
});
