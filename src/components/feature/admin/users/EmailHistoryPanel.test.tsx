import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { EmailHistoryPanel } from "./EmailHistoryPanel";
import { fetchEmailBlock, fetchUserEmails, removeEmailBlock, type EmailDelivery } from "@/lib/api/admin/emails";

vi.mock("@/lib/api/admin/emails", () => ({
  fetchEmailBlock: vi.fn(),
  fetchUserEmails: vi.fn(),
  removeEmailBlock: vi.fn(),
}));
vi.mock("@/components/ui/toaster", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const emails = fetchUserEmails as unknown as Mock;
const block = fetchEmailBlock as unknown as Mock;
const unblock = removeEmailBlock as unknown as Mock;

const EMAIL = "wilforati@gmail.com";
const delivery = (over: Partial<EmailDelivery> = {}): EmailDelivery => ({
  email_id: "e1",
  recipient: EMAIL,
  subject: "Tu acceso a la Escuela de la Riqueza",
  status: "bounced",
  sent_at: "2026-11-06T19:08:00Z",
  status_at: "2026-11-06T19:08:30Z",
  bounce_type: "Permanent",
  bounce_subtype: "General",
  detail: "550 5.1.1 The email account does not exist",
  ...over,
});

const renderPanel = (email = EMAIL) => render(<EmailHistoryPanel userId="u1" email={email} reloadKey={0} />);

describe("EmailHistoryPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    block.mockResolvedValue({ email: EMAIL, blocked: false });
  });

  it("muestra el historial y el problema del correo actual con qué hacer", async () => {
    emails.mockResolvedValue([delivery()]);
    renderPanel();

    expect(await screen.findByText("Pídele a la persona su correo correcto y corrígelo en su ficha.")).toBeInTheDocument();
    expect(screen.getByText("Tu acceso a la Escuela de la Riqueza")).toBeInTheDocument();
    expect(screen.getByText("Rebotó")).toBeInTheDocument();
  });

  it("un rebote de la dirección anterior ya no pide acción", async () => {
    emails.mockResolvedValue([delivery()]);
    renderPanel("corregido@gmail.com");

    await screen.findByText("Rebotó");
    expect(screen.queryByText("Pídele a la persona su correo correcto y corrígelo en su ficha.")).not.toBeInTheDocument();
  });

  it("solo ofrece quitar el bloqueo si la dirección está bloqueada", async () => {
    emails.mockResolvedValue([delivery()]);
    renderPanel();

    await screen.findByText("Rebotó");
    expect(screen.queryByRole("button", { name: /Quitar bloqueo/ })).not.toBeInTheDocument();
  });

  it("quita el bloqueo tras confirmar y recarga", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    emails.mockResolvedValue([delivery()]);
    block.mockResolvedValue({ email: EMAIL, blocked: true });
    unblock.mockResolvedValue(undefined);
    renderPanel();

    fireEvent.click(await screen.findByRole("button", { name: /Quitar bloqueo/ }));

    await waitFor(() => expect(unblock).toHaveBeenCalledWith("u1"));
    await waitFor(() => expect(emails).toHaveBeenCalledTimes(2));
  });

  it("si no se puede saber el bloqueo, el historial igual aparece", async () => {
    emails.mockResolvedValue([delivery()]);
    block.mockRejectedValue(new Error("403"));
    renderPanel();

    expect(await screen.findByText("No se pudo comprobar si la dirección está bloqueada.")).toBeInTheDocument();
  });

  it("avisa si no pudo cargar, sin decir que no hay correos", async () => {
    emails.mockRejectedValue(new Error("no existe el RPC"));
    renderPanel();

    expect(await screen.findByRole("alert")).toHaveTextContent("No se pudo cargar");
    expect(screen.queryByText(/Todavía no hay correos/)).not.toBeInTheDocument();
  });
});
