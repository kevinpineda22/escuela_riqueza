import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { LiveIntroOverlay } from "./LiveIntroOverlay";
import { usePrefersReducedMotion } from "@/hooks/useMediaQuery";
import { usePreferencesStore } from "@/stores/preferences.store";

vi.mock("@/hooks/useMediaQuery", () => ({ usePrefersReducedMotion: vi.fn() }));

const reduced = usePrefersReducedMotion as unknown as ReturnType<typeof vi.fn>;

describe("LiveIntroOverlay (F14)", () => {
  beforeEach(() => {
    reduced.mockReturnValue(false);
    usePreferencesStore.setState({ animationsEnabled: true });
  });

  it("al pasar a en vivo muestra la intro, y se puede saltar", async () => {
    render(<LiveIntroOverlay liveId="live-1" status="live" />);
    expect(screen.getByText("Conectando señal")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Saltar" }));

    await waitFor(() => expect(screen.queryByText("Conectando señal")).not.toBeInTheDocument());
  });

  it("no aparece si el sistema pide menos movimiento", () => {
    reduced.mockReturnValue(true);
    render(<LiveIntroOverlay liveId="live-1" status="live" />);
    expect(screen.queryByText("Conectando señal")).not.toBeInTheDocument();
  });

  it("no aparece si el alumno apagó las animaciones", () => {
    usePreferencesStore.setState({ animationsEnabled: false });
    render(<LiveIntroOverlay liveId="live-1" status="live" />);
    expect(screen.queryByText("Conectando señal")).not.toBeInTheDocument();
  });

  it("no aparece mientras la sala está programada", () => {
    render(<LiveIntroOverlay liveId="live-1" status="scheduled" />);
    expect(screen.queryByText("Conectando señal")).not.toBeInTheDocument();
  });
});
