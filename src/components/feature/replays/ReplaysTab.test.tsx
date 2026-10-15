import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { ReplaysTab } from "./ReplaysTab";
import { listSchoolReplays, type SchoolReplay } from "@/lib/api/stream/replays";
import type { LiveEvent } from "@/lib/api/stream/lives";

vi.mock("@/lib/api/stream/replays", () => ({ listSchoolReplays: vi.fn() }));

const list = vi.mocked(listSchoolReplays);

function replay(overrides: Partial<SchoolReplay> = {}): SchoolReplay {
  return {
    id: "r1",
    title: "Clase de ahorro",
    description: null,
    starts_at: "2026-10-03T15:00:00Z",
    background_image_url: null,
    recording_duration_seconds: 4800,
    replay_visibility: "paid",
    can_watch: true,
    recording_storage: "stream",
    recording_stream_uid: "uid",
    ...overrides,
  };
}

const activeLive = {
  id: "live-1",
  title: "Clase en vivo",
  status: "live",
  starts_at: "2026-10-15T15:00:00Z",
  allowed_plans: ["vip"],
} as unknown as LiveEvent;

const renderTab = (props: Partial<React.ComponentProps<typeof ReplaysTab>> = {}) =>
  render(
    <MemoryRouter>
      <ReplaysTab plan="free" role="student" activeLive={null} {...props} />
    </MemoryRouter>,
  );

describe("ReplaysTab", () => {
  beforeEach(() => vi.clearAllMocks());

  it("shows a loading state first", () => {
    list.mockReturnValue(new Promise(() => {}));
    renderTab();
    expect(screen.getByRole("status", { name: "Cargando grabaciones" })).toBeInTheDocument();
  });

  it("shows the empty state", async () => {
    list.mockResolvedValue([]);
    renderTab();
    expect(await screen.findByText("Todavía no hay grabaciones disponibles")).toBeInTheDocument();
  });

  it("links playable recordings to the viewer", async () => {
    list.mockResolvedValue([replay()]);
    renderTab({ plan: "individual" });
    const link = await screen.findByRole("link", { name: /Ver grabación: Clase de ahorro/ });
    expect(link).toHaveAttribute("href", "/grabaciones/r1");
    expect(screen.getByText("1 h 20 min")).toBeInTheDocument();
  });

  it("shows locked recordings with a call to action to the plans page", async () => {
    list.mockResolvedValue([replay({ can_watch: false, recording_stream_uid: null })]);
    renderTab();
    expect(await screen.findByText("Disponible en planes Individual y VIP")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Ver planes" })).toHaveAttribute("href", "/planes");
    expect(screen.queryByRole("link", { name: /Ver grabación/ })).not.toBeInTheDocument();
  });

  it("shows an error state and retries", async () => {
    list.mockRejectedValueOnce(new Error("boom")).mockResolvedValueOnce([replay()]);
    renderTab({ plan: "vip" });
    expect(await screen.findByRole("alert")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Reintentar" }));
    await waitFor(() => expect(screen.getByRole("link", { name: /Ver grabación/ })).toBeInTheDocument());
    expect(list).toHaveBeenCalledTimes(2);
  });

  it("lets the user enter the active live when their plan is allowed", async () => {
    list.mockResolvedValue([]);
    renderTab({ plan: "vip", activeLive });
    const link = await screen.findByRole("link", { name: /Entrar a la sala/ });
    expect(link).toHaveAttribute("href", "/vip-live");
  });

  it("lets admins enter regardless of allowed_plans", async () => {
    list.mockResolvedValue([]);
    renderTab({ plan: "free", role: "admin", activeLive });
    expect(await screen.findByRole("link", { name: /Entrar a la sala/ })).toBeInTheDocument();
  });

  it("shows the active live as information when the plan is not allowed", async () => {
    list.mockResolvedValue([]);
    renderTab({ plan: "free", activeLive });
    expect(await screen.findByText("Clase en vivo")).toBeInTheDocument();
    expect(screen.getByText("Esta transmisión es para otros planes.")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Entrar a la sala/ })).not.toBeInTheDocument();
  });
});
