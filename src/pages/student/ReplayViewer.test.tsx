import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import ReplayViewer from "./ReplayViewer";
import { getSchoolReplay, type SchoolReplay } from "@/lib/api/stream/replays";

vi.mock("@/lib/api/stream/replays", () => ({ getSchoolReplay: vi.fn() }));
vi.mock("@/components/layout/Header", () => ({ default: () => <header /> }));
vi.mock("@/components/layout/Footer", () => ({ default: () => <footer /> }));
vi.mock("@/components/feature/RecordingPlayer", () => ({
  default: ({ live, trackProgress }: { live: { id: string }; trackProgress?: boolean }) => (
    <div data-testid="player" data-id={live.id} data-track={String(Boolean(trackProgress))} />
  ),
}));

const get = vi.mocked(getSchoolReplay);

const base: SchoolReplay = {
  id: "r1",
  title: "Clase de ahorro",
  description: "Descripción de la clase",
  starts_at: "2026-10-03T15:00:00Z",
  background_image_url: null,
  recording_duration_seconds: 3600,
  replay_visibility: "paid",
  can_watch: true,
  recording_storage: "r2",
  recording_stream_uid: null,
};

const renderViewer = () =>
  render(
    <MemoryRouter initialEntries={["/grabaciones/r1"]}>
      <Routes>
        <Route path="/grabaciones/:liveId" element={<ReplayViewer />} />
      </Routes>
    </MemoryRouter>,
  );

describe("ReplayViewer", () => {
  beforeEach(() => vi.clearAllMocks());

  it("plays the recording when the user can watch it", async () => {
    get.mockResolvedValue(base);
    renderViewer();
    expect(await screen.findByTestId("player")).toHaveAttribute("data-id", "r1");
    expect(screen.getByTestId("player")).toHaveAttribute("data-track", "true");
    expect(screen.getByRole("heading", { name: "Clase de ahorro" })).toBeInTheDocument();
    expect(screen.getByText("Descripción de la clase")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Volver a grabaciones/ })).toHaveAttribute("href", "/dashboard?tab=grabaciones");
  });

  it("shows the locked state without a player when can_watch is false", async () => {
    get.mockResolvedValue({ ...base, can_watch: false });
    renderViewer();
    expect(await screen.findByText(/disponible en los planes Individual y VIP/)).toBeInTheDocument();
    expect(screen.queryByTestId("player")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Ver planes" })).toHaveAttribute("href", "/planes");
  });

  it("shows a not-found state when there is no row", async () => {
    get.mockResolvedValue(null);
    renderViewer();
    expect(await screen.findByText("Grabación no encontrada")).toBeInTheDocument();
    expect(screen.queryByTestId("player")).not.toBeInTheDocument();
  });

  it("shows an error state when the request fails", async () => {
    get.mockRejectedValue(new Error("boom"));
    renderViewer();
    expect(await screen.findByText("No se pudo cargar la grabación")).toBeInTheDocument();
  });
});
