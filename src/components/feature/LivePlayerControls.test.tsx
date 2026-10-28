import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import LivePlayerControls from "./LivePlayerControls";
import type { LiveHLSPlayerHandle, QualityLevel } from "./LiveHLSPlayer";
import { probeDvrDuration } from "@/lib/live/dvrWindow";

// Sin animaciones: lo que se prueba es CUÁNDO se oculta la barra, no el fade.
// Con motion real, jsdom deja la barra a mitad de la salida.
vi.mock("motion/react", async () => {
  const React = await import("react");
  const ANIMATION_PROPS = ["initial", "animate", "exit", "transition", "whileHover", "whileTap"];
  // Un componente por etiqueta, reutilizado: si cada acceso a `motion.div`
  // creara uno nuevo, cada re-render remontaría la barra entera.
  const cache = new Map<string, unknown>();
  const motion = new Proxy({}, {
    get: (_target, tag: string) => {
      if (!cache.has(tag)) {
        cache.set(tag, React.forwardRef((props: Record<string, unknown>, ref) =>
          React.createElement(tag, { ...Object.fromEntries(Object.entries(props).filter(([k]) => !ANIMATION_PROPS.includes(k))), ref })
        ));
      }
      return cache.get(tag);
    },
  });
  return { motion, AnimatePresence: ({ children }: { children: React.ReactNode }) => children };
});

// La duración de la clase en Fluidez sale de la playlist DVR: acá, 1000 s.
vi.mock("@/lib/live/dvrWindow", () => ({ probeDvrDuration: vi.fn(async () => 1000) }));

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
    setVolume: vi.fn(),
  };
  return { current: handle as unknown as LiveHLSPlayerHandle, handle, container };
}

const levels: QualityLevel[] = [
  { index: 0, height: 360, bitrate: 800_000, label: "360p" },
  { index: 2, height: 720, bitrate: 2_500_000, label: "720p" },
] as QualityLevel[];

function renderControls(props: Partial<Parameters<typeof LivePlayerControls>[0]> = {}) {
  const handlers = {
    onTogglePlay: vi.fn(),
    onToggleMute: vi.fn(),
    onSelectLevel: vi.fn(),
    onRewindFromLive: vi.fn(),
    onReturnToLive: vi.fn(),
  };
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
      dvrManifestUrl="https://customer-abc.cloudflarestream.com/in1/manifest/video.m3u8?dvrEnabled=true"
      {...handlers}
      {...props}
    />
  );
  return handlers;
}

/** jsdom no mide nada: la barra y la superficie necesitan un ancho para ubicar el toque. */
function giveWidth(el: Element, width: number) {
  Object.defineProperty(el, "getBoundingClientRect", {
    configurable: true,
    value: () => ({ left: 0, top: 0, width, height: 20, right: width, bottom: 20, x: 0, y: 0, toJSON: () => ({}) }),
  });
}

// La barra se reconoce por su botón de pantalla completa. `hidden: true`: con
// el menú abierto (modal), Radix marca lo de afuera con aria-hidden.
const bar = () => screen.queryByRole("button", { name: "Pantalla completa", hidden: true });
const timeline = () => screen.getByRole("slider", { name: "Posición en la clase" });

describe("LivePlayerControls", () => {
  beforeEach(() => {
    // La línea de tiempo se dibuja por cuadros: también se avanzan.
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "setInterval", "clearInterval", "Date", "requestAnimationFrame", "cancelAnimationFrame", "performance"] });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("con Auto muestra la calidad que se está usando, sin dejar de ser Auto (F08)", () => {
    renderControls({ currentLevel: -1, activeLevel: 2 });
    expect(screen.getByRole("button", { name: "Ajustes" })).toHaveTextContent("Auto · 720p");
  });

  it("con una calidad elegida a mano muestra esa (F08)", () => {
    renderControls({ currentLevel: 0, activeLevel: 0 });
    expect(screen.getByRole("button", { name: "Ajustes" })).toHaveTextContent("360p");
  });

  it("ya no ofrece elegir 'modo de clase': lo decide la sala", () => {
    renderControls();
    fireEvent.keyDown(screen.getByRole("button", { name: "Ajustes" }), { key: "Enter" });
    expect(screen.queryByText(/Modo de clase/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Baja latencia/)).not.toBeInTheDocument();
  });

  it("el botón de sonido se nombra por la acción (F07)", () => {
    renderControls({ isMuted: true });
    expect(screen.getByRole("button", { name: "Activar sonido" })).toBeInTheDocument();
  });

  it("al filo del vivo dice EN VIVO (F43)", () => {
    renderControls({ playerRef: fakePlayer(92, 100) });
    act(() => { vi.advanceTimersByTime(1100); });
    expect(screen.getByRole("button", { name: "En vivo" })).toHaveTextContent("EN VIVO");
  });

  it("atrasado, EN VIVO es el botón para volver y dice cuánto atraso hay", () => {
    renderControls({ playerRef: fakePlayer(50, 100) });
    act(() => { vi.advanceTimersByTime(1100); });
    const live = screen.getByRole("button", { name: "Volver al vivo (estás 50 segundos detrás del directo)" });
    expect(live).toHaveTextContent("EN VIVO");
  });

  it("el atraso se sigue actualizando con el video en pausa", () => {
    const player = fakePlayer(50, 100, null, true);
    renderControls({ playerRef: player, isPlaying: false });
    act(() => { vi.advanceTimersByTime(1100); });
    expect(screen.getByRole("button", { name: /estás 50 segundos/ })).toBeInTheDocument();
    // El filo avanza mientras el video sigue quieto: el atraso crece.
    (player.handle.video as unknown as { seekable: unknown }).seekable = { length: 1, start: () => 0, end: () => 160 };
    act(() => { vi.advanceTimersByTime(1000); });
    expect(screen.getByRole("button", { name: /estás 1 minuto 50 segundos/ })).toBeInTheDocument();
  });

  it("EN VIVO le pide a la sala volver al directo", () => {
    const handlers = renderControls({ playerRef: fakePlayer(50, 100) });
    act(() => { vi.advanceTimersByTime(1100); });
    fireEvent.click(screen.getByRole("button", { name: /Volver al vivo/ }));
    expect(handlers.onReturnToLive).toHaveBeenCalledTimes(1);
  });

  it("ya no hay botones de ±10 s en la barra", () => {
    renderControls({ latencyMode: "dvr" });
    expect(screen.queryByRole("button", { name: /Retroceder 10 segundos/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Adelantar 10 segundos/ })).not.toBeInTheDocument();
  });

  it("Clase completa: la barra de tiempo se lee con el atraso", () => {
    renderControls({ playerRef: fakePlayer(25, 100), latencyMode: "dvr" });
    act(() => { vi.advanceTimersByTime(1100); });
    expect(timeline()).toHaveAttribute(
      "aria-valuetext",
      "25 segundos de 1 minuto 40 segundos, 1 minuto 15 segundos detrás del directo",
    );
  });

  it("Clase completa: soltar la barra busca UNA vez, en el punto soltado", () => {
    const player = fakePlayer(25, 100);
    renderControls({ playerRef: player, latencyMode: "dvr" });
    act(() => { vi.advanceTimersByTime(100); });
    giveWidth(timeline(), 200);
    fireEvent.pointerDown(timeline(), { clientX: 20, pointerId: 1 });
    fireEvent.pointerMove(timeline(), { clientX: 60, pointerId: 1 });
    expect(player.handle.seekTo).not.toHaveBeenCalled();
    fireEvent.pointerUp(timeline(), { clientX: 60, pointerId: 1 });
    expect(player.handle.seekTo).toHaveBeenCalledTimes(1);
    expect(player.handle.seekTo).toHaveBeenCalledWith(30);
  });

  it("Clase completa: soltar al final de la barra es volver al vivo", () => {
    const player = fakePlayer(25, 100);
    const handlers = renderControls({ playerRef: player, latencyMode: "dvr" });
    act(() => { vi.advanceTimersByTime(100); });
    giveWidth(timeline(), 200);
    fireEvent.pointerDown(timeline(), { clientX: 199, pointerId: 1 });
    fireEvent.pointerUp(timeline(), { clientX: 199, pointerId: 1 });
    expect(handlers.onReturnToLive).toHaveBeenCalledTimes(1);
    expect(player.handle.seekTo).not.toHaveBeenCalled();
  });

  it("Escape cancela el arrastre sin buscar", () => {
    const player = fakePlayer(25, 100);
    renderControls({ playerRef: player, latencyMode: "dvr" });
    act(() => { vi.advanceTimersByTime(100); });
    giveWidth(timeline(), 200);
    fireEvent.pointerDown(timeline(), { clientX: 20, pointerId: 1 });
    fireEvent.keyDown(timeline(), { key: "Escape" });
    fireEvent.pointerUp(timeline(), { clientX: 20, pointerId: 1 });
    expect(player.handle.seekTo).not.toHaveBeenCalled();
  });

  it("modo automático: en Fluidez, arrastrar hacia atrás le pide a la sala pasar a Clase completa ahí", async () => {
    const player = fakePlayer(94, 100, 94); // al filo de Fluidez
    const handlers = renderControls({ playerRef: player, latencyMode: "smooth" });
    // Tocar la barra pide la duración de la clase (1000 s, mock).
    fireEvent.pointerEnter(timeline());
    await act(async () => { await Promise.resolve(); });
    expect(probeDvrDuration).toHaveBeenCalled();
    act(() => { vi.advanceTimersByTime(100); });
    giveWidth(timeline(), 200);
    fireEvent.pointerDown(timeline(), { clientX: 100, pointerId: 1 });
    fireEvent.pointerUp(timeline(), { clientX: 100, pointerId: 1 });
    expect(handlers.onRewindFromLive).toHaveBeenCalledTimes(1);
    // Mitad de una clase de ~1000 s: ~500 s detrás del vivo.
    const behind = handlers.onRewindFromLive.mock.calls[0][0] as number;
    expect(behind).toBeGreaterThan(490);
    expect(behind).toBeLessThan(510);
  });

  it("atajos con el foco en el reproductor: K pausa, M silencia, flechas ±5 s y J/L ±10 s", () => {
    const player = fakePlayer(50, 100);
    const handlers = renderControls({ playerRef: player, latencyMode: "dvr" });
    fireEvent.keyDown(player.container, { key: "k" });
    fireEvent.keyDown(player.container, { key: "m" });
    fireEvent.keyDown(player.container, { key: "ArrowLeft" });
    fireEvent.keyDown(player.container, { key: "l" });
    expect(handlers.onTogglePlay).toHaveBeenCalledTimes(1);
    expect(handlers.onToggleMute).toHaveBeenCalledTimes(1);
    expect(player.handle.seekBy).toHaveBeenNthCalledWith(1, -5);
    expect(player.handle.seekBy).toHaveBeenNthCalledWith(2, 10);
  });

  it("en Fluidez, retroceder con el teclado pasa a Clase completa; adelantar no hace nada", () => {
    // filo 100, sync 94 (6 s de distancia natural), video en 92 => 2 s atrás.
    const player = fakePlayer(92, 100, 94);
    const handlers = renderControls({ playerRef: player, latencyMode: "smooth" });
    fireEvent.keyDown(player.container, { key: "ArrowRight" });
    expect(handlers.onRewindFromLive).not.toHaveBeenCalled();
    fireEvent.keyDown(player.container, { key: "j" });
    expect(handlers.onRewindFromLive).toHaveBeenCalledWith(12);
  });

  it("doble toque a la izquierda salta 10 s atrás; un toque solo muestra la barra (F03)", () => {
    const player = fakePlayer(50, 100);
    const handlers = renderControls({ playerRef: player, latencyMode: "dvr" });
    const surface = screen.getAllByRole("button", { name: "Pausar" })[0];
    giveWidth(surface, 300);

    fireEvent.pointerDown(surface, { pointerType: "touch" });
    fireEvent.click(surface, { detail: 1, clientX: 30 });
    expect(player.handle.seekBy).not.toHaveBeenCalled();
    act(() => { vi.advanceTimersByTime(120); });
    fireEvent.pointerDown(surface, { pointerType: "touch" });
    fireEvent.click(surface, { detail: 1, clientX: 30 });

    expect(player.handle.seekBy).toHaveBeenCalledWith(-10);
    expect(handlers.onTogglePlay).not.toHaveBeenCalled();
  });

  it("dos toques lentos no son doble toque", () => {
    const player = fakePlayer(50, 100);
    renderControls({ playerRef: player, latencyMode: "dvr" });
    const surface = screen.getAllByRole("button", { name: "Pausar" })[0];
    giveWidth(surface, 300);
    fireEvent.pointerDown(surface, { pointerType: "touch" });
    fireEvent.click(surface, { detail: 1, clientX: 270 });
    act(() => { vi.advanceTimersByTime(500); });
    fireEvent.pointerDown(surface, { pointerType: "touch" });
    fireEvent.click(surface, { detail: 1, clientX: 270 });
    expect(player.handle.seekBy).not.toHaveBeenCalled();
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
    for (const key of ["k", " ", "m", "f", "ArrowLeft", "ArrowRight", "j", "l"]) fireEvent.keyDown(item, { key });
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
    const handlers = { onTogglePlay: vi.fn(), onToggleMute: vi.fn(), onSelectLevel: vi.fn(), onRewindFromLive: vi.fn(), onReturnToLive: vi.fn() };
    const props = { isPlaying: true, isBuffering: false, isMuted: false, levels, currentLevel: -1, latencyMode: "dvr" as const, ...handlers };
    const { rerender } = render(<LivePlayerControls playerRef={first} mediaKey={0} {...props} />);
    const second = fakePlayer(50, 100);
    // El ref es el mismo objeto; cambia el video que apunta (remontaje por `key`).
    (first as { current: LiveHLSPlayerHandle }).current = second.current;
    rerender(<LivePlayerControls playerRef={first} mediaKey={1} {...props} />);
    const events = vi.mocked(second.handle.video.addEventListener).mock.calls.map(([evt]) => evt);
    expect(events).toEqual(expect.arrayContaining(["seeking", "enterpictureinpicture"]));
  });

  it("reproduciendo y sin uso, la barra se oculta a los 3 s", () => {
    renderControls();
    expect(bar()).toBeInTheDocument();
    act(() => { vi.advanceTimersByTime(3100); });
    expect(bar()).not.toBeInTheDocument();
  });

  it("con el menú de ajustes abierto, la barra no se oculta (F05)", () => {
    renderControls();
    fireEvent.keyDown(screen.getByRole("button", { name: "Ajustes" }), { key: "Enter" });
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

// Umbrales de "atrasado" con distancia natural real de hls.js.
describe("LivePlayerControls — atraso según la distancia natural", () => {
  beforeEach(() => {
    // La línea de tiempo se dibuja por cuadros: también se avanzan.
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "setInterval", "clearInterval", "Date", "requestAnimationFrame", "cancelAnimationFrame", "performance"] });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const goLive = () => screen.queryByRole("button", { name: /Volver al vivo/, hidden: true });

  it("Fluidez con distancia natural de 25 s: a 30 s de atraso no cuenta como atrasado", () => {
    // filo 100, liveSyncPosition 75 => offset natural 25; currentTime 70 => atraso 30.
    renderControls({ playerRef: fakePlayer(70, 100, 75) });
    act(() => { vi.advanceTimersByTime(1100); });
    expect(goLive()).not.toBeInTheDocument();
  });

  it("Fluidez con distancia natural de 25 s: a 70 s de atraso sí", () => {
    renderControls({ playerRef: fakePlayer(30, 100, 75) });
    act(() => { vi.advanceTimersByTime(1100); });
    expect(goLive()).toBeInTheDocument();
  });
});

describe("LivePlayerControls — botón Segundo plano", () => {
  const original = Object.getOwnPropertyDescriptor(Document.prototype, "pictureInPictureEnabled");

  beforeEach(() => {
    // La línea de tiempo se dibuja por cuadros: también se avanzan.
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "setInterval", "clearInterval", "Date", "requestAnimationFrame", "cancelAnimationFrame", "performance"] });
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
});

describe("LivePlayerControls — fase 3: volumen y Solo audio", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "setInterval", "clearInterval", "Date", "requestAnimationFrame", "cancelAnimationFrame", "performance"] });
    localStorage.clear();
  });
  afterEach(() => {
    vi.useRealTimers();
    localStorage.clear();
  });

  it("el video arranca con el volumen recordado y la barra lo muestra", () => {
    localStorage.setItem("live-volume", "0.4");
    const player = fakePlayer();
    renderControls({ playerRef: player });

    expect(player.handle.setVolume).toHaveBeenCalledWith(0.4);
    expect(screen.getByRole("slider", { name: "Volumen", hidden: true })).toHaveValue("0.4");
  });

  it("mover el volumen lo recuerda para la próxima clase", () => {
    const player = fakePlayer();
    renderControls({ playerRef: player });

    fireEvent.change(screen.getByRole("slider", { name: "Volumen", hidden: true }), { target: { value: "0.6" } });

    expect(player.handle.setVolume).toHaveBeenLastCalledWith(0.6);
    expect(localStorage.getItem("live-volume")).toBe("0.6");
  });

  it("bajar a cero silencia pero no se recuerda como volumen", () => {
    localStorage.setItem("live-volume", "0.5");
    const handlers = renderControls();

    fireEvent.change(screen.getByRole("slider", { name: "Volumen", hidden: true }), { target: { value: "0" } });

    expect(handlers.onToggleMute).toHaveBeenCalledTimes(1);
    expect(localStorage.getItem("live-volume")).toBe("0.5");
  });

  it("Ajustes ofrece Solo audio", () => {
    const onToggleAudioOnly = vi.fn();
    renderControls({ onToggleAudioOnly });

    fireEvent.keyDown(screen.getByRole("button", { name: "Ajustes" }), { key: "Enter" });
    fireEvent.click(screen.getByRole("menuitem", { name: /Solo audio/ }));

    expect(onToggleAudioOnly).toHaveBeenCalledTimes(1);
  });

  it("en Solo audio no hay calidad, pantalla completa ni ventana flotante, y se puede volver al video", () => {
    Object.defineProperty(document, "pictureInPictureEnabled", { configurable: true, value: true });
    try {
      renderControls({ audioOnly: true, onToggleAudioOnly: vi.fn() });

      expect(screen.queryByRole("button", { name: "Pantalla completa" })).not.toBeInTheDocument();
      expect(screen.queryByRole("button", { name: /segundo plano/i, hidden: true })).not.toBeInTheDocument();
      fireEvent.keyDown(screen.getByRole("button", { name: "Ajustes" }), { key: "Enter" });
      expect(screen.getByRole("menuitem", { name: /Volver al video/ })).toBeInTheDocument();
      expect(screen.queryByText("Calidad")).not.toBeInTheDocument();
    } finally {
      delete (document as unknown as Record<string, unknown>).pictureInPictureEnabled;
    }
  });

  it("en Solo audio la barra no se oculta", () => {
    renderControls({ audioOnly: true });
    act(() => { vi.advanceTimersByTime(10_000); });
    expect(screen.getByRole("button", { name: "Ajustes" })).toBeInTheDocument();
  });
});

describe("LivePlayerControls — fase 2: nada corre si no se ve", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "setInterval", "clearInterval", "Date", "requestAnimationFrame", "cancelAnimationFrame", "performance"] });
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("con la barra oculta, el reloj del vivo no se actualiza; al mostrarla, sí", () => {
    const player = fakePlayer();
    const sync = vi.fn(() => null);
    player.handle.getLiveSyncPosition = sync;
    renderControls({ playerRef: player });
    act(() => { vi.advanceTimersByTime(3100); });
    expect(bar()).not.toBeInTheDocument();

    sync.mockClear();
    act(() => { vi.advanceTimersByTime(5000); });
    expect(sync).not.toHaveBeenCalled();

    // Mover el mouse sobre el video muestra la barra y lee en el acto.
    fireEvent.mouseMove(screen.getByRole("button", { name: "Pausar" }));
    expect(bar()).toBeInTheDocument();
    expect(sync).toHaveBeenCalled();
  });
});
