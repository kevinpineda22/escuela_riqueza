import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook } from "@testing-library/react";
import { useLiveMediaSession } from "./useLiveMediaSession";
import { SCHOOL_LOGO_URL } from "@/lib/media/mediaSession";

// jsdom no trae Media Session: una mínima que guarda lo que se le pide.
const actions = new Map<string, (() => void) | null>();
const session = {
  metadata: null as unknown,
  playbackState: "none",
  setActionHandler: vi.fn((action: string, handler: (() => void) | null) => actions.set(action, handler)),
};

describe("useLiveMediaSession — la clase en la pantalla de bloqueo", () => {
  beforeEach(() => {
    actions.clear();
    session.metadata = null;
    session.playbackState = "none";
    Object.defineProperty(navigator, "mediaSession", { configurable: true, value: session });
    vi.stubGlobal("MediaMetadata", class {
      constructor(init: Record<string, unknown>) { Object.assign(this, init); }
    });
  });
  afterEach(() => {
    delete (navigator as unknown as Record<string, unknown>).mediaSession;
    vi.unstubAllGlobals();
  });

  const base = { enabled: true, title: "Clase de hoy", isPlaying: true, onPlay: vi.fn(), onPause: vi.fn() };

  it("muestra título, escuela y portada de la clase (con el logo de respaldo)", () => {
    renderHook(() => useLiveMediaSession({ ...base, coverUrl: "https://img/portada.jpg" }));

    const metadata = session.metadata as { title: string; artist: string; artwork: { src: string }[] };
    expect(metadata.title).toBe("Clase de hoy");
    expect(metadata.artist).toBe("Escuela de la Riqueza");
    expect(metadata.artwork[0].src).toBe("https://img/portada.jpg");
    expect(metadata.artwork.at(-1)?.src).toBe(SCHOOL_LOGO_URL);
    expect(session.playbackState).toBe("playing");
  });

  it("sin portada, el logo", () => {
    renderHook(() => useLiveMediaSession(base));
    const metadata = session.metadata as { artwork: { src: string }[] };
    expect(metadata.artwork.every((a) => a.src === SCHOOL_LOGO_URL)).toBe(true);
  });

  it("Play y Pausa de la pantalla de bloqueo manejan la clase", () => {
    const onPlay = vi.fn();
    const onPause = vi.fn();
    renderHook(() => useLiveMediaSession({ ...base, onPlay, onPause }));

    actions.get("play")?.();
    actions.get("pause")?.();

    expect(onPlay).toHaveBeenCalledTimes(1);
    expect(onPause).toHaveBeenCalledTimes(1);
  });

  it("no ofrece adelantar ni pista siguiente: es un vivo", () => {
    renderHook(() => useLiveMediaSession(base));
    expect([...actions.keys()].sort()).toEqual(["pause", "play"]);
  });

  it("al salir de la sala, la pantalla de bloqueo queda limpia", () => {
    const { unmount } = renderHook(() => useLiveMediaSession(base));
    unmount();
    expect(session.metadata).toBeNull();
    expect(actions.get("play")).toBeNull();
    expect(actions.get("pause")).toBeNull();
  });

  it("sin player en pantalla no toca nada", () => {
    renderHook(() => useLiveMediaSession({ ...base, enabled: false }));
    expect(session.metadata).toBeNull();
  });
});
