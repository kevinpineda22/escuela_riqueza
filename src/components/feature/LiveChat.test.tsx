import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import LiveChat from "./LiveChat";
import { supabase } from "@/lib/supabase";
import { useAuthStore } from "@/stores/auth.store";
import type { User } from "@/types/user";

const channel = { on: vi.fn(), subscribe: vi.fn() };
const insert = vi.fn();

vi.mock("@/lib/supabase", () => ({
  supabase: {
    auth: { getSession: vi.fn() },
    from: vi.fn(),
    channel: vi.fn(() => channel),
    removeChannel: vi.fn(),
  },
}));

const from = supabase.from as unknown as ReturnType<typeof vi.fn>;
const student = { id: "user-1", fullName: "Alumno" } as User;

async function renderChat() {
  render(<LiveChat liveId="live-1" showWelcome={false} />);
  // Esperar a que termine la carga del historial (skeleton → lista).
  const input = await screen.findByLabelText("Mensaje para la comunidad");
  return input as HTMLInputElement;
}

function send(input: HTMLInputElement, text: string) {
  fireEvent.change(input, { target: { value: text } });
  fireEvent.submit(input.closest("form")!);
}

describe("LiveChat — envío (F22)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    channel.on.mockReturnValue(channel);
    channel.subscribe.mockReturnValue(channel);
    (supabase.auth.getSession as ReturnType<typeof vi.fn>).mockResolvedValue({ data: { session: null } });
    // Historial vacío; `insert` es lo que cada test controla.
    from.mockReturnValue({
      select: () => ({ eq: () => ({ order: () => Promise.resolve({ data: [], error: null }) }) }),
      insert,
    });
    useAuthStore.setState({ user: student, token: "t" });
  });

  it("conserva el texto y avisa cuando el envío falla", async () => {
    insert.mockResolvedValue({ error: { message: "permission denied" } });
    const input = await renderChat();

    send(input, "Hola a todos");

    expect(await screen.findByRole("alert")).toHaveTextContent("No se pudo enviar tu mensaje");
    expect(input.value).toBe("Hola a todos");
  });

  it("conserva el texto cuando la red falla y el insert lanza", async () => {
    insert.mockRejectedValue(new TypeError("Failed to fetch"));
    const input = await renderChat();

    send(input, "Hola a todos");

    expect(await screen.findByRole("alert")).toBeInTheDocument();
    expect(input.value).toBe("Hola a todos");
  });

  it("limpia el campo solo cuando Supabase confirma el envío", async () => {
    insert.mockResolvedValue({ error: null });
    const input = await renderChat();

    send(input, "Hola a todos");

    await waitFor(() => expect(input.value).toBe(""));
    expect(insert).toHaveBeenCalledWith({ live_id: "live-1", user_id: "user-1", content: "Hola a todos" });
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("no envía dos veces mientras el primer envío está pendiente", async () => {
    let resolveInsert: (value: { error: null }) => void = () => {};
    insert.mockReturnValue(new Promise((resolve) => { resolveInsert = resolve; }));
    const input = await renderChat();

    send(input, "Hola a todos");
    fireEvent.submit(input.closest("form")!);
    resolveInsert({ error: null });

    await waitFor(() => expect(input.value).toBe(""));
    expect(insert).toHaveBeenCalledTimes(1);
  });

  it("al volver a escribir se retira el aviso de error", async () => {
    insert.mockResolvedValue({ error: { message: "boom" } });
    const input = await renderChat();

    send(input, "Hola");
    await screen.findByRole("alert");
    fireEvent.change(input, { target: { value: "Hola de nuevo" } });

    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});

describe("LiveChat — teclado (F15)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    channel.on.mockReturnValue(channel);
    channel.subscribe.mockReturnValue(channel);
    (supabase.auth.getSession as ReturnType<typeof vi.fn>).mockResolvedValue({ data: { session: null } });
    from.mockReturnValue({
      select: () => ({ eq: () => ({ order: () => Promise.resolve({ data: [], error: null }) }) }),
      insert,
    });
    useAuthStore.setState({ user: student, token: "t" });
  });

  it("Enter que confirma una composición IME no envía", async () => {
    const input = await renderChat();
    fireEvent.change(input, { target: { value: "canción" } });

    const notPrevented = fireEvent.keyDown(input, { key: "Enter", isComposing: true });

    expect(notPrevented).toBe(false);
  });

  it("Enter normal sigue su curso (envía el formulario)", async () => {
    const input = await renderChat();
    fireEvent.change(input, { target: { value: "hola" } });

    const notPrevented = fireEvent.keyDown(input, { key: "Enter" });

    expect(notPrevented).toBe(true);
  });

  it("el teclado virtual ofrece la acción de enviar", async () => {
    const input = await renderChat();
    expect(input).toHaveAttribute("enterkeyhint", "send");
  });
});
