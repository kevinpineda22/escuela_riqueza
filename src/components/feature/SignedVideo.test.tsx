import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { SignedVideo } from "./SignedVideo";
import { ApiError } from "@/lib/api/client";
import type { SignedRecordingUrl } from "@/lib/api/stream/lives";

interface VideoState {
  paused: boolean;
  currentTime: number;
}

/** jsdom no implementa media: simulamos paused/currentTime/play. */
function driveVideo(container: HTMLElement, state: VideoState) {
  const video = container.querySelector("video") as HTMLVideoElement;
  Object.defineProperty(video, "paused", { get: () => state.paused, configurable: true });
  Object.defineProperty(video, "ended", { value: false, configurable: true });
  Object.defineProperty(video, "currentTime", {
    get: () => state.currentTime,
    set: (v: number) => {
      state.currentTime = v;
    },
    configurable: true,
  });
  video.play = vi.fn(() => {
    state.paused = false;
    return Promise.resolve();
  });
  return video;
}

const initial: SignedRecordingUrl = { url: "https://r2.test/old.mp4", expiresIn: 900 };

function setup(
  state: VideoState,
  getUrl = vi.fn<() => Promise<SignedRecordingUrl | null>>(),
) {
  const next = { url: "https://r2.test/new.mp4", expiresIn: 900 };
  getUrl.mockResolvedValue(next);
  const utils = render(<SignedVideo initial={initial} getUrl={getUrl} />);
  const video = driveVideo(utils.container, state);
  return { ...utils, video, getUrl };
}

/** Deja resolver la promesa de getUrl y el setState posterior. */
async function flush() {
  await act(async () => {
    await Promise.resolve();
  });
}

async function tick(seconds: number, onSecond?: (i: number) => void) {
  for (let i = 1; i <= seconds; i++) {
    onSecond?.(i);
    await act(async () => {
      vi.advanceTimersByTime(1000);
    });
  }
}

describe("SignedVideo", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-15T12:00:00Z"));
  });
  afterEach(() => vi.useRealTimers());

  it("renews an expired URL on seeking and restores the position", async () => {
    const state = { paused: true, currentTime: 100 };
    const { video, getUrl } = setup(state);
    act(() => {
      vi.setSystemTime(new Date("2026-10-15T12:16:00Z")); // pasaron los 900 s
    });
    state.currentTime = 3000;
    fireEvent.seeking(video);
    await flush();

    expect(getUrl).toHaveBeenCalledTimes(1);
    expect(video).toHaveAttribute("src", "https://r2.test/new.mp4");
    state.currentTime = 0; // el navegador reinicia al cargar el nuevo src
    fireEvent.loadedMetadata(video);
    expect(state.currentTime).toBe(3000);
    expect(video.play).not.toHaveBeenCalled(); // estaba en pausa
  });

  it("does not renew on seeking while the URL is still fresh", async () => {
    const { video, getUrl } = setup({ paused: true, currentTime: 10 });
    fireEvent.seeking(video);
    fireEvent.waiting(video);
    await flush();
    expect(getUrl).not.toHaveBeenCalled();
  });

  it("renews on waiting when the URL expires within 60 s", async () => {
    const { video, getUrl } = setup({ paused: false, currentTime: 10 });
    act(() => {
      vi.setSystemTime(new Date("2026-10-15T12:14:30Z"));
    });
    fireEvent.waiting(video);
    await flush();
    expect(getUrl).toHaveBeenCalledTimes(1);
  });

  it("watchdog renews after 8 s playing without progress and resumes playback", async () => {
    const state = { paused: false, currentTime: 500 };
    const { video, getUrl } = setup(state);
    await tick(1); // el primer tick fija la línea base de currentTime
    await tick(7);
    expect(getUrl).not.toHaveBeenCalled();
    await tick(1);
    expect(getUrl).toHaveBeenCalledTimes(1);

    state.paused = true; // al cambiar el src el navegador pausa
    state.currentTime = 0;
    fireEvent.loadedMetadata(video);
    expect(state.currentTime).toBe(500);
    expect(video.play).toHaveBeenCalledTimes(1);
  });

  it("watchdog does not renew while playback advances", async () => {
    const state = { paused: false, currentTime: 0 };
    const { getUrl } = setup(state);
    await tick(30, () => {
      state.currentTime += 1;
    });
    expect(getUrl).not.toHaveBeenCalled();
  });

  it("watchdog does not renew while stuck but still downloading (slow network)", async () => {
    const state = { paused: false, currentTime: 500 };
    const { video, getUrl } = setup(state);
    let end = 500;
    Object.defineProperty(video, "buffered", {
      get: () => ({ length: 1, start: () => 0, end: () => end }),
      configurable: true,
    });
    await tick(30, () => {
      end += 0.5; // el navegador sigue bajando aunque la imagen no avance
    });
    expect(getUrl).not.toHaveBeenCalled();

    // Deja de descargar (URL vencida sin evento `error`): el watchdog vuelve a actuar.
    await tick(9);
    expect(getUrl).toHaveBeenCalledTimes(1);
  });

  it("watchdog does not renew while paused", async () => {
    const { getUrl } = setup({ paused: true, currentTime: 50 });
    await tick(30);
    expect(getUrl).not.toHaveBeenCalled();
  });

  it("renews on the error event and does not resume when it was paused", async () => {
    const state = { paused: true, currentTime: 42 };
    const { video, getUrl } = setup(state);
    fireEvent.error(video);
    await flush();
    expect(getUrl).toHaveBeenCalledTimes(1);
    fireEvent.loadedMetadata(video);
    expect(state.currentTime).toBe(42);
    expect(video.play).not.toHaveBeenCalled();
  });

  it("keeps a single refresh in flight", async () => {
    const { video, getUrl } = setup({ paused: true, currentTime: 1 });
    fireEvent.error(video);
    fireEvent.error(video);
    fireEvent.error(video);
    await flush();
    expect(getUrl).toHaveBeenCalledTimes(1);
  });

  it("gives up after 3 refreshes without progress and retries on demand", async () => {
    const state = { paused: false, currentTime: 100 };
    const { getUrl } = setup(state);
    await tick(1);
    await tick(8);
    await tick(8);
    await tick(8);
    expect(getUrl).toHaveBeenCalledTimes(3);
    expect(screen.queryByText("No se pudo continuar la reproducción.")).not.toBeInTheDocument();

    await tick(8);
    expect(getUrl).toHaveBeenCalledTimes(3);
    expect(screen.getByText("No se pudo continuar la reproducción.")).toBeInTheDocument();
    // Sin error del video, solo una traba: no se acusa a la plataforma.
    expect(screen.getByText(/tu conexión está muy lenta/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Reintentar" }));
    await flush();
    expect(getUrl).toHaveBeenCalledTimes(4);
    expect(screen.queryByText("No se pudo continuar la reproducción.")).not.toBeInTheDocument();
  });

  it("resets the retry counter after 5 s of real progress", async () => {
    const state = { paused: false, currentTime: 100 };
    const { getUrl } = setup(state);
    await tick(1);
    await tick(8);
    await tick(8);
    expect(getUrl).toHaveBeenCalledTimes(2);

    await tick(6, () => {
      state.currentTime += 1;
    });
    // el contador volvió a 0: caben 3 renovaciones más antes de rendirse
    await tick(8);
    await tick(8);
    await tick(8);
    expect(getUrl).toHaveBeenCalledTimes(5);
    expect(screen.queryByText("No se pudo continuar la reproducción.")).not.toBeInTheDocument();
  });

  it("ignores an in-flight refresh that resolves after unmount", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    let resolve!: (v: SignedRecordingUrl) => void;
    const getUrl = vi.fn(() => new Promise<SignedRecordingUrl | null>((r) => (resolve = r)));
    const { container, unmount } = render(<SignedVideo initial={initial} getUrl={getUrl} />);
    const video = driveVideo(container, { paused: true, currentTime: 5 });
    fireEvent.error(video);
    expect(getUrl).toHaveBeenCalledTimes(1);
    unmount();
    await act(async () => {
      resolve({ url: "https://r2.test/late.mp4", expiresIn: 900 });
    });
    expect(errorSpy).not.toHaveBeenCalled();
    errorSpy.mockRestore();
  });

  it("applies startAt once on the first load and keeps the refresh position afterwards", async () => {
    const state = { paused: true, currentTime: 0 };
    const getUrl = vi
      .fn<() => Promise<SignedRecordingUrl | null>>()
      .mockResolvedValue({ url: "https://r2.test/new.mp4", expiresIn: 900 });
    const { container } = render(<SignedVideo initial={initial} getUrl={getUrl} startAt={300} />);
    const video = driveVideo(container, state);
    fireEvent.loadedMetadata(video);
    expect(state.currentTime).toBe(300);

    state.currentTime = 800;
    fireEvent.error(video);
    await flush();
    state.currentTime = 0;
    fireEvent.loadedMetadata(video);
    expect(state.currentTime).toBe(800);

    state.currentTime = 0;
    fireEvent.loadedMetadata(video);
    expect(state.currentTime).toBe(0); // startAt no se repite
  });

  it("shows a session-expired overlay with a login link and stops retrying on a 401", async () => {
    window.history.pushState({}, "", "/grabaciones/live-1?x=1");
    const getUrl = vi
      .fn<() => Promise<SignedRecordingUrl | null>>()
      .mockRejectedValue(new ApiError("UNAUTHENTICATED", "Sesión expirada", 401));
    const { container } = render(<SignedVideo initial={initial} getUrl={getUrl} />);
    const video = driveVideo(container, { paused: true, currentTime: 5 });
    fireEvent.error(video);
    await flush();

    expect(screen.getByText("Tu sesión expiró. Inicia sesión de nuevo para seguir viendo.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Iniciar sesión" })).toHaveAttribute(
      "href",
      `/login?returnTo=${encodeURIComponent("/grabaciones/live-1?x=1")}`,
    );
    expect(screen.queryByText("No se pudo continuar la reproducción.")).not.toBeInTheDocument();

    fireEvent.error(video);
    await flush();
    expect(getUrl).toHaveBeenCalledTimes(1);
    window.history.pushState({}, "", "/");
  });

  it("keeps the retry flow for non-401 errors", async () => {
    const getUrl = vi.fn<() => Promise<SignedRecordingUrl | null>>().mockRejectedValue(new Error("network"));
    const { container } = render(<SignedVideo initial={initial} getUrl={getUrl} />);
    const video = driveVideo(container, { paused: true, currentTime: 5 });
    fireEvent.error(video);
    await flush();
    expect(screen.queryByText(/Tu sesión expiró/)).not.toBeInTheDocument();
    fireEvent.error(video);
    await flush();
    expect(getUrl).toHaveBeenCalledTimes(2);
  });
});
