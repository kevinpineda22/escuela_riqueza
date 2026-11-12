import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import ResetPassword from "./ResetPassword";
import { verifyEmailLink } from "@/lib/api/auth";
import { supabase } from "@/lib/supabase";

vi.mock("@/lib/api/auth", () => ({ updatePassword: vi.fn(), verifyEmailLink: vi.fn() }));
vi.mock("@/lib/supabase", () => ({
  supabase: {
    auth: {
      getSession: vi.fn(),
      onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
      signOut: vi.fn(),
    },
  },
}));

const verify = verifyEmailLink as unknown as ReturnType<typeof vi.fn>;

function renderAt(path: string) {
  render(
    <MemoryRouter initialEntries={[path]}>
      <ResetPassword />
    </MemoryRouter>,
  );
}

describe("ResetPassword — link con token_hash", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (supabase.auth.getSession as ReturnType<typeof vi.fn>).mockResolvedValue({ data: { session: null } });
  });

  it("abrir el link no gasta el token: espera el toque", async () => {
    renderAt("/restablecer-contrasena?token_hash=abc&type=recovery");

    expect(await screen.findByRole("button", { name: /Continuar/ })).toBeInTheDocument();
    expect(verify).not.toHaveBeenCalled();
    // Sin sesión todavía, igual no dice "expiró".
    expect(screen.queryByText(/expiró o ya fue utilizado/)).not.toBeInTheDocument();
  });

  it("al tocar Continuar, verifica y muestra el formulario", async () => {
    verify.mockResolvedValue(undefined);
    renderAt("/restablecer-contrasena?token_hash=abc&type=recovery");

    fireEvent.click(await screen.findByRole("button", { name: /Continuar/ }));

    expect(await screen.findByLabelText("Nueva contraseña")).toBeInTheDocument();
    expect(verify).toHaveBeenCalledWith("abc", "recovery");
  });

  it("un token vencido ofrece pedir otro", async () => {
    verify.mockRejectedValue(new Error("vencido"));
    renderAt("/restablecer-contrasena?token_hash=viejo&type=recovery");

    fireEvent.click(await screen.findByRole("button", { name: /Continuar/ }));

    expect(await screen.findByText(/expiró o ya fue utilizado/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Solicitar un enlace nuevo" })).toBeInTheDocument();
  });

  it("los links viejos (sin token_hash) siguen funcionando como antes", async () => {
    (supabase.auth.getSession as ReturnType<typeof vi.fn>).mockResolvedValue({ data: { session: { user: { id: "u1" } } } });
    renderAt("/restablecer-contrasena");

    expect(await screen.findByLabelText("Nueva contraseña")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Continuar/ })).not.toBeInTheDocument();
  });
});
