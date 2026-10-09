import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, act, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import PublicLiveChat from "./PublicLiveChat";
import { getPublicLiveMessages } from "@/lib/api/stream/lives";
import { fetchPublicLiveReactions } from "@/lib/api/stream/reactions";
import type * as ReactionsModule from "@/lib/api/stream/reactions";

vi.mock("@/lib/api/stream/lives", () => ({
  getPublicLiveMessages: vi.fn(),
}));

vi.mock("@/lib/api/stream/reactions", async (importOriginal) => {
  const actual = await importOriginal<typeof ReactionsModule>();
  return { ...actual, fetchPublicLiveReactions: vi.fn() };
});

describe("PublicLiveChat — reacciones de solo lectura", () => {
  it("muestra los contadores como chips sin botones interactivos", async () => {
    (getPublicLiveMessages as ReturnType<typeof vi.fn>).mockResolvedValue([
      {
        id: "m1",
        user_id: "beto",
        message: "Hola a todos",
        created_at: "2026-09-26T10:00:00Z",
        user_name: "Beto",
        reply_to_id: null,
        reply_to_user_name: null,
        reply_to_excerpt: null,
      },
    ]);
    (fetchPublicLiveReactions as ReturnType<typeof vi.fn>).mockResolvedValue(
      new Map([["m1", { heart: { count: 3, mine: false } }]])
    );

    render(
      <MemoryRouter>
        <PublicLiveChat token="token-1" loginPath="/login" showWelcome={false} />
      </MemoryRouter>
    );

    await screen.findByText("Hola a todos");
    expect(await screen.findByText("3")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /corazón/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();

    // Reacciones y mensajes comparten la misma ventana — no un límite propio.
    expect(getPublicLiveMessages).toHaveBeenCalledWith("token-1", 100);
    expect(fetchPublicLiveReactions).toHaveBeenCalledWith("token-1", 100);
  });
});

describe("PublicLiveChat — respuestas (2026-09-27)", () => {
  it("un mensaje con datos de respuesta muestra la cita", async () => {
    (getPublicLiveMessages as ReturnType<typeof vi.fn>).mockResolvedValue([
      {
        id: "m1",
        user_id: "beto",
        message: "Hola a todos",
        created_at: "2026-09-26T10:00:00Z",
        user_name: "Beto",
        reply_to_id: null,
        reply_to_user_name: null,
        reply_to_excerpt: null,
      },
      {
        id: "m2",
        user_id: "ana",
        message: "Va de nuevo",
        created_at: "2026-09-26T10:01:00Z",
        user_name: "Ana",
        reply_to_id: "m1",
        reply_to_user_name: "Beto",
        reply_to_excerpt: "Hola a todos",
      },
    ]);
    (fetchPublicLiveReactions as ReturnType<typeof vi.fn>).mockResolvedValue(new Map());

    render(
      <MemoryRouter>
        <PublicLiveChat token="token-1" loginPath="/login" showWelcome={false} />
      </MemoryRouter>
    );

    await screen.findByText("Va de nuevo");
    // El nombre citado y "Ir al mensaje original" (el original SÍ está cargado).
    expect(screen.getAllByText("Beto").length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: "Ir al mensaje original" })).toBeInTheDocument();
  });

  it("un mensaje de respuesta sin extracto muestra 'Mensaje eliminado' y sin botón de salto", async () => {
    (getPublicLiveMessages as ReturnType<typeof vi.fn>).mockResolvedValue([
      {
        id: "m2",
        user_id: "ana",
        message: "Va de nuevo",
        created_at: "2026-09-26T10:01:00Z",
        user_name: "Ana",
        reply_to_id: null,
        reply_to_user_name: "Beto",
        reply_to_excerpt: null,
      },
    ]);
    (fetchPublicLiveReactions as ReturnType<typeof vi.fn>).mockResolvedValue(new Map());

    render(
      <MemoryRouter>
        <PublicLiveChat token="token-1" loginPath="/login" showWelcome={false} />
      </MemoryRouter>
    );

    await screen.findByText("Va de nuevo");
    expect(screen.getByText("Mensaje eliminado")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Ir al mensaje original" })).not.toBeInTheDocument();
  });
});

describe("PublicLiveChat — moderación (2026-10-09)", () => {
  const publicMessage = (id: string, minute: number, extra: Record<string, unknown> = {}) => ({
    id,
    user_id: "beto",
    message: `mensaje ${id}`,
    created_at: `2026-10-09T10:0${minute}:00Z`,
    user_name: "Beto",
    reply_to_id: null,
    reply_to_user_name: null,
    reply_to_excerpt: null,
    ...extra,
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("un mensaje eliminado por el admin desaparece en el siguiente sondeo", async () => {
    // El sondeo de 4 s se dispara a mano: faltar timers falsos evita que
    // findBy* (que también usa setInterval) se cuelgue.
    const realSetInterval = window.setInterval.bind(window);
    let poll: () => void = () => {};
    vi.spyOn(window, "setInterval").mockImplementation(((handler: () => void, delay?: number) => {
      if (delay === 4000) {
        poll = handler;
        return 0;
      }
      return realSetInterval(handler, delay);
    }) as typeof window.setInterval);
    (fetchPublicLiveReactions as ReturnType<typeof vi.fn>).mockResolvedValue(new Map());
    (getPublicLiveMessages as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce([
        publicMessage("m1", 1),
        publicMessage("m2", 2),
        publicMessage("m3", 3, { reply_to_id: "m2", reply_to_user_name: "Beto", reply_to_excerpt: "cita de m2" }),
      ])
      // Segundo sondeo: m2 eliminado; la respuesta m3 llega con la cita ya limpia.
      .mockResolvedValue([
        publicMessage("m1", 1),
        publicMessage("m3", 3, { reply_to_id: null, reply_to_user_name: "Beto", reply_to_excerpt: null }),
      ]);

    render(
      <MemoryRouter>
        <PublicLiveChat token="token-1" loginPath="/login" showWelcome={false} />
      </MemoryRouter>
    );
    await screen.findByText("mensaje m2");

    await act(async () => {
      poll();
    });

    await waitFor(() => expect(screen.queryByText("mensaje m2")).not.toBeInTheDocument());
    expect(screen.getByText("mensaje m1")).toBeInTheDocument();
    expect(screen.getByText("mensaje m3")).toBeInTheDocument();
    expect(screen.getByText("Mensaje eliminado")).toBeInTheDocument();
  });

  it("una respuesta vieja que llega después de una más nueva no borra mensajes recién agregados", async () => {
    const realSetInterval = window.setInterval.bind(window);
    let poll: () => void = () => {};
    vi.spyOn(window, "setInterval").mockImplementation(((handler: () => void, delay?: number) => {
      if (delay === 4000) {
        poll = handler;
        return 0;
      }
      return realSetInterval(handler, delay);
    }) as typeof window.setInterval);
    (fetchPublicLiveReactions as ReturnType<typeof vi.fn>).mockResolvedValue(new Map());
    (getPublicLiveMessages as ReturnType<typeof vi.fn>).mockReset();

    type Msg = ReturnType<typeof publicMessage>;
    let resolveSlow: (value: Msg[]) => void = () => {};
    (getPublicLiveMessages as ReturnType<typeof vi.fn>)
      // Primera petición (la inicial): lenta, se resuelve al final.
      .mockImplementationOnce(() => new Promise<Msg[]>((resolve) => { resolveSlow = resolve; }))
      // Segunda (el sondeo): rápida, ya trae m3.
      .mockResolvedValueOnce([publicMessage("m1", 1), publicMessage("m2", 2), publicMessage("m3", 3)]);

    render(
      <MemoryRouter>
        <PublicLiveChat token="token-1" loginPath="/login" showWelcome={false} />
      </MemoryRouter>
    );
    await waitFor(() => expect(getPublicLiveMessages).toHaveBeenCalledTimes(1));

    await act(async () => {
      poll();
    });
    await screen.findByText("mensaje m3");

    // Llega la respuesta lenta y vieja (sin m3): no debe purgar m3.
    await act(async () => {
      resolveSlow([publicMessage("m1", 1), publicMessage("m2", 2)]);
    });

    expect(screen.getByText("mensaje m3")).toBeInTheDocument();
    expect(screen.getByText("mensaje m1")).toBeInTheDocument();
  });
});
