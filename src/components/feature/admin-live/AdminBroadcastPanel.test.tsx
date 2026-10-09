import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useEffect } from "react";
import { usePreferencesStore } from "@/stores/preferences.store";
import type { ViewerInfo } from "@/types/live";
import type { LiveEvent } from "@/lib/api/stream/lives";
import { AdminBroadcastPanel } from "./AdminBroadcastPanel";

type LiveFixture = Pick<LiveEvent, "id" | "title" | "status" | "is_paused" | "starts_at" | "stream_live_input_id">;

interface MockPlayerProps {
  liveInputId: string;
  muted: boolean;
  latencyMode?: string;
  roomPaused?: boolean;
  resumeKey?: string;
  onPlaying?: () => void;
  onFatalError?: () => void;
  onRecovered?: () => void;
}

// Cuenta montajes reales del player: un `key` nuevo remonta y suma uno.
const playerMounted = vi.fn();

vi.mock("@/components/feature/LiveHLSPlayer", () => ({
  default: function MockPlayer({ liveInputId, muted, latencyMode, roomPaused, resumeKey, onPlaying, onFatalError, onRecovered }: MockPlayerProps) {
    useEffect(() => {
      playerMounted();
    }, []);
    return (
      <div data-testid="hls-player" data-input={liveInputId} data-muted={String(muted)} data-latency={latencyMode} data-room-paused={String(roomPaused)} data-resume-key={resumeKey}>
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

const presenceMock = vi.hoisted(() => ({ viewers: [] as unknown[], totalViewers: 0, hook: vi.fn() }));

vi.mock("@/components/feature/live-room/useLivePresence", () => ({
  useLivePresence: (options: unknown) => {
    presenceMock.hook(options);
    return { viewers: presenceMock.viewers, totalViewers: presenceMock.totalViewers };
  },
}));

vi.mock("@/components/feature/live-room/constants", () => ({ CF_CUSTOMER_CODE: "abc123" }));

const live: LiveFixture = {
  id: "live-1",
  title: "Clase de prueba",
  status: "live",
  is_paused: false,
  starts_at: "2026-10-09T15:00:00.000Z",
  stream_live_input_id: "input-1",
};
const WARNING = /OBS está conectado pero el video no llega/;

const handlers = {
  onStart: vi.fn(),
  onPause: vi.fn(),
  onResume: vi.fn(),
  onFinalize: vi.fn(),
};

interface PanelOverrides {
  live?: Partial<LiveFixture>;
  obsConnected?: boolean;
  obsUnavailable?: boolean;
  isSaving?: boolean;
}

function renderPanel({ live: liveOverrides, obsConnected = true, obsUnavailable = false, isSaving = false }: PanelOverrides = {}) {
  return render(
    <AdminBroadcastPanel
      live={{ ...live, ...liveOverrides }}
      obsConnected={obsConnected}
      obsUnavailable={obsUnavailable}
      isSaving={isSaving}
      {...handlers}
    />
  );
}

describe("AdminBroadcastPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    presenceMock.viewers = [];
    presenceMock.totalViewers = 0;
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("en vivo: monta el player EN SILENCIO y en modo fluidez, el chat y los controles", () => {
    renderPanel();

    const player = screen.getByTestId("hls-player");
    expect(player).toHaveAttribute("data-input", "input-1");
    expect(player).toHaveAttribute("data-muted", "true");
    expect(player).toHaveAttribute("data-latency", "smooth");
    const chat = screen.getByTestId("chat");
    expect(chat).toHaveAttribute("data-live", "live-1");
    expect(chat).toHaveAttribute("data-moderate", "true");
    expect(chat).toHaveAttribute("data-welcome", "false");
    expect(screen.getByText("EN VIVO")).toBeInTheDocument();
    expect(screen.getByText("OBS conectado")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Pausar/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Finalizar clase/ })).toBeInTheDocument();
  });

  it("sala en vivo sin OBS conectado (sondeo caído) igual monta el player", () => {
    renderPanel({ obsConnected: false });

    expect(screen.getByTestId("hls-player")).toBeInTheDocument();
    expect(screen.queryByText("Esperando señal de OBS")).not.toBeInTheDocument();
    expect(screen.getByText("OBS sin señal")).toBeInTheDocument();
  });

  it("con el sondeo apagado muestra que el estado de OBS no está disponible", () => {
    renderPanel({ obsConnected: false, obsUnavailable: true });

    expect(screen.getByText("Estado de OBS no disponible")).toBeInTheDocument();
    expect(screen.queryByText("OBS sin señal")).not.toBeInTheDocument();
  });

  it("programada: sin player ni chat, con el botón de iniciar", () => {
    renderPanel({ live: { status: "scheduled" }, obsConnected: true });

    expect(screen.queryByTestId("hls-player")).not.toBeInTheDocument();
    expect(screen.queryByTestId("chat")).not.toBeInTheDocument();
    expect(screen.getByText("PROGRAMADO")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Iniciar Transmisión/ }));
    expect(handlers.onStart).toHaveBeenCalledTimes(1);
  });

  it("programada sin OBS ofrece Forzar EN VIVO", () => {
    renderPanel({ live: { status: "scheduled" }, obsConnected: false });

    fireEvent.click(screen.getByRole("button", { name: /Forzar EN VIVO/ }));
    expect(handlers.onStart).toHaveBeenCalledTimes(1);
  });

  it("en pausa: muestra el estado y ofrece Reanudar y Finalizar", () => {
    renderPanel({ live: { is_paused: true } });

    expect(screen.getByText("EN PAUSA")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Pausar/ })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Reanudar/ }));
    fireEvent.click(screen.getByRole("button", { name: /Finalizar clase/ }));
    expect(handlers.onResume).toHaveBeenCalledTimes(1);
    expect(handlers.onFinalize).toHaveBeenCalledTimes(1);
  });

  it("Pausar y Finalizar llaman a sus handlers", () => {
    renderPanel();

    fireEvent.click(screen.getByRole("button", { name: /Pausar/ }));
    fireEvent.click(screen.getByRole("button", { name: /Finalizar clase/ }));

    expect(handlers.onPause).toHaveBeenCalledTimes(1);
    expect(handlers.onFinalize).toHaveBeenCalledTimes(1);
  });

  it("mientras se guarda, deshabilita pausar pero deja finalizar", () => {
    renderPanel({ isSaving: true });

    expect(screen.getByRole("button", { name: /Pausar/ })).toBeDisabled();
    expect(screen.getByRole("button", { name: /Finalizar clase/ })).toBeEnabled();
  });

  it("activar el audio es manual y muestra la advertencia del micrófono", () => {
    renderPanel();
    expect(screen.queryByText(/usa audífonos/)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Activar audio/ }));

    expect(screen.getByTestId("hls-player")).toHaveAttribute("data-muted", "false");
    expect(screen.getByText(/usa audífonos/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Silenciar/ }));
    expect(screen.getByTestId("hls-player")).toHaveAttribute("data-muted", "true");
  });

  it("no hay panel si la sala terminó", () => {
    const { container } = renderPanel({ live: { status: "ended" } });

    expect(container).toBeEmptyDOMElement();
  });

  it("ofrece abrir la vista del alumno en una pestaña nueva", () => {
    renderPanel();

    const link = screen.getByRole("link", { name: /Abrir vista del alumno/ });
    expect(link).toHaveAttribute("href", "/vip-live");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", expect.stringContaining("noopener"));
  });

  describe("pausa de la sala", () => {
    const pausedLive = { is_paused: true };
    const OVERLAY = "En pausa — así lo ven los alumnos";

    it("en pausa: el player recibe roomPaused y se muestra el overlay, en silencio", () => {
      renderPanel({ live: pausedLive });

      expect(screen.getByTestId("hls-player")).toHaveAttribute("data-room-paused", "true");
      expect(screen.getByTestId("hls-player")).toHaveAttribute("data-muted", "true");
      expect(screen.getByText(OVERLAY)).toBeInTheDocument();
    });

    it("en vivo no hay overlay y roomPaused es false", () => {
      renderPanel();

      expect(screen.getByTestId("hls-player")).toHaveAttribute("data-room-paused", "false");
      expect(screen.queryByText(OVERLAY)).not.toBeInTheDocument();
    });

    it("Ver señal de OBS: oculta el overlay, reproduce solo la vista previa y muestra el aviso", () => {
      renderPanel({ live: pausedLive });

      fireEvent.click(screen.getByRole("button", { name: /Ver señal de OBS/ }));

      expect(screen.queryByText(OVERLAY)).not.toBeInTheDocument();
      expect(screen.getByTestId("hls-player")).toHaveAttribute("data-room-paused", "false");
      expect(screen.getByTestId("hls-player")).toHaveAttribute("data-muted", "true");
      expect(screen.getByRole("status")).toHaveTextContent("Viendo señal — los alumnos siguen en pausa");
      // La sala sigue pausada para los alumnos.
      expect(screen.getByText("EN PAUSA")).toBeInTheDocument();
    });

    it("Volver restablece el overlay", () => {
      renderPanel({ live: pausedLive });
      fireEvent.click(screen.getByRole("button", { name: /Ver señal de OBS/ }));

      fireEvent.click(screen.getByRole("button", { name: "Volver" }));

      expect(screen.getByText(OVERLAY)).toBeInTheDocument();
      expect(screen.getByTestId("hls-player")).toHaveAttribute("data-room-paused", "true");
      expect(screen.queryByRole("status")).not.toBeInTheDocument();
    });

    it("al reanudar se descarta el espiado, y al pausar de nuevo vuelve el overlay", () => {
      const { rerender } = renderPanel({ live: pausedLive });
      fireEvent.click(screen.getByRole("button", { name: /Ver señal de OBS/ }));
      const props = { obsConnected: true, obsUnavailable: false, isSaving: false, ...handlers };

      rerender(<AdminBroadcastPanel live={{ ...live, is_paused: false }} {...props} />);
      expect(screen.queryByRole("status")).not.toBeInTheDocument();
      expect(screen.getByTestId("hls-player")).toHaveAttribute("data-room-paused", "false");

      rerender(<AdminBroadcastPanel live={{ ...live, is_paused: true }} {...props} />);
      expect(screen.getByText(OVERLAY)).toBeInTheDocument();
      expect(screen.queryByRole("status")).not.toBeInTheDocument();
      expect(screen.getByTestId("hls-player")).toHaveAttribute("data-room-paused", "true");
    });
  });

  describe("espectadores", () => {
    const viewer = (id: string, name: string, plan: ViewerInfo["plan"]): ViewerInfo => ({
      user_id: id,
      full_name: name,
      avatar_url: null,
      plan,
      online_at: "2026-10-09T15:00:00.000Z",
    });

    it("escucha la presencia sin trackearse y solo con la sala al aire", () => {
      renderPanel();
      expect(presenceMock.hook).toHaveBeenLastCalledWith(expect.objectContaining({ liveId: "live-1", enabled: true, observeOnly: true }));

      renderPanel({ live: { status: "scheduled" } });
      expect(presenceMock.hook).toHaveBeenLastCalledWith(expect.objectContaining({ enabled: false, observeOnly: true }));
    });

    it("muestra el total en vivo y en pausa, pero no programada", () => {
      presenceMock.totalViewers = 7;
      const { unmount } = renderPanel();
      expect(screen.getByRole("button", { name: /7 viendo/ })).toHaveTextContent("7 viendo");
      unmount();

      const { unmount: unmountPaused } = renderPanel({ live: { is_paused: true } });
      expect(screen.getByRole("button", { name: /7 viendo/ })).toBeInTheDocument();
      unmountPaused();

      renderPanel({ live: { status: "scheduled" } });
      expect(screen.queryByRole("button", { name: /viendo/ })).not.toBeInTheDocument();
    });

    it("plegado sigue mostrando el contador", () => {
      presenceMock.totalViewers = 3;
      renderPanel();

      fireEvent.click(screen.getByRole("button", { name: /Ocultar/ }));

      expect(screen.queryByTestId("hls-player")).not.toBeInTheDocument();
      expect(screen.getByRole("button", { name: /3 viendo/ })).toBeInTheDocument();
    });

    it("al abrir lista a los registrados y resume a los invitados", async () => {
      presenceMock.viewers = [viewer("u2", "Zoe Mora", "free"), viewer("u1", "Ana Ruiz", "vip")];
      presenceMock.totalViewers = 5;
      renderPanel();

      await userEvent.click(screen.getByRole("button", { name: /5 viendo/ }));

      expect(await screen.findByText("Ana Ruiz")).toBeInTheDocument();
      expect(screen.getByText("Zoe Mora")).toBeInTheDocument();
      expect(screen.getByText("VIP")).toBeInTheDocument();
      expect(screen.getByText(/\+3 invitados/)).toBeInTheDocument();
    });
  });

  describe("modo de latencia de la vista previa", () => {
    const trigger = () => screen.getByRole("combobox", { name: /Modo de latencia/ });

    beforeEach(() => {
      // Radix Select necesita estas APIs, que jsdom no implementa.
      Element.prototype.hasPointerCapture = () => false;
      Element.prototype.setPointerCapture = () => {};
      Element.prototype.releasePointerCapture = () => {};
      Element.prototype.scrollIntoView = () => {};
    });

    async function choose(label: string) {
      await userEvent.click(trigger());
      await userEvent.click(await screen.findByRole("option", { name: label }));
    }

    it("arranca en Fluidez y explica que es la vista del alumno", () => {
      renderPanel();

      expect(trigger()).toHaveTextContent("Fluidez");
      expect(trigger()).toHaveAttribute("title", "Así lo ve un alumno con este modo.");
      expect(screen.getByText("Así lo ve un alumno con este modo.")).toBeInTheDocument();
      expect(screen.getByTestId("hls-player")).toHaveAttribute("data-latency", "smooth");
    });

    it("Baja latencia y Clase completa llegan al player, sin remontarlo y conservando el silencio", async () => {
      renderPanel();
      expect(playerMounted).toHaveBeenCalledTimes(1);

      await choose("Baja latencia");
      expect(screen.getByTestId("hls-player")).toHaveAttribute("data-latency", "low");

      await choose("Clase completa");
      expect(screen.getByTestId("hls-player")).toHaveAttribute("data-latency", "dvr");
      expect(screen.getByTestId("hls-player")).toHaveAttribute("data-muted", "true");
      expect(playerMounted).toHaveBeenCalledTimes(1);
    });

    it("cambiar de modo no altera el estado del audio activado", async () => {
      renderPanel();
      fireEvent.click(screen.getByRole("button", { name: /Activar audio/ }));

      await choose("Baja latencia");

      expect(screen.getByTestId("hls-player")).toHaveAttribute("data-muted", "false");
    });

    it("en Clase completa no pasa resumeKey (no pisa la posición del alumno)", async () => {
      renderPanel();
      await choose("Clase completa");

      expect(screen.getByTestId("hls-player")).not.toHaveAttribute("data-resume-key");
    });

    it("no lee ni escribe la preferencia de latencia del alumno", async () => {
      usePreferencesStore.setState({ liveLatencyMode: "low" });
      renderPanel();
      // El panel arranca en Fluidez aunque el alumno prefiera otro modo.
      expect(screen.getByTestId("hls-player")).toHaveAttribute("data-latency", "smooth");

      await choose("Clase completa");

      expect(usePreferencesStore.getState().liveLatencyMode).toBe("low");
    });

    it("no se muestra plegado ni programado", () => {
      renderPanel({ live: { status: "scheduled" } });
      expect(screen.queryByRole("combobox", { name: /Modo de latencia/ })).not.toBeInTheDocument();
    });

    it("no se muestra con el panel plegado", () => {
      renderPanel();
      fireEvent.click(screen.getByRole("button", { name: /Ocultar/ }));
      expect(screen.queryByRole("combobox", { name: /Modo de latencia/ })).not.toBeInTheDocument();
    });
  });

  describe("plegar y desplegar", () => {
    it("plegado desmonta el player y el chat, y la elección se recuerda", () => {
      const { unmount } = render(<AdminBroadcastPanel live={live} obsConnected obsUnavailable={false} isSaving={false} {...handlers} />);

      fireEvent.click(screen.getByRole("button", { name: /Ocultar/ }));

      expect(screen.queryByTestId("hls-player")).not.toBeInTheDocument();
      expect(screen.queryByTestId("chat")).not.toBeInTheDocument();
      // Los controles siguen a la vista aunque el panel esté plegado.
      expect(screen.getByRole("button", { name: /Pausar/ })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /Finalizar clase/ })).toBeInTheDocument();
      expect(localStorage.getItem("admin-live-preview-collapsed")).toBe("1");

      // Otra visita al panel: sigue plegado.
      unmount();
      render(<AdminBroadcastPanel live={live} obsConnected obsUnavailable={false} isSaving={false} {...handlers} />);
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

      render(<AdminBroadcastPanel live={live} obsConnected obsUnavailable={false} isSaving={false} {...handlers} />);
      expect(screen.getByTestId("hls-player")).toBeInTheDocument();

      fireEvent.click(screen.getByRole("button", { name: /Ocultar/ }));
      expect(screen.queryByTestId("hls-player")).not.toBeInTheDocument();
    });
  });

  describe("cuando el video no llega", () => {
    it("un error fatal muestra el aviso y Reintentar remonta el player", () => {
      render(<AdminBroadcastPanel live={live} obsConnected obsUnavailable={false} isSaving={false} {...handlers} />);
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
      render(<AdminBroadcastPanel live={live} obsConnected obsUnavailable={false} isSaving={false} {...handlers} />);
      fireEvent.click(screen.getByText("simular-fatal"));
      expect(screen.getByRole("alert")).toBeInTheDocument();

      fireEvent.click(screen.getByText("simular-recovered"));

      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    });

    it("sin empezar a reproducir tras ~20 s muestra el aviso", () => {
      vi.useFakeTimers();
      render(<AdminBroadcastPanel live={live} obsConnected obsUnavailable={false} isSaving={false} {...handlers} />);

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
      render(<AdminBroadcastPanel live={live} obsConnected obsUnavailable={false} isSaving={false} {...handlers} />);

      fireEvent.click(screen.getByText("simular-playing"));
      act(() => {
        vi.advanceTimersByTime(60_000);
      });
      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    });

    it("un aviso por tardanza desaparece cuando por fin llega la imagen", () => {
      vi.useFakeTimers();
      render(<AdminBroadcastPanel live={live} obsConnected obsUnavailable={false} isSaving={false} {...handlers} />);
      act(() => {
        vi.advanceTimersByTime(21_000);
      });
      expect(screen.getByRole("alert")).toBeInTheDocument();

      fireEvent.click(screen.getByText("simular-playing"));

      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    });
  });
});
