import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import VIPLiveRoom from "./VIPLiveRoom";
import { fetchActiveLive, fetchLiveForRoom } from "@/lib/api/stream/lives";
import { useAuthStore } from "@/stores/auth.store";
import type { LiveEvent } from "@/lib/api/stream/lives";
import type { User } from "@/types/user";

const channel = { on: vi.fn(), subscribe: vi.fn() };

vi.mock("@/lib/supabase", () => ({
  supabase: { channel: vi.fn(() => channel), removeChannel: vi.fn() },
}));

vi.mock("@/lib/api/stream/lives", () => ({
  fetchActiveLive: vi.fn(),
  fetchLiveForRoom: vi.fn(),
  checkLiveInputStatus: vi.fn(() => Promise.resolve({ connected: false, isError: false, disabled: true })),
}));

// La presentación de la sala tiene sus propios tests: acá solo importa qué sala recibe.
vi.mock("@/components/feature/live-room/LiveRoom", () => ({
  LiveRoom: ({ live }: { live: LiveEvent }) => <div data-testid="room">{live.title}</div>,
}));

const activeLive = fetchActiveLive as unknown as ReturnType<typeof vi.fn>;
const liveForRoom = fetchLiveForRoom as unknown as ReturnType<typeof vi.fn>;
const student = { id: "user-1", fullName: "Alumno", plan: "vip" } as User;
const clase = { id: "live-1", title: "Clase de inversión", status: "live", allowed_plans: ["vip"], stream_live_input_id: null } as unknown as LiveEvent;

const renderRoom = () => render(<MemoryRouter><VIPLiveRoom /></MemoryRouter>);

describe("VIPLiveRoom — errores de carga (F16)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    channel.on.mockReturnValue(channel);
    channel.subscribe.mockReturnValue(channel);
    useAuthStore.setState({ user: student, token: "t" });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("si la primera carga falla, lo dice: no muestra 'No hay eventos programados'", async () => {
    activeLive.mockRejectedValue(new TypeError("Failed to fetch"));
    renderRoom();

    expect(await screen.findByText("No pudimos cargar la sala")).toBeInTheDocument();
    expect(screen.queryByText("No hay eventos programados")).not.toBeInTheDocument();
  });

  it("Reintentar vuelve a pedir la sala", async () => {
    activeLive.mockRejectedValueOnce(new TypeError("Failed to fetch")).mockResolvedValueOnce(clase);
    renderRoom();

    fireEvent.click(await screen.findByRole("button", { name: "Reintentar" }));

    expect(await screen.findByTestId("room")).toHaveTextContent("Clase de inversión");
  });

  it("sin error y sin sala activa sigue diciendo que no hay eventos", async () => {
    activeLive.mockResolvedValue(null);
    renderRoom();

    expect(await screen.findByText("No hay eventos programados")).toBeInTheDocument();
  });

  it("un poll que falla conserva la sala en pantalla", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    activeLive.mockResolvedValue(clase);
    liveForRoom.mockRejectedValue(new TypeError("Failed to fetch"));
    renderRoom();
    expect(await screen.findByTestId("room")).toBeInTheDocument();

    await act(async () => {
      vi.advanceTimersByTime(3100);
    });

    expect(liveForRoom).toHaveBeenCalled();
    expect(screen.getByTestId("room")).toHaveTextContent("Clase de inversión");
  });

  it("tras un error de carga, el polling recupera la sala solo", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    activeLive.mockRejectedValue(new TypeError("Failed to fetch"));
    liveForRoom.mockResolvedValue(clase);
    renderRoom();
    expect(await screen.findByText("No pudimos cargar la sala")).toBeInTheDocument();

    await act(async () => {
      vi.advanceTimersByTime(3100);
    });

    expect(await screen.findByTestId("room")).toBeInTheDocument();
  });
});
