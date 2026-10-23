import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { RecordingReviewControl } from "./RecordingReviewControl";
import { requestTrim, type LiveEvent } from "@/lib/api/stream/lives";
import { loadFrameSample } from "./streamThumbnails";
import type * as StreamThumbnails from "./streamThumbnails";

vi.mock("@/lib/api/stream/lives", () => ({ requestTrim: vi.fn() }));
vi.mock("@/components/ui/toaster", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));
vi.mock("@/components/feature/live-room/constants", () => ({ CF_CUSTOMER_HOST: "customer-test.cloudflarestream.com" }));
// Miniaturas sintéticas: pantalla del logo (oscura y quieta) entre RECESO_DESDE y
// RECESO_HASTA, clase (que se mueve) en el resto. Ver src/lib/breakDetection.ts.
vi.mock("./streamThumbnails", async (importOriginal) => ({
  ...(await importOriginal<typeof StreamThumbnails>()),
  loadFrameSample: vi.fn(),
}));
// jsdom no tiene MediaSource: hls.js se reemplaza por un doble que no hace nada.
vi.mock("hls.js", () => {
  class FakeHls {
    static isSupported = () => true;
    static Events = { ERROR: "hlsError" };
    on = vi.fn();
    loadSource = vi.fn();
    attachMedia = vi.fn();
    destroy = vi.fn();
  }
  return { default: FakeHls };
});

const trim = vi.mocked(requestTrim);
const frames = vi.mocked(loadFrameSample);
const RECESO_DESDE = 3600;
const RECESO_HASTA = 5640;
const LOGO = Array.from({ length: 32 }, (_, i) => (i === 13 ? 120 : 6));

function withBreak(from: number, to: number) {
  frames.mockImplementation(async (_uid, time) => {
    if (time >= from && time <= to) return { time, luma: 10, sig: LOGO };
    return { time, luma: 80, sig: Array.from({ length: 32 }, (_, i) => 80 + ((time / 10 + i * 7) % 23) - 11) };
  });
}
const NOW = new Date("2026-10-18T12:00:00.000Z");

function makeLive(overrides: Partial<LiveEvent> = {}): LiveEvent {
  return {
    id: "live-1",
    title: "Clase del sábado",
    recording_stream_uid: "a".repeat(32),
    recording_storage: "stream",
    recording_r2_key: null,
    recording_duration_seconds: 4 * 3600,
    archived_at: null,
    recording_review: "pending",
    review_deadline_at: "2026-10-19T20:00:00.000Z",
    trim_ranges: null,
    ...overrides,
  } as LiveEvent;
}

function renderControl(live: LiveEvent, props: Partial<Parameters<typeof RecordingReviewControl>[0]> = {}) {
  const onUpdated = vi.fn();
  const onArchiveFull = vi.fn();
  render(
    <RecordingReviewControl live={live} onUpdated={onUpdated} onArchiveFull={onArchiveFull} archiving={false} {...props} />,
  );
  return { onUpdated, onArchiveFull };
}

describe("RecordingReviewControl", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    withBreak(RECESO_DESDE, RECESO_HASTA);
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(NOW);
  });
  afterEach(() => vi.useRealTimers());

  it("no muestra nada si la sala no está en revisión o ya se archivó", () => {
    const { container: a } = render(
      <RecordingReviewControl live={makeLive({ recording_review: null })} onUpdated={vi.fn()} onArchiveFull={vi.fn()} archiving={false} />,
    );
    expect(a).toBeEmptyDOMElement();
    const { container: b } = render(
      <RecordingReviewControl live={makeLive({ archived_at: "2026-10-18T00:00:00Z" })} onUpdated={vi.fn()} onArchiveFull={vi.fn()} archiving={false} />,
    );
    expect(b).toBeEmptyDOMElement();
  });

  it("avisa cuántas horas faltan para archivarse completa", () => {
    renderControl(makeLive());
    expect(screen.getByText(/se archiva completa en 32 h/)).toBeInTheDocument();
  });

  it("avisa cuando el plazo ya venció", () => {
    renderControl(makeLive({ review_deadline_at: "2026-10-18T11:00:00.000Z" }));
    expect(screen.getByText(/Venció el plazo/)).toBeInTheDocument();
  });

  it("'Archivar sin recortar' usa el archivado de siempre", async () => {
    const user = userEvent.setup();
    const live = makeLive();
    const { onArchiveFull } = renderControl(live);
    await user.click(screen.getByRole("button", { name: /Archivar sin recortar/ }));
    expect(onArchiveFull).toHaveBeenCalledWith(live);
  });

  it("muestra el recorte en curso con los tramos que se quitan", () => {
    renderControl(makeLive({ recording_review: "trimming", trim_ranges: [{ start: 3600, end: 5700 }] }));
    expect(screen.getByText(/Recortando el receso/)).toBeInTheDocument();
    expect(screen.getByText(/de 1:00:00 a 1:35:00/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Revisar grabación/ })).not.toBeInTheDocument();
  });

  describe("recortador", () => {
    async function openDialog() {
      const user = userEvent.setup();
      const utils = renderControl(makeLive());
      await user.click(screen.getByRole("button", { name: /Revisar grabación/ }));
      return { user, ...utils };
    }

    const found = () => screen.findByText(/Encontramos el receso/, undefined, { timeout: 3000 });

    it("encuentra el receso solo y deja las manijas ahí", async () => {
      await openDialog();
      await found();
      expect(screen.getByRole("slider", { name: "Inicio del receso" })).toHaveAttribute("aria-valuetext", "1:00:00");
      expect(screen.getByRole("slider", { name: "Fin del receso" })).toHaveAttribute("aria-valuetext", "1:34:00");
      expect(screen.getByTestId("trim-summary")).toHaveTextContent("Se quita 34:00 · Queda 3:26:00");
    });

    it("las manijas se afinan con el teclado y la lupa", async () => {
      const { user } = await openDialog();
      await found();
      const start = screen.getByRole("slider", { name: "Inicio del receso" });
      start.focus();
      await user.keyboard("{ArrowRight}{ArrowRight}");
      expect(start).toHaveAttribute("aria-valuetext", "1:00:02");
      await user.click(screen.getByRole("button", { name: "Atrás 5 segundos" }));
      expect(start).toHaveAttribute("aria-valuetext", "59:57");
      expect(screen.getByText(/Volver a lo encontrado/)).toBeInTheDocument();
    });

    it("el inicio no puede pasar al fin", async () => {
      const { user } = await openDialog();
      await found();
      const start = screen.getByRole("slider", { name: "Inicio del receso" });
      start.focus();
      for (let i = 0; i < 40; i++) await user.keyboard("{PageUp}");
      expect(start).toHaveAttribute("aria-valuenow", String(RECESO_HASTA - 5));
    });

    it("pide confirmación en pantalla y recién ahí pide el recorte", async () => {
      trim.mockResolvedValue({ ok: true, ranges: [{ start: RECESO_DESDE, end: RECESO_HASTA }] });
      const { user, onUpdated } = await openDialog();
      await found();
      await user.click(screen.getByRole("button", { name: /Quitar receso/ }));
      expect(trim).not.toHaveBeenCalled();
      expect(screen.getByTestId("trim-confirm")).toHaveTextContent("Se quita de 1:00:00 a 1:34:00");

      await user.click(screen.getByRole("button", { name: /Sí, recortar/ }));
      expect(trim).toHaveBeenCalledWith("live-1", [{ start: RECESO_DESDE, end: RECESO_HASTA }]);
      expect(onUpdated).toHaveBeenCalledWith(
        expect.objectContaining({ recording_review: "trimming", trim_ranges: [{ start: RECESO_DESDE, end: RECESO_HASTA }] }),
      );
    });

    it("Volver no manda nada", async () => {
      const { user } = await openDialog();
      await found();
      await user.click(screen.getByRole("button", { name: /Quitar receso/ }));
      await user.click(screen.getByRole("button", { name: "Volver" }));
      expect(screen.queryByTestId("trim-confirm")).not.toBeInTheDocument();
      expect(trim).not.toHaveBeenCalled();
    });

    it("sin receso detectado, no deja recortar un tramo que nadie marcó", async () => {
      withBreak(-1, -1);
      const { user } = await openDialog();
      await screen.findByText(/No encontramos la pantalla del receso/, undefined, { timeout: 3000 });
      await user.click(screen.getByRole("button", { name: /Quitar receso/ }));
      expect(screen.getByRole("alert")).toHaveTextContent("Marca el receso con las manijas rojas");
      expect(screen.queryByTestId("trim-confirm")).not.toBeInTheDocument();

      screen.getByRole("slider", { name: "Fin del receso" }).focus();
      await user.keyboard("{ArrowRight}");
      await user.click(screen.getByRole("button", { name: /Quitar receso/ }));
      expect(screen.getByTestId("trim-confirm")).toBeInTheDocument();
    });

    it("muestra el error del servidor y deja reintentar", async () => {
      trim.mockResolvedValue({ ok: false, message: "La grabación ya se está archivando completa" });
      const { user } = await openDialog();
      await found();
      await user.click(screen.getByRole("button", { name: /Quitar receso/ }));
      await user.click(screen.getByRole("button", { name: /Sí, recortar/ }));
      await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("La grabación ya se está archivando completa"));
      expect(screen.getByRole("button", { name: /Quitar receso/ })).toBeEnabled();
    });
  });
});
