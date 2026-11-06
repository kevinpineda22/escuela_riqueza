import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import EmailConfirmed from "./EmailConfirmed";
import { verifyEmailLink } from "@/lib/api/auth";
import { supabase } from "@/lib/supabase";

vi.mock("@/lib/api/auth", () => ({ verifyEmailLink: vi.fn() }));
vi.mock("@/lib/supabase", () => ({ supabase: { auth: { getSession: vi.fn() } } }));
vi.mock("@/hooks/usePlatformSettings", () => ({ usePlatformSettings: () => ({ data: null }) }));
vi.mock("@/components/layout/BrandLogo", () => ({ default: () => null }));

const verify = verifyEmailLink as unknown as ReturnType<typeof vi.fn>;

function renderAt(path: string) {
  render(
    <MemoryRouter initialEntries={[path]}>
      <EmailConfirmed />
    </MemoryRouter>,
  );
}

describe("EmailConfirmed — link con token_hash", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (supabase.auth.getSession as ReturnType<typeof vi.fn>).mockResolvedValue({ data: { session: null }, error: null });
  });

  it("abrir el link no confirma nada: espera el toque", () => {
    renderAt("/cuenta-verificada?token_hash=abc&type=email");

    expect(screen.getByRole("button", { name: /Confirmar mi correo/ })).toBeInTheDocument();
    expect(verify).not.toHaveBeenCalled();
  });

  it("al tocar, confirma el correo", async () => {
    verify.mockResolvedValue(undefined);
    renderAt("/cuenta-verificada?token_hash=abc&type=email");

    fireEvent.click(screen.getByRole("button", { name: /Confirmar mi correo/ }));

    expect(verify).toHaveBeenCalledWith("abc", "email");
    expect(await screen.findByRole("heading", { name: "¡Bienvenido a la Escuela!" })).toBeInTheDocument();
  });

  it("un link vencido lo explica", async () => {
    verify.mockRejectedValue(new Error("vencido"));
    renderAt("/cuenta-verificada?token_hash=viejo&type=email");

    fireEvent.click(screen.getByRole("button", { name: /Confirmar mi correo/ }));

    expect(await screen.findByText(/expiró o ya fue utilizado/)).toBeInTheDocument();
  });
});
