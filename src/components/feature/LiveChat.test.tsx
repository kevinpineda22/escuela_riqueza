import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
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
      select: () => ({ eq: () => ({ order: () => ({ limit: () => Promise.resolve({ data: [], error: null }) }) }) }),
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
    expect(insert).toHaveBeenCalledWith({
      id: expect.any(String),
      live_id: "live-1",
      user_id: "user-1",
      content: "Hola a todos",
    });
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
      select: () => ({ eq: () => ({ order: () => ({ limit: () => Promise.resolve({ data: [], error: null }) }) }) }),
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

describe("LiveChat — reintento sin duplicados (F22)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    channel.on.mockReturnValue(channel);
    channel.subscribe.mockReturnValue(channel);
    (supabase.auth.getSession as ReturnType<typeof vi.fn>).mockResolvedValue({ data: { session: null } });
    from.mockReturnValue({
      select: () => ({ eq: () => ({ order: () => ({ limit: () => Promise.resolve({ data: [], error: null }) }) }) }),
      insert,
    });
    useAuthStore.setState({ user: student, token: "t" });
  });

  const sentIds = () => insert.mock.calls.map((call) => (call[0] as { id: string }).id);

  it("reintentar el mismo texto reusa el id del intento fallido", async () => {
    insert.mockRejectedValueOnce(new TypeError("Failed to fetch")).mockResolvedValueOnce({ error: null });
    const input = await renderChat();

    send(input, "Hola");
    await screen.findByRole("alert");
    fireEvent.submit(input.closest("form")!);

    await waitFor(() => expect(input.value).toBe(""));
    const [first, second] = sentIds();
    // Sin id, `undefined === undefined` pasaría: exigir que exista.
    expect(first).toEqual(expect.any(String));
    expect(second).toBe(first);
  });

  it("si el intento anterior sí llegó (clave duplicada), cuenta como enviado", async () => {
    // Se perdió la respuesta del primero, pero la fila existe: el reintento choca.
    insert
      .mockRejectedValueOnce(new TypeError("Failed to fetch"))
      .mockResolvedValueOnce({ error: { code: "23505", message: "duplicate key value" } });
    const input = await renderChat();

    send(input, "Hola");
    await screen.findByRole("alert");
    fireEvent.submit(input.closest("form")!);

    await waitFor(() => expect(input.value).toBe(""));
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("otro texto después de un fallo es otro mensaje: id nuevo", async () => {
    insert.mockResolvedValueOnce({ error: { message: "boom" } }).mockResolvedValueOnce({ error: null });
    const input = await renderChat();

    send(input, "Hola");
    await screen.findByRole("alert");
    send(input, "Hola, ¿se escucha?");

    await waitFor(() => expect(insert).toHaveBeenCalledTimes(2));
    const [first, second] = sentIds();
    expect(second).not.toBe(first);
  });

  it("después de un envío exitoso, el siguiente mensaje lleva id nuevo aunque repita el texto", async () => {
    insert.mockResolvedValue({ error: null });
    const input = await renderChat();

    send(input, "Sí");
    await waitFor(() => expect(input.value).toBe(""));
    send(input, "Sí");
    await waitFor(() => expect(insert).toHaveBeenCalledTimes(2));

    const [first, second] = sentIds();
    expect(second).not.toBe(first);
  });
});

describe("LiveChat — historial, Realtime y conexión (F20, F23, F38)", () => {
  type Row = { id: string; content: string; created_at: string; user_id: string };
  let resolveHistory: (value: { data: Row[] | null; error: unknown }) => void = () => {};
  const profilesIn = vi.fn();
  const profilesEq = vi.fn();

  // Realtime: el handler de INSERT y el callback de estado que registra el chat.
  const insertHandler = () => channel.on.mock.calls[0][2] as (payload: { new: Row }) => Promise<void>;
  const statusCallback = () => channel.subscribe.mock.calls[0][0] as (status: string) => void;

  beforeEach(() => {
    vi.clearAllMocks();
    channel.on.mockReturnValue(channel);
    channel.subscribe.mockReturnValue(channel);
    (supabase.auth.getSession as ReturnType<typeof vi.fn>).mockResolvedValue({ data: { session: null } });
    profilesIn.mockResolvedValue({ data: [{ id: "ana", full_name: "Ana" }] });
    profilesEq.mockReturnValue({ maybeSingle: () => Promise.resolve({ data: { full_name: "Beto" } }) });
    from.mockImplementation((table: string) =>
      table === "profiles"
        ? { select: () => ({ in: profilesIn, eq: profilesEq }) }
        : {
            select: () => ({
              eq: () => ({
                order: () => ({
                  limit: () => new Promise((resolve) => { resolveHistory = resolve; }),
                }),
              }),
            }),
            insert,
          }
    );
    useAuthStore.setState({ user: student, token: "t" });
  });

  const row = (id: string, user_id: string, content: string, created_at: string): Row => ({ id, user_id, content, created_at });

  it("un mensaje que llega por Realtime mientras carga el historial no se pierde", async () => {
    render(<LiveChat liveId="live-1" showWelcome={false} />);
    await waitFor(() => expect(channel.on).toHaveBeenCalled());

    // Llega un mensaje nuevo ANTES de que responda el historial.
    await act(async () => {
      await insertHandler()({ new: row("m3", "beto", "llegué", "2026-09-25T10:03:00Z") });
    });
    // El historial viene DESC (los más nuevos primero).
    await act(async () => {
      resolveHistory({
        data: [row("m2", "ana", "segundo", "2026-09-25T10:02:00Z"), row("m1", "ana", "primero", "2026-09-25T10:01:00Z")],
        error: null,
      });
    });

    const texts = (await screen.findAllByText(/primero|segundo|llegué/)).map((el) => el.textContent);
    expect(texts).toEqual(["primero", "segundo", "llegué"]);
  });

  it("no consulta el perfil de alguien que ya habló (F38)", async () => {
    render(<LiveChat liveId="live-1" showWelcome={false} />);
    await waitFor(() => expect(channel.on).toHaveBeenCalled());
    await act(async () => {
      resolveHistory({ data: [row("m1", "ana", "hola", "2026-09-25T10:01:00Z")], error: null });
    });
    await screen.findByText("hola");

    await act(async () => {
      await insertHandler()({ new: row("m2", "ana", "otra vez yo", "2026-09-25T10:02:00Z") });
    });

    expect(await screen.findByText("otra vez yo")).toBeInTheDocument();
    expect(profilesEq).not.toHaveBeenCalled();
  });

  it("si el historial no carga, lo dice en vez de mostrar un chat vacío (F23)", async () => {
    render(<LiveChat liveId="live-1" showWelcome={false} />);
    await waitFor(() => expect(channel.on).toHaveBeenCalled());
    await act(async () => {
      resolveHistory({ data: null, error: { message: "boom" } });
    });

    expect(await screen.findByText(/No pudimos cargar los mensajes anteriores/)).toBeInTheDocument();
  });

  it("el indicador de conexión refleja la suscripción real (F23)", async () => {
    render(<LiveChat liveId="live-1" showWelcome={false} />);
    await waitFor(() => expect(channel.subscribe).toHaveBeenCalled());
    expect(screen.getByRole("status")).toHaveTextContent("Conectando…");

    act(() => statusCallback()("SUBSCRIBED"));
    expect(screen.getByRole("status")).toHaveTextContent("Chat en tiempo real");

    act(() => statusCallback()("CHANNEL_ERROR"));
    expect(screen.getByRole("status")).toHaveTextContent("Reconectando…");
  });
});
