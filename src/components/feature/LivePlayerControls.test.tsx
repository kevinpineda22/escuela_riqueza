import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, act, within } from "@testing-library/react";
import LivePlayerControls from "./LivePlayerControls";
import type { LiveHLSPlayerHandle, QualityLevel } from "./LiveHLSPlayer";

// Sin animaciones: lo que se prueba es CUÁNDO se oculta la barra, no el fade.
// Con motion real, jsdom deja la barra a mitad de la salida.
vi.mock("motion/react", async () => {
  const React = await import("react");
  const ANIMATION_PROPS = ["initial", "animate", "exit", "transition", "whileHover", "whileTap"];
  const motion = new Proxy({}, {
    get: (_target, tag: string) =>
      React.forwardRef((props: Record<string, unknown>, ref) =>
        React.createElement(tag, { ...Object.fromEntries(Object.entries(props).filter(([k]) => !ANIMATION_PROPS.includes(k))), ref })
      ),
  });
  return { motion, AnimatePresence: ({ children }: { children: React.ReactNode }) => children };
});

// Video mínimo: el filo del vivo sale de `seekable.end`, el atraso de `currentTime`.
function fakePlayer(currentTime = 92, liveEdge = 100) {
  const video = {
    currentTime,
    paused: false,
    seekable: { length: 1, start: () => 0, end: () => liveEdge },
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    play: vi.fn(() => Promise.resolve()),
  } as unknown as HTMLVideoElement;
  return { current: { video, getLiveSyncPosition: () => null } as unknown as LiveHLSPlayerHandle };
}

const levels: QualityLevel[] = [
  { index: 0, height: 360, bitrate: 800_000, label: "360p" },
  { index: 2, height: 720, bitrate: 2_500_000, label: "720p" },
] as QualityLevel[];

function renderControls(props: Partial<Parameters<typeof LivePlayerControls>[0]> = {}) {
  const handlers = { onTogglePlay: vi.fn(), onToggleMute: vi.fn(), onSelectLevel: vi.fn(), onSelectLatencyMode: vi.fn() };
  render(
    <LivePlayerControls
      playerRef={fakePlayer()}
      isPlaying
      isBuffering={false}
      isMuted={false}
      levels={levels}
      currentLevel={-1}
      activeLevel={2}
      latencyMode="smooth"
      {...handlers}
      {...props}
    />
  );
  return handlers;
}

// La barra se reconoce por su botón de pantalla completa. `hidden: true`: con
// el menú abierto (modal), Radix marca lo de afuera con aria-hidden.
const bar = () => screen.queryByRole("button", { name: "Pantalla completa", hidden: true });

describe("LivePlayerControls", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("con Auto muestra la calidad que se está usando, sin dejar de ser Auto (F08)", () => {
    renderControls({ currentLevel: -1, activeLevel: 2 });
    expect(screen.getByRole("button", { name: "Calidad de video" })).toHaveTextContent("Auto · 720p");
  });

  it("con una calidad elegida a mano muestra esa (F08)", () => {
    renderControls({ currentLevel: 0, activeLevel: 0 });
    expect(screen.getByRole("button", { name: "Calidad de video" })).toHaveTextContent("360p");
  });

  it("el botón de sonido se nombra por la acción (F07)", () => {
    renderControls({ isMuted: true });
    expect(screen.getByRole("button", { name: "Activar sonido" })).toBeInTheDocument();
  });

  it("al filo del vivo dice EN VIVO (F43)", () => {
    renderControls({ playerRef: fakePlayer(92, 100) });
    act(() => { vi.advanceTimersByTime(1100); });
    expect(screen.getByRole("button", { name: "En vivo" })).toBeInTheDocument();
  });

  it("atrasado ofrece Volver al vivo, con el atraso a la vista (F43)", () => {
    renderControls({ playerRef: fakePlayer(50, 100) });
    act(() => { vi.advanceTimersByTime(1100); });
    const goLive = screen.getByRole("button", { name: /Volver al vivo \(vas 50 s atrasado\)/ });
    expect(goLive).toHaveTextContent("VOLVER AL VIVO");
    expect(goLive).toHaveTextContent("-50 s");
  });

  it("reproduciendo y sin uso, la barra se oculta a los 3 s", () => {
    renderControls();
    expect(bar()).toBeInTheDocument();
    act(() => { vi.advanceTimersByTime(3100); });
    expect(bar()).not.toBeInTheDocument();
  });

  it("con el menú de ajustes abierto, la barra no se oculta (F05)", () => {
    renderControls();
    fireEvent.keyDown(screen.getByRole("button", { name: "Calidad de video" }), { key: "Enter" });
    expect(screen.getByRole("menu")).toBeInTheDocument();

    act(() => { vi.advanceTimersByTime(5000); });

    expect(bar()).toBeInTheDocument();
  });

  it("con el dedo, tocar el video muestra la barra pero NO pausa (F03)", () => {
    const { onTogglePlay } = renderControls();
    const surface = screen.getAllByRole("button", { name: "Pausar" })[0];

    fireEvent.pointerDown(surface, { pointerType: "touch" });
    fireEvent.click(surface, { detail: 1 });

    expect(onTogglePlay).not.toHaveBeenCalled();
  });

  it("con el mouse, clic en el video pausa (F03)", () => {
    const { onTogglePlay } = renderControls();
    const surface = screen.getAllByRole("button", { name: "Pausar" })[0];

    fireEvent.pointerDown(surface, { pointerType: "mouse" });
    fireEvent.click(surface, { detail: 1 });

    expect(onTogglePlay).toHaveBeenCalledTimes(1);
  });
});

describe("LivePlayerControls — botón Segundo plano", () => {
  const original = Object.getOwnPropertyDescriptor(Document.prototype, "pictureInPictureEnabled");

  beforeEach(() => {
    vi.useFakeTimers();
    // jsdom no implementa Picture-in-Picture: sin esto el botón no se renderiza.
    Object.defineProperty(document, "pictureInPictureEnabled", { configurable: true, value: true });
  });

  afterEach(() => {
    vi.useRealTimers();
    if (original) Object.defineProperty(Document.prototype, "pictureInPictureEnabled", original);
    delete (document as unknown as Record<string, unknown>).pictureInPictureEnabled;
  });

  it("muestra el texto 'Segundo plano', no solo un ícono", () => {
    renderControls();
    const btn = screen.getByRole("button", { name: /segundo plano/i, hidden: true });
    expect(btn.textContent?.replace(/\s+/g, " ").trim()).toMatch(/segundo plano/i);
  });

  it("atrasado: 'AL VIVO' corto en celular y la frase completa en pantallas grandes", () => {
    renderControls({ playerRef: fakePlayer(50, 100) });
    act(() => { vi.advanceTimersByTime(1100); });
    const goLive = screen.getByRole("button", { name: /Volver al vivo \(vas 50 s atrasado\)/, hidden: true });
    // En celular "VOLVER AL VIVO -50 s" se partía en dos renglones: la versión corta
    // solo se muestra bajo el breakpoint sm y la completa desde sm en adelante.
    const corta = within(goLive).getByText("AL VIVO");
    const completa = within(goLive).getByText("VOLVER AL VIVO");
    expect(corta.className).toContain("sm:hidden");
    expect(completa.className).toContain("hidden");
    expect(completa.className).toContain("sm:inline");
  });
});
