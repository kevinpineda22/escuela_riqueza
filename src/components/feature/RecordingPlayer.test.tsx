import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import RecordingPlayer, { type RecordingSource } from "./RecordingPlayer";
import { requestSignedRecordingUrl } from "@/lib/api/stream/lives";
import { getReplayProgress, saveReplayProgress } from "@/lib/api/stream/replayProgress";

vi.mock("@/lib/api/stream/lives", () => ({ requestSignedRecordingUrl: vi.fn() }));
vi.mock("@/lib/api/stream/replayProgress", () => ({
  getReplayProgress: vi.fn(),
  saveReplayProgress: vi.fn(),
}));

const request = vi.mocked(requestSignedRecordingUrl);
const getProgress = vi.mocked(getReplayProgress);
const save = vi.mocked(saveReplayProgress);

const live: RecordingSource = {
  id: "live-1",
  title: "Clase de ahorro",
  recording_storage: "r2",
  recording_stream_uid: null,
};

interface VideoState {
  paused: boolean;
  currentTime: number;
  duration: number;
}

/** jsdom no implementa media: simulamos paused/currentTime/duration/play. */
function driveVideo(container: HTMLElement, state: VideoState) {
  const video = container.querySelector("video") as HTMLVideoElement;
  Object.defineProperty(video, "paused", { get: () => state.paused, configurable: true });
  Object.defineProperty(video, "ended", { value: false, configurable: true });
  Object.defineProperty(video, "duration", { get: () => state.duration, configurable: true });
  Object.defineProperty(video, "currentTime", {
    get: () => state.currentTime,
    set: (v: number) => {
      state.currentTime = v;
    },
    configurable: true,
  });
  video.play = vi.fn(() => Promise.resolve());
  return video;
}

async function flush() {
  await act(async () => {
    for (let i = 0; i < 6; i++) await Promise.resolve();
  });
}

async function mount(trackProgress: boolean, state: VideoState) {
  const utils = render(<RecordingPlayer live={live} trackProgress={trackProgress} />);
  await flush();
  const video = driveVideo(utils.container, state);
  return { ...utils, video };
}

describe("RecordingPlayer progress", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-15T12:00:00Z"));
    vi.clearAllMocks();
    request.mockResolvedValue({ url: "https://r2.test/a.mp4", expiresIn: 21600 });
    save.mockResolvedValue(undefined);
  });
  afterEach(() => vi.useRealTimers());

  it("resumes once at the saved position and shows the banner", async () => {
    getProgress.mockResolvedValue({ position_seconds: 3725, duration_seconds: 7200 });
    const state = { paused: true, currentTime: 0, duration: 7200 };
    const { video } = await mount(true, state);

    expect(screen.getByText("Retomando desde 1:02:05")).toBeInTheDocument();
    fireEvent.loadedMetadata(video);
    expect(state.currentTime).toBe(3725);

    // Una segunda carga de metadatos (p. ej. tras renovar la URL) no repite el salto inicial.
    state.currentTime = 50;
    fireEvent.loadedMetadata(video);
    expect(state.currentTime).toBe(50);
  });

  it("starts from the beginning on demand and saves position 0", async () => {
    getProgress.mockResolvedValue({ position_seconds: 600, duration_seconds: 7200 });
    const state = { paused: true, currentTime: 600, duration: 7200 };
    const { video } = await mount(true, state);
    fireEvent.loadedMetadata(video);

    fireEvent.click(screen.getByRole("button", { name: "Empezar desde el inicio" }));
    expect(state.currentTime).toBe(0);
    expect(screen.queryByText(/Retomando desde/)).not.toBeInTheDocument();
    expect(save).toHaveBeenCalledWith("live-1", 0, 7200);
  });

  it("starts at 0 without a banner when the saved position is near the end", async () => {
    getProgress.mockResolvedValue({ position_seconds: 7180, duration_seconds: 7200 });
    const state = { paused: true, currentTime: 0, duration: 7200 };
    const { video } = await mount(true, state);
    fireEvent.loadedMetadata(video);
    expect(state.currentTime).toBe(0);
    expect(screen.queryByText(/Retomando desde/)).not.toBeInTheDocument();
  });

  it("ignores a saved position under 10 seconds", async () => {
    getProgress.mockResolvedValue({ position_seconds: 8, duration_seconds: 7200 });
    await mount(true, { paused: true, currentTime: 0, duration: 7200 });
    expect(screen.queryByText(/Retomando desde/)).not.toBeInTheDocument();
  });

  it("saves every 10 s while playing and on pause", async () => {
    getProgress.mockResolvedValue(null);
    const state = { paused: false, currentTime: 20, duration: 7200 };
    const { video } = await mount(true, state);
    fireEvent.loadedMetadata(video);

    fireEvent.timeUpdate(video);
    expect(save).toHaveBeenCalledTimes(1);
    expect(save).toHaveBeenLastCalledWith("live-1", 20, 7200);

    act(() => {
      vi.advanceTimersByTime(4000);
    });
    state.currentTime = 24;
    fireEvent.timeUpdate(video);
    expect(save).toHaveBeenCalledTimes(1); // aún no pasaron 10 s

    act(() => {
      vi.advanceTimersByTime(7000);
    });
    state.currentTime = 31;
    fireEvent.timeUpdate(video);
    expect(save).toHaveBeenCalledTimes(2);
    expect(save).toHaveBeenLastCalledWith("live-1", 31, 7200);

    state.currentTime = 33;
    state.paused = true;
    fireEvent.pause(video);
    expect(save).toHaveBeenCalledTimes(3);
    expect(save).toHaveBeenLastCalledWith("live-1", 33, 7200);
  });

  it("throttles seeks, skips the first 5 s and saves on hide and unmount", async () => {
    getProgress.mockResolvedValue(null);
    const state = { paused: false, currentTime: 3, duration: 7200 };
    const { video, unmount } = await mount(true, state);
    fireEvent.loadedMetadata(video);

    fireEvent.timeUpdate(video);
    expect(save).not.toHaveBeenCalled(); // < 5 s

    state.currentTime = 500;
    fireEvent.seeked(video);
    expect(save).toHaveBeenCalledTimes(1);
    state.currentTime = 900;
    fireEvent.seeked(video); // inmediato: limitado por el throttle
    expect(save).toHaveBeenCalledTimes(1);

    act(() => {
      vi.advanceTimersByTime(4000);
    });
    state.currentTime = 1200;
    fireEvent.timeUpdate(video); // actualiza la última posición conocida
    Object.defineProperty(document, "visibilityState", { value: "hidden", configurable: true });
    fireEvent(document, new Event("visibilitychange"));
    expect(save).toHaveBeenCalledTimes(2);
    expect(save).toHaveBeenLastCalledWith("live-1", 1200, 7200);

    state.currentTime = 1300;
    fireEvent.timeUpdate(video);
    unmount();
    expect(save).toHaveBeenCalledTimes(3);
    expect(save).toHaveBeenLastCalledWith("live-1", 1300, 7200);
    Object.defineProperty(document, "visibilityState", { value: "visible", configurable: true });
  });

  it("does not read nor save progress without trackProgress (admin usage)", async () => {
    const state = { paused: false, currentTime: 100, duration: 7200 };
    const { video, unmount } = await mount(false, state);
    fireEvent.loadedMetadata(video);
    fireEvent.timeUpdate(video);
    fireEvent.pause(video);
    unmount();
    expect(getProgress).not.toHaveBeenCalled();
    expect(save).not.toHaveBeenCalled();
    expect(screen.queryByText(/Retomando desde/)).not.toBeInTheDocument();
  });
});
