import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { useEffect } from "react";
import { AdminLivePreview } from "./AdminLivePreview";

interface MockPlayerProps {
  liveInputId: string;
  muted: boolean;
  latencyMode?: string;
  onPlaying?: () => void;
  onFatalError?: () => void;
  onRecovered?: () => void;
}

// Cuenta montajes reales del player: un `key` nuevo remonta y suma uno.
const playerMounted = vi.fn();

vi.mock("@/components/feature/LiveHLSPlayer", () => ({
  default: function MockPlayer({ liveInputId, muted, latencyMode, onPlaying, onFatalError, onRecovered }: MockPlayerProps) {
    useEffect(() => {
      playerMounted();
    }, []);
    return (
      <div data-testid="hls-player" data-input={liveInputId} data-muted={String(muted)} data-latency={latencyMode}>
        <button onClick={onPlaying}>simular-playing</button>
        <button onClick={onFatalError}>simular-fatal</button>
        <button onClick={onRecovered}>simular-recovered</button>
      </div>
    );
  },
}));

vi.mock("@/components/feature/LiveChat", () => ({
  default: function MockChat({ liveId, canModerate, showWelcome }: { liveId: string; canModerate?: boolean; showWelcome?: boolean }) {
    return <div data-testid="chat" data-live={liveId} data-moderate={String(canModerate)} data-welcome={String(showWelcome)} />;
  },
}));

vi.mock("@/components/feature/live-room/constants", () => ({ CF_CUSTOMER_CODE: "abc123" }));

const live = { id: "live-1", status: "live" as const, stream_live_input_id: "input-1" };
const WARNING = /OBS está conectado pero el video no llega/;

describe("AdminLivePreview", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("sin señal de OBS no monta el player y avisa que espera", () => {
    render(<AdminLivePreview live={live} obsConnected={false} />);

    expect(screen.queryByTestId("hls-player")).not.toBeInTheDocument();
    expect(screen.getByText("Esperando señal de OBS")).toBeInTheDocument();
  });

  it("con OBS conectado monta el player EN SILENCIO y en modo fluidez", () => {
    render(<AdminLivePreview live={live} obsConnected />);

    const player = screen.getByTestId("hls-player");
    expect(player).toHaveAttribute("data-input", "input-1");
    expect(player).toHaveAttribute("data-muted", "true");
    expect(player).toHaveAttribute("data-latency", "smooth");
    expect(screen.queryByText("Esperando señal de OBS")).not.toBeInTheDocument();
  });

  it("activar el audio es manual y muestra la advertencia del micrófono", () => {
    render(<AdminLivePreview live={live} obsConnected />);
    expect(screen.queryByText(/usa audífonos/)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Activar audio/ }));

    expect(screen.getByTestId("hls-player")).toHaveAttribute("data-muted", "false");
    expect(screen.getByText(/usa audífonos/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Silenciar/ }));
    expect(screen.getByTestId("hls-player")).toHaveAttribute("data-muted", "true");
  });

  it("si OBS se desconecta el player se desmonta y al volver arranca en silencio otra vez", () => {
    const { rerender } = render(<AdminLivePreview live={live} obsConnected />);
    fireEvent.click(screen.getByRole("button", { name: /Activar audio/ }));

    rerender(<AdminLivePreview live={live} obsConnected={false} />);
    expect(screen.queryByTestId("hls-player")).not.toBeInTheDocument();

    rerender(<AdminLivePreview live={live} obsConnected />);
    expect(screen.getByTestId("hls-player")).toHaveAttribute("data-muted", "true");
  });

  it("no hay vista previa si la sala terminó", () => {
    const { container } = render(<AdminLivePreview live={{ ...live, status: "ended" }} obsConnected />);

    expect(container).toBeEmptyDOMElement();
  });

  it("el chat se monta para la sala con moderación y sin mensaje de bienvenida", () => {
    render(<AdminLivePreview live={live} obsConnected={false} />);

    const chat = screen.getByTestId("chat");
    expect(chat).toHaveAttribute("data-live", "live-1");
    expect(chat).toHaveAttribute("data-moderate", "true");
    expect(chat).toHaveAttribute("data-welcome", "false");
  });

  it("ofrece abrir la vista del alumno en una pestaña nueva", () => {
    render(<AdminLivePreview live={live} obsConnected />);

    const link = screen.getByRole("link", { name: /Abrir vista del alumno/ });
    expect(link).toHaveAttribute("href", "/vip-live");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", expect.stringContaining("noopener"));
  });

  describe("plegar y desplegar", () => {
    it("plegado desmonta el player y el chat, y la elección se recuerda", () => {
      const { unmount } = render(<AdminLivePreview live={live} obsConnected />);

      fireEvent.click(screen.getByRole("button", { name: /Ocultar/ }));

      expect(screen.queryByTestId("hls-player")).not.toBeInTheDocument();
      expect(screen.queryByTestId("chat")).not.toBeInTheDocument();
      expect(localStorage.getItem("admin-live-preview-collapsed")).toBe("1");

      // Otra visita al panel: sigue plegado.
      unmount();
      render(<AdminLivePreview live={live} obsConnected />);
      expect(screen.queryByTestId("hls-player")).not.toBeInTheDocument();

      fireEvent.click(screen.getByRole("button", { name: /Mostrar/ }));
      expect(screen.getByTestId("hls-player")).toBeInTheDocument();
    });

    it("funciona aunque localStorage lance", () => {
      vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
        throw new Error("bloqueado");
      });
      vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
        throw new Error("bloqueado");
      });

      render(<AdminLivePreview live={live} obsConnected />);
      expect(screen.getByTestId("hls-player")).toBeInTheDocument();

      fireEvent.click(screen.getByRole("button", { name: /Ocultar/ }));
      expect(screen.queryByTestId("hls-player")).not.toBeInTheDocument();
    });
  });

  describe("cuando el video no llega", () => {
    it("un error fatal muestra el aviso y Reintentar remonta el player", () => {
      render(<AdminLivePreview live={live} obsConnected />);
      expect(playerMounted).toHaveBeenCalledTimes(1);
      expect(screen.queryByRole("alert")).not.toBeInTheDocument();

      fireEvent.click(screen.getByText("simular-fatal"));
      expect(screen.getByRole("alert")).toHaveTextContent(WARNING);
      expect(screen.getByRole("alert")).toHaveTextContent("keyframe 2 s, CBR 6000 kbps");

      fireEvent.click(screen.getByRole("button", { name: /Reintentar/ }));

      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
      expect(playerMounted).toHaveBeenCalledTimes(2);
    });

    it("onRecovered quita el aviso", () => {
      render(<AdminLivePreview live={live} obsConnected />);
      fireEvent.click(screen.getByText("simular-fatal"));
      expect(screen.getByRole("alert")).toBeInTheDocument();

      fireEvent.click(screen.getByText("simular-recovered"));

      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    });

    it("sin empezar a reproducir tras ~20 s muestra el aviso", () => {
      vi.useFakeTimers();
      render(<AdminLivePreview live={live} obsConnected />);

      act(() => {
        vi.advanceTimersByTime(19_000);
      });
      expect(screen.queryByRole("alert")).not.toBeInTheDocument();

      act(() => {
        vi.advanceTimersByTime(1_500);
      });
      expect(screen.getByRole("alert")).toHaveTextContent(WARNING);
    });

    it("si el video empieza a tiempo no hay aviso, y si llega tarde el aviso se retira", () => {
      vi.useFakeTimers();
      render(<AdminLivePreview live={live} obsConnected />);

      fireEvent.click(screen.getByText("simular-playing"));
      act(() => {
        vi.advanceTimersByTime(60_000);
      });
      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    });

    it("un aviso por tardanza desaparece cuando por fin llega la imagen", () => {
      vi.useFakeTimers();
      render(<AdminLivePreview live={live} obsConnected />);
      act(() => {
        vi.advanceTimersByTime(21_000);
      });
      expect(screen.getByRole("alert")).toBeInTheDocument();

      fireEvent.click(screen.getByText("simular-playing"));

      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    });
  });
});
