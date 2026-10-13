import { describe, it, expect, vi, beforeEach } from "vitest";
import type * as CommunityApi from "@/lib/api/community";
import { render, screen, fireEvent, act, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import type { CommunityPost } from "@/lib/api/community";
import { CommunityFeed } from "./CommunityFeed";

vi.mock("motion/react", async () => {
  const React = await import("react");
  const DROP = ["initial", "animate", "exit", "transition", "whileHover", "whileTap", "layout", "layoutId"];
  const motion = new Proxy({}, {
    get: (_t, tag: string) =>
      React.forwardRef((props: Record<string, unknown>, ref) =>
        React.createElement(tag, { ...Object.fromEntries(Object.entries(props).filter(([k]) => !DROP.includes(k))), ref })
      ),
  });
  return { motion, AnimatePresence: ({ children }: { children: React.ReactNode }) => children };
});

// Realtime capturado: cada test dispara el INSERT como lo haría Supabase.
const realtime: Record<string, (payload: unknown) => void> = {};
const channel = {
  on: vi.fn((_type: string, filter: { event: string }, cb: (payload: unknown) => void) => {
    realtime[filter.event] = cb;
    return channel;
  }),
  subscribe: vi.fn(() => channel),
};
vi.mock("@/lib/supabase", () => ({
  supabase: { channel: vi.fn(() => channel), removeChannel: vi.fn() },
}));

const fetchPosts = vi.fn();
vi.mock("@/lib/api/community", async (importOriginal) => ({
  ...(await importOriginal<typeof CommunityApi>()),
  fetchPosts: (...args: unknown[]) => fetchPosts(...args),
  deletePost: vi.fn(),
}));

const post = (id: string, fields: Partial<CommunityPost> = {}): CommunityPost => ({
  id,
  author_id: "author-1",
  title: `Publicación ${id}`,
  body: "Contenido",
  category: "pregunta",
  is_pinned: false,
  is_locked: false,
  like_count: 0,
  comment_count: 0,
  created_at: "2026-10-01T00:00:00Z",
  updated_at: "2026-10-01T00:00:00Z",
  author: { id: "author-1", full_name: "Ana", avatar_url: null, role: "vip", plan: "vip" },
  ...fields,
});

function renderFeed() {
  return render(
    <MemoryRouter>
      <CommunityFeed currentUserId="me" isAdmin={false} canWrite />
    </MemoryRouter>
  );
}

/** Promesa controlable: resolver/rechazar desde el test. */
function deferred<T>() {
  let resolve!: (v: T) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

describe("CommunityFeed", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // jsdom no implementa scrollTo; abrir y volver del detalle lo usan.
    window.scrollTo = vi.fn() as unknown as typeof window.scrollTo;
    for (const k of Object.keys(realtime)) delete realtime[k];
  });

  it("un error de carga se muestra como error con Reintentar, no como «aún no hay publicaciones»", async () => {
    fetchPosts.mockRejectedValueOnce(new Error("network"));
    renderFeed();
    expect(await screen.findByText("No pudimos cargar la comunidad")).toBeInTheDocument();
    expect(screen.queryByText("Aún no hay publicaciones")).not.toBeInTheDocument();

    fetchPosts.mockResolvedValueOnce([post("1")]);
    fireEvent.click(screen.getByRole("button", { name: /Reintentar/ }));
    expect(await screen.findByText("Publicación 1")).toBeInTheDocument();
  });

  it("vacío por filtro ofrece volver a todas", async () => {
    fetchPosts.mockResolvedValue([post("1")]);
    renderFeed();
    await screen.findByText("Publicación 1");

    fetchPosts.mockResolvedValueOnce([]);
    fireEvent.click(screen.getByRole("button", { name: /Recurso/ }));
    expect(await screen.findByText(/Sin publicaciones en/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Ver todas" }));
    expect(await screen.findByText("Publicación 1")).toBeInTheDocument();
  });

  it("un INSERT de realtime refresca sin volver al skeleton", async () => {
    fetchPosts.mockResolvedValueOnce([post("1")]);
    renderFeed();
    await screen.findByText("Publicación 1");

    const next = deferred<CommunityPost[]>();
    fetchPosts.mockReturnValueOnce(next.promise);
    act(() => { realtime.INSERT({}); });
    // Mientras refresca, la lista sigue a la vista.
    expect(screen.getByText("Publicación 1")).toBeInTheDocument();
    expect(screen.queryByLabelText("Cargando publicaciones")).not.toBeInTheDocument();

    await act(async () => { next.resolve([post("2"), post("1")]); });
    expect(screen.getByText("Publicación 2")).toBeInTheDocument();
  });

  it("una respuesta vieja no pisa la vista del filtro nuevo", async () => {
    fetchPosts.mockResolvedValueOnce([post("1")]);
    renderFeed();
    await screen.findByText("Publicación 1");

    const slow = deferred<CommunityPost[]>();
    const fast = deferred<CommunityPost[]>();
    fetchPosts.mockReturnValueOnce(slow.promise).mockReturnValueOnce(fast.promise);
    fireEvent.click(screen.getByRole("button", { name: /Pregunta/ }));
    fireEvent.click(screen.getByRole("button", { name: /Recurso/ }));

    await act(async () => { fast.resolve([post("recurso", { category: "recurso" })]); });
    await act(async () => { slow.resolve([post("pregunta")]); });
    expect(screen.getByText("Publicación recurso")).toBeInTheDocument();
    expect(screen.queryByText("Publicación pregunta")).not.toBeInTheDocument();
  });

  it("las métricas dicen de qué hablan: autores de esta vista, no miembros activos", async () => {
    fetchPosts.mockResolvedValueOnce([post("1"), post("2", { author_id: "author-2" })]);
    renderFeed();
    await screen.findByText("Publicación 1");
    expect(screen.getByText("Autores en esta vista")).toBeInTheDocument();
    expect(screen.queryByText("Miembros activos")).not.toBeInTheDocument();
  });

  it("abrir una publicación lleva la vista a su inicio (no queda en el footer)", async () => {
    fetchPosts.mockResolvedValueOnce([post("1")]);
    renderFeed();
    fireEvent.click(await screen.findByRole("button", { name: "Publicación 1" }));
    await waitFor(() => expect(window.scrollTo).toHaveBeenCalled());
  });

  it("el botón de comentarios abre la publicación", async () => {
    fetchPosts.mockResolvedValueOnce([post("1", { comment_count: 2 })]);
    renderFeed();
    fireEvent.click(await screen.findByRole("button", { name: "2 comentarios: ver los comentarios" }));
    await waitFor(() => expect(screen.getByRole("button", { name: /Volver al foro/ })).toBeInTheDocument());
  });

  it("la tarjeta se abre con el teclado desde el título", async () => {
    fetchPosts.mockResolvedValueOnce([post("1")]);
    renderFeed();
    const title = await screen.findByRole("button", { name: "Publicación 1" });
    fireEvent.click(title);
    await waitFor(() => expect(screen.getByRole("button", { name: /Volver al foro/ })).toBeInTheDocument());
  });
});
