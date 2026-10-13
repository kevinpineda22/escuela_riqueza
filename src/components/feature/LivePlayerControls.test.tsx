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
function fakePlayer(currentTime = 92, liveEdge = 100, syncPosition: number | null = null, paused = false) {
  // Contenedor real: los atajos de teclado se escuchan en el padre del video.
  const container = document.createElement("div");
  container.tabIndex = 0;
  document.body.appendChild(container);
  const video = {
    currentTime,
    paused,
    seekable: { length: 1, start: () => 0, end: () => liveEdge },
    parentElement: container,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    play: vi.fn(() => Promise.resolve()),
  } as unknown as HTMLVideoElement;
  const handle = {
    video,
    getLiveSyncPosition: () => syncPosition,
    getSeekableRange: () => ({ start: 0, end: liveEdge }),
    goLive: vi.fn(),
    seekBy: vi.fn(),
    seekTo: vi.fn(),
  };
  return { current: handle as unknown as LiveHLSPlayerHandle, handle, container };
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

  it("el atraso se sigue actualizando con el video en pausa", () => {
    const player = fakePlayer(50, 100, null, true);
    renderControls({ playerRef: player, isPlaying: false });
    act(() => { vi.advanceTimersByTime(1100); });
    expect(screen.getByRole("button", { name: /Volver al vivo/ })).toHaveTextContent("−0:50");
    // El filo avanza mientras el video sigue quieto: el atraso crece.
    (player.handle.video as unknown as { seekable: unknown }).seekable = { length: 1, start: () => 0, end: () => 160 };
    act(() => { vi.advanceTimersByTime(1000); });
    expect(screen.getByRole("button", { name: /Volver al vivo/ })).toHaveTextContent("−1:50");
  });

  it("Volver al vivo usa la operación única del player (goLive)", () => {
    const player = fakePlayer(50, 100);
    renderControls({ playerRef: player });
    act(() => { vi.advanceTimersByTime(1100); });
    fireEvent.click(screen.getByRole("button", { name: /Volver al vivo/ }));
    expect(player.handle.goLive).toHaveBeenCalledTimes(1);
  });

  it("Clase completa: retroceder y adelantar 10 s", () => {
    const player = fakePlayer(50, 100);
    renderControls({ playerRef: player, latencyMode: "dvr" });
    fireEvent.click(screen.getByRole("button", { name: "Retroceder 10 segundos" }));
    fireEvent.click(screen.getByRole("button", { name: "Adelantar 10 segundos" }));
    expect(player.handle.seekBy).toHaveBeenNthCalledWith(1, -10);
    expect(player.handle.seekBy).toHaveBeenNthCalledWith(2, 10);
  });

  it("Clase normal no muestra los saltos de 10 s", () => {
    renderControls({ latencyMode: "smooth" });
    expect(screen.queryByRole("button", { name: "Retroceder 10 segundos" })).not.toBeInTheDocument();
  });

  it("Clase completa: la barra de tiempo se lee con el atraso", () => {
    const player = fakePlayer(25, 100);
    renderControls({ playerRef: player, latencyMode: "dvr" });
    act(() => { vi.advanceTimersByTime(1100); });
    expect(screen.getByRole("slider", { name: "Posición en la clase" })).toHaveAttribute(
      "aria-valuetext",
      "25 segundos de 1 minuto 40 segundos, 1 minuto 15 segundos detrás del directo",
    );
  });

  it("Escape cancela el arrastre sin buscar", () => {
    const player = fakePlayer(25, 100);
    renderControls({ playerRef: player, latencyMode: "dvr" });
    act(() => { vi.advanceTimersByTime(1100); });
    const slider = screen.getByRole("slider", { name: "Posición en la clase" });
    fireEvent.change(slider, { target: { value: "5" } });
    fireEvent.keyDown(slider, { key: "Escape" });
    fireEvent.keyUp(slider, { key: "Escape" });
    fireEvent.blur(slider);
    expect(player.handle.seekTo).not.toHaveBeenCalled();
  });

  it("atajos con el foco en el reproductor: K pausa, M silencia, flechas ±10 s en Clase completa", () => {
    const player = fakePlayer(50, 100);
    const handlers = renderControls({ playerRef: player, latencyMode: "dvr" });
    fireEvent.keyDown(player.container, { key: "k" });
    fireEvent.keyDown(player.container, { key: "m" });
    fireEvent.keyDown(player.container, { key: "ArrowLeft" });
    expect(handlers.onTogglePlay).toHaveBeenCalledTimes(1);
    expect(handlers.onToggleMute).toHaveBeenCalledTimes(1);
    expect(player.handle.seekBy).toHaveBeenCalledWith(-10);
  });

  it("los atajos no tocan lo que se escribe en un campo", () => {
    const player = fakePlayer(50, 100);
    const input = document.createElement("input");
    player.container.appendChild(input);
    const handlers = renderControls({ playerRef: player, latencyMode: "dvr" });
    fireEvent.keyDown(input, { key: "k" });
    fireEvent.keyDown(input, { key: " " });
    expect(handlers.onTogglePlay).not.toHaveBeenCalled();
  });

  it("los atajos no se disparan con el foco dentro del menú de ajustes", () => {
    const player = fakePlayer(50, 100);
    const menu = document.createElement("div");
    menu.setAttribute("role", "menu");
    const item = document.createElement("div");
    item.setAttribute("role", "menuitem");
    menu.appendChild(item);
    player.container.appendChild(menu);
    const handlers = renderControls({ playerRef: player, latencyMode: "dvr" });
    for (const key of ["k", " ", "m", "f", "ArrowLeft", "ArrowRight"]) fireEvent.keyDown(item, { key });
    fireEvent.keyDown(menu, { key: "ArrowLeft" });
    expect(handlers.onTogglePlay).not.toHaveBeenCalled();
    expect(handlers.onToggleMute).not.toHaveBeenCalled();
    expect(player.handle.seekBy).not.toHaveBeenCalled();
    // Fuera del menú siguen funcionando.
    fireEvent.keyDown(player.container, { key: "k" });
    expect(handlers.onTogglePlay).toHaveBeenCalledTimes(1);
  });

  it("tras Reintentar (otro video) los listeners se enganchan al nodo nuevo", () => {
    const first = fakePlayer(50, 100);
    const handlers = { onTogglePlay: vi.fn(), onToggleMute: vi.fn(), onSelectLevel: vi.fn(), onSelectLatencyMode: vi.fn() };
    const props = { isPlaying: true, isBuffering: false, isMuted: false, levels, currentLevel: -1, latencyMode: "dvr" as const, ...handlers };
    const { rerender } = render(<LivePlayerControls playerRef={first} mediaKey={0} {...props} />);
    const second = fakePlayer(50, 100);
    // El ref es el mismo objeto; cambia el video que apunta (remontaje por `key`).
    (first as { current: LiveHLSPlayerHandle }).current = second.current;
    rerender(<LivePlayerControls playerRef={first} mediaKey={1} {...props} />);
    const events = vi.mocked(second.handle.video.addEventListener).mock.calls.map(([evt]) => evt);
    expect(events).toEqual(expect.arrayContaining(["seeking", "timeupdate", "enterpictureinpicture"]));
  });

  it("al filo del vivo dice EN VIVO (F43)", () => {
    renderControls({ playerRef: fakePlayer(92, 100) });
    act(() => { vi.advanceTimersByTime(1100); });
    expect(screen.getByRole("button", { name: "En vivo" })).toBeInTheDocument();
  });

  it("atrasado ofrece Volver al vivo, con el atraso a la vista (F43)", () => {
    renderControls({ playerRef: fakePlayer(50, 100) });
    act(() => { vi.advanceTimersByTime(1100); });
    const goLive = screen.getByRole("button", { name: "Volver al vivo (estás 50 segundos detrás del directo)" });
    expect(goLive).toHaveTextContent("VOLVER AL VIVO");
    // Exacto, no redondeado a minutos.
    expect(goLive).toHaveTextContent("−0:50");
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

// Umbrales del pill "Volver al vivo" con distancia natural real de hls.js.
describe("LivePlayerControls — pill Volver al vivo según la distancia natural", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const goLive = () => screen.queryByRole("button", { name: /Volver al vivo/, hidden: true });

  it("Fluidez con distancia natural de 25 s: a 30 s de atraso no aparece", () => {
    // filo 100, liveSyncPosition 75 => offset natural 25; currentTime 70 => atraso 30.
    renderControls({ playerRef: fakePlayer(70, 100, 75) });
    act(() => { vi.advanceTimersByTime(1100); });
    expect(goLive()).not.toBeInTheDocument();
  });

  it("Fluidez con distancia natural de 25 s: a 70 s de atraso aparece", () => {
    renderControls({ playerRef: fakePlayer(30, 100, 75) });
    act(() => { vi.advanceTimersByTime(1100); });
    expect(goLive()).toBeInTheDocument();
  });

  it("modo low con ~3 s de distancia natural conserva los pisos de 10 s / 5 s", () => {
    // 3 * 2.5 = 7.5 s dentro del jitter normal: sin el piso de 10 s el pill flapearía.
    renderControls({ latencyMode: "low", playerRef: fakePlayer(92, 100, 97) });
    act(() => { vi.advanceTimersByTime(1100); });
    expect(goLive()).not.toBeInTheDocument();
  });

  it("modo low con ~3 s de distancia natural muestra el pill pasando los 10 s", () => {
    renderControls({ latencyMode: "low", playerRef: fakePlayer(88, 100, 97) });
    act(() => { vi.advanceTimersByTime(1100); });
    expect(goLive()).toBeInTheDocument();
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
    const goLive = screen.getByRole("button", { name: /Volver al vivo \(estás 50 segundos/, hidden: true });
    // En celular "VOLVER AL VIVO -50 s" se partía en dos renglones: la versión corta
    // solo se muestra bajo el breakpoint sm y la completa desde sm en adelante.
    const corta = within(goLive).getByText("AL VIVO");
    const completa = within(goLive).getByText("VOLVER AL VIVO");
    expect(corta.className).toContain("sm:hidden");
    expect(completa.className).toContain("hidden");
    expect(completa.className).toContain("sm:inline");
  });
});
