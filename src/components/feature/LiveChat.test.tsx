import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, act, within } from "@testing-library/react";
import LiveChat from "./LiveChat";
import { supabase } from "@/lib/supabase";
import { useAuthStore } from "@/stores/auth.store";
import type { User } from "@/types/user";

// LiveChat.tsx se suscribe al canal de mensajes; useLiveReactions (hook
// aparte, ver useLiveReactions.ts) se suscribe a su PROPIO canal
// `live_reactions_${liveId}`. `supabase.channel` devuelve uno u otro según
// el nombre pedido, así los tests distinguen ambos sin depender del orden en
// que React corre los efectos de cada hook.
const messagesChannel = { on: vi.fn(), subscribe: vi.fn() };
const reactionsChannel = { on: vi.fn(), subscribe: vi.fn() };
const insert = vi.fn();

function setupChannelChaining() {
  messagesChannel.on.mockReturnValue(messagesChannel);
  messagesChannel.subscribe.mockReturnValue(messagesChannel);
  reactionsChannel.on.mockReturnValue(reactionsChannel);
  reactionsChannel.subscribe.mockReturnValue(reactionsChannel);
}

vi.mock("@/lib/supabase", () => ({
  supabase: {
    auth: { getSession: vi.fn() },
    from: vi.fn(),
    channel: vi.fn((name: string) => (name.startsWith("live_reactions_") ? reactionsChannel : messagesChannel)),
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
    setupChannelChaining();
    (supabase.auth.getSession as ReturnType<typeof vi.fn>).mockResolvedValue({ data: { session: null } });
    // Historial vacío; `insert` es lo que cada test controla.
    // La forma genérica cubre las dos consultas del montaje: el historial de
    // mensajes (`eq().order().limit()`) y, apenas termina de cargar, el
    // snapshot de reacciones del hook (`eq().in()`).
    from.mockReturnValue({
      select: () => ({
        eq: () => ({
          order: () => ({ limit: () => Promise.resolve({ data: [], error: null }) }),
          in: () => Promise.resolve({ data: [], error: null }),
        }),
      }),
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
      reply_to_id: null,
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
    setupChannelChaining();
    (supabase.auth.getSession as ReturnType<typeof vi.fn>).mockResolvedValue({ data: { session: null } });
    // La forma genérica cubre las dos consultas del montaje: el historial de
    // mensajes (`eq().order().limit()`) y, apenas termina de cargar, el
    // snapshot de reacciones del hook (`eq().in()`).
    from.mockReturnValue({
      select: () => ({
        eq: () => ({
          order: () => ({ limit: () => Promise.resolve({ data: [], error: null }) }),
          in: () => Promise.resolve({ data: [], error: null }),
        }),
      }),
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
    setupChannelChaining();
    (supabase.auth.getSession as ReturnType<typeof vi.fn>).mockResolvedValue({ data: { session: null } });
    // La forma genérica cubre las dos consultas del montaje: el historial de
    // mensajes (`eq().order().limit()`) y, apenas termina de cargar, el
    // snapshot de reacciones del hook (`eq().in()`).
    from.mockReturnValue({
      select: () => ({
        eq: () => ({
          order: () => ({ limit: () => Promise.resolve({ data: [], error: null }) }),
          in: () => Promise.resolve({ data: [], error: null }),
        }),
      }),
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
  // El canal de mensajes solo registra este único handler (las reacciones
  // viven en su propio canal, ver useLiveReactions.ts), así que el índice 0
  // es estable.
  const insertHandler = () => messagesChannel.on.mock.calls[0][2] as (payload: { new: Row }) => Promise<void>;
  const statusCallback = () => messagesChannel.subscribe.mock.calls[0][0] as (status: string) => void;

  beforeEach(() => {
    vi.clearAllMocks();
    setupChannelChaining();
    (supabase.auth.getSession as ReturnType<typeof vi.fn>).mockResolvedValue({ data: { session: null } });
    profilesIn.mockResolvedValue({ data: [{ id: "ana", full_name: "Ana" }] });
    profilesEq.mockReturnValue({ maybeSingle: () => Promise.resolve({ data: { full_name: "Beto" } }) });
    from.mockImplementation((table: string) => {
      if (table === "profiles") return { select: () => ({ in: profilesIn, eq: profilesEq }) };
      if (table === "live_message_reactions") {
        return { select: () => ({ eq: () => ({ in: () => Promise.resolve({ data: [], error: null }) }) }) };
      }
      return {
        select: () => ({
          eq: () => ({
            order: () => ({
              limit: () => new Promise((resolve) => { resolveHistory = resolve; }),
            }),
          }),
        }),
        insert,
      };
    });
    useAuthStore.setState({ user: student, token: "t" });
  });

  const row = (id: string, user_id: string, content: string, created_at: string): Row => ({ id, user_id, content, created_at });

  it("un mensaje que llega por Realtime mientras carga el historial no se pierde", async () => {
    render(<LiveChat liveId="live-1" showWelcome={false} />);
    await waitFor(() => expect(messagesChannel.on).toHaveBeenCalled());

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
    await waitFor(() => expect(messagesChannel.on).toHaveBeenCalled());
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
    await waitFor(() => expect(messagesChannel.on).toHaveBeenCalled());
    await act(async () => {
      resolveHistory({ data: null, error: { message: "boom" } });
    });

    expect(await screen.findByText(/No pudimos cargar los mensajes anteriores/)).toBeInTheDocument();
  });

  it("el indicador de conexión refleja la suscripción real (F23)", async () => {
    render(<LiveChat liveId="live-1" showWelcome={false} />);
    await waitFor(() => expect(messagesChannel.subscribe).toHaveBeenCalled());
    expect(screen.getByRole("status")).toHaveTextContent("Conectando…");

    act(() => statusCallback()("SUBSCRIBED"));
    expect(screen.getByRole("status")).toHaveTextContent("Chat en tiempo real");

    act(() => statusCallback()("CHANNEL_ERROR"));
    expect(screen.getByRole("status")).toHaveTextContent("Reconectando…");
  });
});

describe("LiveChat — reacciones", () => {
  type Row = { id: string; content: string; created_at: string; user_id: string };
  const reactionInsert = vi.fn();
  const reactionDeleteEq3 = vi.fn();
  const reactionDeleteEq2 = vi.fn(() => ({ eq: reactionDeleteEq3 }));
  const reactionDeleteEq1 = vi.fn(() => ({ eq: reactionDeleteEq2 }));
  const reactionDelete = vi.fn(() => ({ eq: reactionDeleteEq1 }));
  const reactionsSelectIn = vi.fn();

  // Handlers registrados en el canal de reacciones (propio, ver
  // useLiveReactions.ts): [0] INSERT live_message_reactions, [1] DELETE
  // live_message_reactions. El canal de mensajes ya no los ve.
  const reactionInsertHandler = () => reactionsChannel.on.mock.calls[0][2] as (payload: { new: { message_id: string; user_id: string; emoji: string } }) => void;
  const reactionDeleteHandler = () => reactionsChannel.on.mock.calls[1][2] as (payload: { old: Partial<{ message_id: string; user_id: string; emoji: string }> }) => void;

  const row = (id: string, user_id: string, content: string, created_at: string): Row => ({ id, user_id, content, created_at });

  beforeEach(() => {
    vi.clearAllMocks();
    setupChannelChaining();
    reactionsSelectIn.mockResolvedValue({ data: [], error: null });
    reactionInsert.mockResolvedValue({ error: null });
    reactionDeleteEq3.mockResolvedValue({ error: null });
    (supabase.auth.getSession as ReturnType<typeof vi.fn>).mockResolvedValue({ data: { session: null } });
    from.mockImplementation((table: string) => {
      if (table === "profiles") {
        return { select: () => ({ in: () => Promise.resolve({ data: [{ id: "beto", full_name: "Beto" }] }), eq: () => ({ maybeSingle: () => Promise.resolve({ data: { full_name: "Beto" } }) }) }) };
      }
      if (table === "live_message_reactions") {
        return { select: () => ({ eq: () => ({ in: reactionsSelectIn }) }), insert: reactionInsert, delete: reactionDelete };
      }
      return {
        select: () => ({
          eq: () => ({
            order: () => ({
              limit: () => Promise.resolve({ data: [row("m1", "beto", "Hola", "2026-09-26T10:00:00Z")], error: null }),
            }),
          }),
        }),
        insert,
      };
    });
    useAuthStore.setState({ user: student, token: "t" });
  });

  async function renderChatWithMessage() {
    render(<LiveChat liveId="live-1" showWelcome={false} />);
    return screen.findByText("Hola");
  }

  it("el picker se abre al tocar la burbuja del mensaje", async () => {
    await renderChatWithMessage();
    fireEvent.click(screen.getByText("Hola"));

    expect(await screen.findByRole("menu", { name: "Elegir reacción" })).toBeInTheDocument();
  });

  it("tocar de nuevo la burbuja lo cierra en vez de reabrirlo (2026-09-26)", async () => {
    await renderChatWithMessage();
    const bubble = screen.getByText("Hola");
    fireEvent.click(bubble);
    await screen.findByRole("menu");

    // Un tap real dispara primero `pointerdown` (el handler de "click afuera"
    // del picker) y recién después `click` (el toggle de la burbuja). Sin el
    // fix, el `pointerdown` ya cerraba el picker y el `click` lo reabría.
    fireEvent.pointerDown(bubble);
    fireEvent.click(bubble);

    await waitFor(() => expect(screen.queryByRole("menu")).not.toBeInTheDocument());
  });

  it("elegir ❤️ llama a addReaction y muestra el contador resaltado", async () => {
    await renderChatWithMessage();
    fireEvent.click(screen.getByText("Hola"));
    const menu = await screen.findByRole("menu");
    fireEvent.click(within(menu).getByRole("menuitem", { name: /Reaccionar con corazón/ }));

    await waitFor(() => expect(reactionInsert).toHaveBeenCalledWith({ message_id: "m1", live_id: "live-1", user_id: "user-1", emoji: "heart" }));
    const chip = await screen.findByRole("button", { name: /Quitar corazón \(1\)/ });
    expect(chip).toHaveAttribute("aria-pressed", "true");
  });

  it("tocar de nuevo la reacción propia llama a removeReaction", async () => {
    await renderChatWithMessage();
    fireEvent.click(screen.getByText("Hola"));
    const menu = await screen.findByRole("menu");
    fireEvent.click(within(menu).getByRole("menuitem", { name: /Reaccionar con corazón/ }));
    const chip = await screen.findByRole("button", { name: /Quitar corazón \(1\)/ });

    fireEvent.click(chip);

    await waitFor(() => expect(reactionDeleteEq1).toHaveBeenCalledWith("message_id", "m1"));
    expect(reactionDeleteEq2).toHaveBeenCalledWith("emoji", "heart");
    expect(reactionDeleteEq3).toHaveBeenCalledWith("user_id", "user-1");
    expect(screen.queryByRole("button", { name: /corazón/ })).not.toBeInTheDocument();
  });

  it("un INSERT de Realtime de otro usuario incrementa el contador", async () => {
    await renderChatWithMessage();
    await waitFor(() => expect(reactionsChannel.on).toHaveBeenCalledTimes(2));

    act(() => reactionInsertHandler()({ new: { message_id: "m1", user_id: "otro-user", emoji: "fire" } }));

    expect(await screen.findByText("1")).toBeInTheDocument();
  });

  it("un DELETE de Realtime quita el contador", async () => {
    await renderChatWithMessage();
    await waitFor(() => expect(reactionsChannel.on).toHaveBeenCalledTimes(2));
    act(() => reactionInsertHandler()({ new: { message_id: "m1", user_id: "otro-user", emoji: "fire" } }));
    await screen.findByText("1");

    act(() => reactionDeleteHandler()({ old: { message_id: "m1", user_id: "otro-user", emoji: "fire" } }));

    await waitFor(() => expect(screen.queryByText("1")).not.toBeInTheDocument());
  });

  it("una reacción de Realtime que llega antes de que resuelva el snapshot no se pierde (race 2026-09-26)", async () => {
    let resolveReactions: (value: { data: unknown[]; error: null }) => void = () => {};
    reactionsSelectIn.mockReturnValue(new Promise((resolve) => { resolveReactions = resolve; }));

    await renderChatWithMessage();
    await waitFor(() => expect(reactionsChannel.on).toHaveBeenCalledTimes(2));

    // El evento de Realtime llega ANTES de que el snapshot de reacciones resuelva.
    act(() => reactionInsertHandler()({ new: { message_id: "m1", user_id: "otro-user", emoji: "fire" } }));
    expect(await screen.findByText("1")).toBeInTheDocument();

    // El snapshot resuelve vacío (como si la consulta hubiera arrancado antes
    // de que llegara el evento) — el merge debe conservar el evento bufferizado.
    await act(async () => {
      resolveReactions({ data: [], error: null });
    });

    expect(await screen.findByText("1")).toBeInTheDocument();
  });

  it("no hay picker en el mensaje de bienvenida", async () => {
    render(<LiveChat liveId="live-1" showWelcome />);
    await screen.findByText("Hola");
    const welcome = screen.getByText(/Bienvenidos a este encuentro exclusivo/);

    fireEvent.click(welcome);

    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });
});

describe("LiveChat — respuestas (2026-09-27)", () => {
  interface Row {
    id: string;
    content: string;
    created_at: string;
    user_id: string;
    reply_to_id: string | null;
    reply_to_user_id: string | null;
    reply_to_user_name: string | null;
    reply_to_excerpt: string | null;
  }

  const row = (
    overrides: Pick<Row, "id" | "user_id" | "content" | "created_at"> & Partial<Row>
  ): Row => ({
    reply_to_id: null,
    reply_to_user_id: null,
    reply_to_user_name: null,
    reply_to_excerpt: null,
    ...overrides,
  });

  // El canal de mensajes solo registra este único handler (ver los otros
  // describes de este archivo para el mismo criterio).
  const insertHandler = () => messagesChannel.on.mock.calls[0][2] as (payload: { new: Row }) => Promise<void>;

  const openActionsBarAndReply = async () => {
    fireEvent.click(screen.getByText("Hola"));
    const menu = await screen.findByRole("menu");
    fireEvent.click(within(menu).getByRole("menuitem", { name: "Responder" }));
    return screen.findByText("Respondiendo a Beto");
  };

  beforeEach(() => {
    vi.clearAllMocks();
    setupChannelChaining();
    (supabase.auth.getSession as ReturnType<typeof vi.fn>).mockResolvedValue({ data: { session: null } });
    from.mockImplementation((table: string) => {
      if (table === "profiles") {
        return {
          select: () => ({
            in: () => Promise.resolve({ data: [{ id: "beto", full_name: "Beto" }] }),
            eq: () => ({ maybeSingle: () => Promise.resolve({ data: { full_name: "Beto" } }) }),
          }),
        };
      }
      if (table === "live_message_reactions") {
        return { select: () => ({ eq: () => ({ in: () => Promise.resolve({ data: [], error: null }) }) }) };
      }
      return {
        select: () => ({
          eq: () => ({
            order: () => ({
              limit: () =>
                Promise.resolve({
                  data: [row({ id: "m1", user_id: "beto", content: "Hola", created_at: "2026-09-27T10:00:00Z" })],
                  error: null,
                }),
            }),
          }),
        }),
        insert,
      };
    });
    useAuthStore.setState({ user: student, token: "t" });
  });

  async function renderChatWithMessage() {
    render(<LiveChat liveId="live-1" showWelcome={false} />);
    await screen.findByText("Hola");
  }

  it("elegir «Responder» desde la barra de acciones muestra el composer de respuesta y enfoca el input", async () => {
    await renderChatWithMessage();

    await openActionsBarAndReply();

    expect(screen.getByLabelText("Mensaje para la comunidad")).toHaveFocus();
  });

  it("enviar inserta con reply_to_id y SIN reply_to_user_name/excerpt en el payload", async () => {
    insert.mockResolvedValue({ error: null });
    await renderChatWithMessage();
    await openActionsBarAndReply();
    const input = screen.getByLabelText("Mensaje para la comunidad") as HTMLInputElement;

    send(input, "Dale");

    await waitFor(() => expect(insert).toHaveBeenCalled());
    const payload = insert.mock.calls[0][0] as Record<string, unknown>;
    expect(payload).toMatchObject({ reply_to_id: "m1" });
    expect(payload).not.toHaveProperty("reply_to_user_name");
    expect(payload).not.toHaveProperty("reply_to_excerpt");
    // Confirmado: el composer se limpia solo.
    await waitFor(() => expect(screen.queryByText("Respondiendo a Beto")).not.toBeInTheDocument());
  });

  it("cancelar con el botón X limpia el objetivo de respuesta", async () => {
    await renderChatWithMessage();
    await openActionsBarAndReply();

    fireEvent.click(screen.getByRole("button", { name: "Cancelar respuesta" }));

    expect(screen.queryByText("Respondiendo a Beto")).not.toBeInTheDocument();
  });

  it("Escape en el input cancela la respuesta", async () => {
    await renderChatWithMessage();
    await openActionsBarAndReply();
    const input = screen.getByLabelText("Mensaje para la comunidad");

    fireEvent.keyDown(input, { key: "Escape" });

    expect(screen.queryByText("Respondiendo a Beto")).not.toBeInTheDocument();
  });

  it("un envío fallido conserva el objetivo de respuesta", async () => {
    insert.mockResolvedValue({ error: { message: "boom" } });
    await renderChatWithMessage();
    await openActionsBarAndReply();
    const input = screen.getByLabelText("Mensaje para la comunidad") as HTMLInputElement;

    send(input, "Dale");
    await screen.findByRole("alert");

    expect(screen.getByText("Respondiendo a Beto")).toBeInTheDocument();
  });

  it("un INSERT de Realtime con datos de respuesta muestra la cita", async () => {
    await renderChatWithMessage();
    await waitFor(() => expect(messagesChannel.on).toHaveBeenCalled());

    await act(async () => {
      await insertHandler()({
        new: row({
          id: "m2",
          user_id: "beto",
          content: "Va de nuevo",
          created_at: "2026-09-27T10:05:00Z",
          reply_to_id: "m1",
          reply_to_user_id: "beto",
          reply_to_user_name: "Beto",
          reply_to_excerpt: "Hola",
        }),
      });
    });

    expect(await screen.findByText("Va de nuevo")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Ir al mensaje original" })).toBeInTheDocument();
  });

  it("un mensaje sin extracto (original borrado) muestra 'Mensaje eliminado'", async () => {
    await renderChatWithMessage();
    await waitFor(() => expect(messagesChannel.on).toHaveBeenCalled());

    await act(async () => {
      await insertHandler()({
        new: row({
          id: "m2",
          user_id: "beto",
          content: "Va de nuevo",
          created_at: "2026-09-27T10:05:00Z",
          reply_to_id: null,
          reply_to_user_id: null,
          reply_to_user_name: "Beto",
          reply_to_excerpt: null,
        }),
      });
    });

    expect(await screen.findByText("Mensaje eliminado")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Ir al mensaje original" })).not.toBeInTheDocument();
  });

  it("resalta la burbuja de quien me respondió", async () => {
    const { container } = render(<LiveChat liveId="live-1" showWelcome={false} />);
    await screen.findByText("Hola");
    await waitFor(() => expect(messagesChannel.on).toHaveBeenCalled());

    await act(async () => {
      await insertHandler()({
        new: row({
          id: "m2",
          user_id: "beto",
          content: "Te contesto",
          created_at: "2026-09-27T10:05:00Z",
          reply_to_id: "m1",
          reply_to_user_id: "user-1",
          reply_to_user_name: "Alumno",
          reply_to_excerpt: "Hola",
        }),
      });
    });

    await screen.findByText("Te contesto");
    const bubble = container.querySelector('[data-message-id="m2"] [data-reaction-trigger="true"]');
    expect(bubble).toHaveClass("ring-accent/60");
  });

  it("«Ir al mensaje original» desplaza y resalta la burbuja original", async () => {
    const scrollIntoView = vi.fn();
    Element.prototype.scrollIntoView = scrollIntoView;
    const { container } = render(<LiveChat liveId="live-1" showWelcome={false} />);
    await screen.findByText("Hola");
    await waitFor(() => expect(messagesChannel.on).toHaveBeenCalled());

    await act(async () => {
      await insertHandler()({
        new: row({
          id: "m2",
          user_id: "beto",
          content: "Va de nuevo",
          created_at: "2026-09-27T10:05:00Z",
          reply_to_id: "m1",
          reply_to_user_id: "beto",
          reply_to_user_name: "Beto",
          reply_to_excerpt: "Hola",
        }),
      });
    });
    await screen.findByText("Va de nuevo");

    fireEvent.click(screen.getByRole("button", { name: "Ir al mensaje original" }));

    expect(scrollIntoView).toHaveBeenCalled();
    const originalBubble = container.querySelector('[data-message-id="m1"] [data-reaction-trigger="true"]');
    expect(originalBubble).toHaveClass("ring-accent");
  });
});
