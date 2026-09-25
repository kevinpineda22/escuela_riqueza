import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, act, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { LiveRoom } from "./LiveRoom";
import { useIsDesktop, useIsShortLandscape } from "@/hooks/useMediaQuery";
import type { ChatMessage } from "@/components/feature/LiveChat";
import type { LiveEvent } from "@/lib/api/stream/lives";
import type { User } from "@/types/user";

const channel = { on: vi.fn(), subscribe: vi.fn(), untrack: vi.fn(), presenceState: vi.fn(() => ({})) };

vi.mock("@/lib/supabase", () => ({
  supabase: {
    channel: vi.fn(() => channel),
    removeChannel: vi.fn(),
  },
}));

vi.mock("@/hooks/useMediaQuery", () => ({ useIsDesktop: vi.fn(), useIsShortLandscape: vi.fn() }));

// El player real necesita hls.js y un <video> con media; acá solo importa si se monta.
vi.mock("@/components/feature/LiveHLSPlayer", () => ({
  default: () => <div data-testid="hls-player" />,
}));
vi.mock("@/components/feature/LivePlayerControls", () => ({ default: () => null }));

const student = { id: "user-1", fullName: "Alumno", avatarUrl: null, plan: "vip" } as User;

const baseLive = {
  id: "live-1",
  title: "Clase de inversión",
  description: null,
  starts_at: "2099-01-01T00:00:00Z",
  status: "scheduled",
  is_paused: false,
  stream_live_input_id: "input-1",
  background_image_url: null,
} as LiveEvent;

let onIncoming: ((msg: ChatMessage) => void) | null = null;
const renderChat = (cb: (msg: ChatMessage) => void) => {
  onIncoming = cb;
  return <div data-testid="chat" />;
};

function renderRoom(props: Partial<Parameters<typeof LiveRoom>[0]> = {}) {
  return render(
    <MemoryRouter>
      <LiveRoom live={baseLive} currentUser={student} backTo={{ path: "/", label: "Volver" }} renderChat={renderChat} {...props} />
    </MemoryRouter>
  );
}

const message = (user_id: string): ChatMessage => ({ id: crypto.randomUUID(), user_id, user_name: "X", content: "hola", created_at: "" });

describe("LiveRoom", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    onIncoming = null;
    channel.on.mockReturnValue(channel);
    channel.subscribe.mockReturnValue(channel);
    channel.untrack.mockResolvedValue(undefined);
    (useIsDesktop as ReturnType<typeof vi.fn>).mockReturnValue(true);
    (useIsShortLandscape as ReturnType<typeof vi.fn>).mockReturnValue(false);
  });

  it("programada: muestra la espera con el título y el chat", () => {
    renderRoom();
    expect(screen.getByRole("heading", { level: 2, name: "Clase de inversión" })).toBeInTheDocument();
    expect(screen.getByText("PRÓXIMAMENTE")).toBeInTheDocument();
    expect(screen.getByTestId("chat")).toBeInTheDocument();
    expect(screen.queryByTestId("hls-player")).not.toBeInTheDocument();
  });

  it("programada con señal de OBS: monta el player y avisa que está en espera", () => {
    renderRoom({ signalConnected: true });
    expect(screen.getByTestId("hls-player")).toBeInTheDocument();
    expect(screen.getByText("EN ESPERA")).toBeInTheDocument();
  });

  it("en vivo: monta el player", () => {
    renderRoom({ live: { ...baseLive, status: "live" } });
    expect(screen.getByTestId("hls-player")).toBeInTheDocument();
    expect(screen.getByText("EN VIVO")).toBeInTheDocument();
  });

  it("finalizada con OBS conectado: muestra el cierre en vez del player (F33)", () => {
    renderRoom({ live: { ...baseLive, status: "ended" }, signalConnected: true });
    expect(screen.getByText("Transmisión finalizada")).toBeInTheDocument();
    expect(screen.getByText("FINALIZADO")).toBeInTheDocument();
    expect(screen.queryByTestId("hls-player")).not.toBeInTheDocument();
  });

  it("finalizada con grabación: muestra el replay y no el chat", () => {
    renderRoom({ live: { ...baseLive, status: "ended" }, replay: <div data-testid="replay" />, renderChat: null });
    expect(screen.getByTestId("replay")).toBeInTheDocument();
    expect(screen.getByText("GRABACIÓN DEL EN VIVO")).toBeInTheDocument();
    expect(screen.queryByTestId("chat")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Ocultar chat" })).not.toBeInTheDocument();
  });

  it("finalizada con aviso propio (paywall de repetición): lo muestra en lugar del cierre", () => {
    renderRoom({ live: { ...baseLive, status: "ended" }, endedNotice: <div data-testid="paywall" />, renderChat: null });
    expect(screen.getByTestId("paywall")).toBeInTheDocument();
    expect(screen.queryByText("Transmisión finalizada")).not.toBeInTheDocument();
    expect(screen.getByText("FINALIZADO")).toBeInTheDocument();
  });

  it("cuenta como no leídos solo los mensajes ajenos mientras el chat está oculto", async () => {
    renderRoom();
    fireEvent.click(screen.getByRole("button", { name: "Ocultar chat" }));

    act(() => {
      onIncoming?.(message("otro"));
      onIncoming?.(message("user-1"));
    });
    expect(screen.getByText("1")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Mostrar chat" }));
    // El badge sale con animación: se desmonta al terminar el fade.
    await waitFor(() => expect(screen.queryByText("1")).not.toBeInTheDocument());
  });

  it("en celular no hay toggle: el chat queda siempre debajo del video", () => {
    (useIsDesktop as ReturnType<typeof vi.fn>).mockReturnValue(false);
    renderRoom();
    expect(screen.getByTestId("chat")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Ocultar chat" })).not.toBeInTheDocument();
  });

  describe("horizontal con poca altura (F12)", () => {
    beforeEach(() => {
      (useIsShortLandscape as ReturnType<typeof vi.fn>).mockReturnValue(true);
    });

    it("el video manda: el chat arranca cerrado y fuera del foco", () => {
      renderRoom({ live: { ...baseLive, status: "live" } });
      expect(screen.getByRole("button", { name: "Mostrar chat" })).toBeInTheDocument();
      expect(screen.getByTestId("chat").parentElement).toHaveAttribute("inert");
    });

    it("el chat se abre como panel y sale del modo inerte", () => {
      renderRoom({ live: { ...baseLive, status: "live" } });
      fireEvent.click(screen.getByRole("button", { name: "Mostrar chat" }));
      expect(screen.getByTestId("chat").parentElement).not.toHaveAttribute("inert");
      expect(screen.getByRole("button", { name: "Ocultar chat" })).toBeInTheDocument();
    });

    it("el header no tapa la clase con logo ni título, pero el título sigue para lectores", () => {
      renderRoom({ live: { ...baseLive, status: "live" } });
      expect(screen.queryByAltText("Logo")).not.toBeInTheDocument();
      expect(screen.getByRole("heading", { level: 1, name: "Clase de inversión" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Volver" })).toBeInTheDocument();
    });

    it("gana aunque el ancho sea de celular (667×375)", () => {
      (useIsDesktop as ReturnType<typeof vi.fn>).mockReturnValue(false);
      renderRoom({ live: { ...baseLive, status: "live" } });
      expect(screen.getByRole("button", { name: "Mostrar chat" })).toBeInTheDocument();
    });
  });
});
