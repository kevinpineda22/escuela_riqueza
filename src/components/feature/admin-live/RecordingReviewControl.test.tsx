import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { RecordingReviewControl } from "./RecordingReviewControl";
import { requestTrim, type LiveEvent } from "@/lib/api/stream/lives";

vi.mock("@/lib/api/stream/lives", () => ({ requestTrim: vi.fn() }));
vi.mock("@/components/ui/toaster", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));
vi.mock("@/components/feature/live-room/constants", () => ({ CF_CUSTOMER_HOST: "customer-test.cloudflarestream.com" }));
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

  describe("modal de revisión", () => {
    async function openDialog() {
      const user = userEvent.setup();
      renderControl(makeLive());
      await user.click(screen.getByRole("button", { name: /Revisar grabación/ }));
      return user;
    }

    it("resume cuánto queda la clase después del corte", async () => {
      const user = await openDialog();
      await user.type(screen.getByLabelText("Inicio del receso"), "1:00:00");
      await user.type(screen.getByLabelText("Fin del receso"), "1:35:00");
      expect(screen.getByTestId("trim-summary")).toHaveTextContent("Duración original 4:00:00 → queda 3:25:00");
    });

    it("avisa si el fin queda antes del inicio y no manda nada", async () => {
      const user = await openDialog();
      await user.type(screen.getByLabelText("Inicio del receso"), "1:35:00");
      await user.type(screen.getByLabelText("Fin del receso"), "1:00:00");
      expect(screen.getByText(/al menos 5 s/)).toBeInTheDocument();
      await user.click(screen.getByRole("button", { name: /Recortar y archivar/ }));
      expect(trim).not.toHaveBeenCalled();
    });

    it("avisa si un tiempo escrito no se puede leer", async () => {
      const user = await openDialog();
      await user.type(screen.getByLabelText("Fin del receso"), "1:35:001:35:00");
      expect(screen.getByText(/Escribe los tiempos como h:mm:ss/)).toBeInTheDocument();
    });

    it("pide marcar los dos tiempos antes de recortar", async () => {
      const user = await openDialog();
      await user.click(screen.getByRole("button", { name: /Recortar y archivar/ }));
      expect(screen.getByRole("alert")).toHaveTextContent("Marca el inicio y el fin del receso.");
    });

    it("con confirmación, pide el recorte y deja la sala en recorte", async () => {
      vi.spyOn(window, "confirm").mockReturnValue(true);
      trim.mockResolvedValue({ ok: true, ranges: [{ start: 3600, end: 5700 }] });
      const user = userEvent.setup();
      const { onUpdated } = renderControl(makeLive());
      await user.click(screen.getByRole("button", { name: /Revisar grabación/ }));
      await user.type(screen.getByLabelText("Inicio del receso"), "1:00:00");
      await user.type(screen.getByLabelText("Fin del receso"), "1:35:00");
      await user.click(screen.getByRole("button", { name: /Recortar y archivar/ }));

      expect(trim).toHaveBeenCalledWith("live-1", [{ start: 3600, end: 5700 }]);
      expect(onUpdated).toHaveBeenCalledWith(
        expect.objectContaining({ recording_review: "trimming", trim_ranges: [{ start: 3600, end: 5700 }] }),
      );
    });

    it("sin confirmación no manda nada", async () => {
      vi.spyOn(window, "confirm").mockReturnValue(false);
      const user = await openDialog();
      await user.type(screen.getByLabelText("Inicio del receso"), "1:00:00");
      await user.type(screen.getByLabelText("Fin del receso"), "1:35:00");
      await user.click(screen.getByRole("button", { name: /Recortar y archivar/ }));
      expect(trim).not.toHaveBeenCalled();
    });

    it("muestra el error del servidor y deja reintentar", async () => {
      vi.spyOn(window, "confirm").mockReturnValue(true);
      trim.mockResolvedValue({ ok: false, message: "La grabación ya se está archivando completa" });
      const user = await openDialog();
      await user.type(screen.getByLabelText("Inicio del receso"), "1:00:00");
      await user.type(screen.getByLabelText("Fin del receso"), "1:35:00");
      await user.click(screen.getByRole("button", { name: /Recortar y archivar/ }));
      expect(screen.getByRole("alert")).toHaveTextContent("La grabación ya se está archivando completa");
      expect(screen.getByRole("button", { name: /Recortar y archivar/ })).toBeEnabled();
    });
  });
});
