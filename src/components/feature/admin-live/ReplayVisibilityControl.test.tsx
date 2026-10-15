import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ReplayVisibilityControl } from "./ReplayVisibilityControl";
import { setLiveReplayVisibility, type LiveEvent } from "@/lib/api/stream/lives";
import { toast } from "@/components/ui/toaster";

vi.mock("@/lib/api/stream/lives", () => ({ setLiveReplayVisibility: vi.fn() }));
vi.mock("@/components/ui/toaster", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

const setVisibility = vi.mocked(setLiveReplayVisibility);

function makeLive(overrides: Partial<LiveEvent> = {}): LiveEvent {
  return {
    id: "live-1",
    recording_stream_uid: "uid-1",
    recording_storage: "stream",
    recording_r2_key: null,
    replay_visibility: "hidden",
    ...overrides,
  } as LiveEvent;
}

describe("ReplayVisibilityControl", () => {
  beforeEach(() => vi.clearAllMocks());

  it("marks the current option and shows its helper text", () => {
    render(<ReplayVisibilityControl live={makeLive({ replay_visibility: "paid" })} onUpdated={vi.fn()} />);
    expect(screen.getByRole("radio", { name: "Planes pagos" })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByText(/Free la ven con candado/)).toBeInTheDocument();
  });

  it("shows the new title and subtitle", () => {
    render(<ReplayVisibilityControl live={makeLive()} onUpdated={vi.fn()} />);
    expect(screen.getByText("¿Quién ve esta grabación?")).toBeInTheDocument();
    expect(screen.getByText("Aplica en «En vivo y grabaciones» y en el link público.")).toBeInTheDocument();
    expect(screen.getByText("Nadie la ve, ni en la escuela ni por el link público.")).toBeInTheDocument();
  });

  it("hints to enable the public link when visibility is all and the link is off", () => {
    render(<ReplayVisibilityControl live={makeLive({ replay_visibility: "all", is_public: false })} onUpdated={vi.fn()} />);
    expect(screen.getByText(/cualquier persona con el link público/)).toBeInTheDocument();
    expect(screen.getByText("Activa el link público para compartirla fuera de la escuela.")).toBeInTheDocument();
  });

  it("omits the public link hint when the link is already on or visibility is not all", () => {
    const { rerender } = render(
      <ReplayVisibilityControl live={makeLive({ replay_visibility: "all", is_public: true })} onUpdated={vi.fn()} />,
    );
    expect(screen.queryByText(/Activa el link público/)).not.toBeInTheDocument();
    rerender(<ReplayVisibilityControl live={makeLive({ replay_visibility: "paid", is_public: false })} onUpdated={vi.fn()} />);
    expect(screen.queryByText(/Activa el link público/)).not.toBeInTheDocument();
  });

  it("updates optimistically and then with the server result", async () => {
    const live = makeLive();
    const server = { ...live, replay_visibility: "all" } as LiveEvent;
    setVisibility.mockResolvedValue(server);
    const onUpdated = vi.fn();
    render(<ReplayVisibilityControl live={live} onUpdated={onUpdated} />);

    await userEvent.click(screen.getByRole("radio", { name: "Todos los planes" }));

    await waitFor(() => expect(onUpdated).toHaveBeenCalledTimes(2));
    expect(onUpdated.mock.calls[0][0].replay_visibility).toBe("all");
    expect(onUpdated.mock.calls[1][0]).toBe(server);
    expect(setVisibility).toHaveBeenCalledWith("live-1", "all");
  });

  it("rolls back and shows a toast when saving fails", async () => {
    const live = makeLive();
    setVisibility.mockRejectedValue(new Error("denied"));
    const onUpdated = vi.fn();
    render(<ReplayVisibilityControl live={live} onUpdated={onUpdated} />);

    await userEvent.click(screen.getByRole("radio", { name: "Planes pagos" }));

    await waitFor(() => expect(toast.error).toHaveBeenCalled());
    expect(onUpdated).toHaveBeenLastCalledWith(live);
  });

  it("is disabled with a hint when the live has no recording", async () => {
    const live = makeLive({ recording_stream_uid: null, recording_storage: null });
    render(<ReplayVisibilityControl live={live} onUpdated={vi.fn()} />);
    expect(screen.getByRole("radio", { name: "Todos los planes" })).toBeDisabled();
    expect(screen.getByText("Vincula una grabación para mostrarla a los alumnos")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("radio", { name: "Planes pagos" }));
    expect(setVisibility).not.toHaveBeenCalled();
  });

  it("does nothing when clicking the already selected option", async () => {
    render(<ReplayVisibilityControl live={makeLive()} onUpdated={vi.fn()} />);
    await userEvent.click(screen.getByRole("radio", { name: "Oculta" }));
    expect(setVisibility).not.toHaveBeenCalled();
  });
});
