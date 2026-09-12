import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, act } from '@testing-library/react';
import LiveHLSPlayer from './LiveHLSPlayer';

// Instancia simulada de hls.js: capturamos los handlers para dispararlos como lo
// haría la librería, y contamos las recargas del manifest.
const handlers: Record<string, (evt: string, data: unknown) => void> = {};
const hlsInstance = {
  loadSource: vi.fn(),
  attachMedia: vi.fn(),
  startLoad: vi.fn(),
  stopLoad: vi.fn(),
  recoverMediaError: vi.fn(),
  destroy: vi.fn(),
  on: vi.fn((evt: string, cb: (evt: string, data: unknown) => void) => { handlers[evt] = cb; }),
  levels: [],
  currentLevel: -1,
  liveSyncPosition: null,
};

vi.mock('hls.js', () => {
  // `new Hls()` necesita un constructor real: una arrow function no sirve.
  function HlsMock() { return hlsInstance; }
  const Hls = HlsMock as unknown as {
    new (): typeof hlsInstance;
    isSupported: () => boolean;
    Events: Record<string, string>;
    ErrorTypes: Record<string, string>;
    ErrorDetails: Record<string, string>;
  };
  Hls.isSupported = () => true;
  Hls.Events = { MANIFEST_PARSED: 'manifestParsed', LEVEL_LOADED: 'levelLoaded', LEVEL_SWITCHED: 'levelSwitched', LEVEL_UPDATED: 'levelUpdated', ERROR: 'error' };
  Hls.ErrorTypes = { NETWORK_ERROR: 'networkError', MEDIA_ERROR: 'mediaError' };
  Hls.ErrorDetails = { FRAG_LOAD_ERROR: 'fragLoadError', LEVEL_LOAD_ERROR: 'levelLoadError' };
  return { default: Hls };
});

function renderPlayer() {
  return render(<LiveHLSPlayer liveInputId="input-1" customerCode="abc" muted autoPlay={false} />);
}

/** Simula el estado del <video>: si está reproduciendo, si avanza o no. */
function driveVideo(container: HTMLElement, opts: { paused: boolean; currentTime: number }) {
  const video = container.querySelector('video') as HTMLVideoElement;
  Object.defineProperty(video, 'paused', { value: opts.paused, configurable: true });
  Object.defineProperty(video, 'ended', { value: false, configurable: true });
  Object.defineProperty(video, 'currentTime', { value: opts.currentTime, writable: true, configurable: true });
  return video;
}

describe('LiveHLSPlayer recovery', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    for (const k of Object.keys(handlers)) delete handlers[k];
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('carga el manifest una vez al montar', () => {
    renderPlayer();
    expect(hlsInstance.loadSource).toHaveBeenCalledTimes(1);
    expect(hlsInstance.loadSource).toHaveBeenCalledWith('https://customer-abc.cloudflarestream.com/input-1/manifest/video.m3u8');
  });

  // Regresión: ante un fallo de red fatal se hacía solo startLoad(), que reintenta
  // con el mismo manifest ya vencido. El player quedaba "cargando" hasta un F5.
  it('recarga el manifest completo ante un error de red fatal', () => {
    renderPlayer();
    hlsInstance.loadSource.mockClear();

    act(() => { handlers.error('error', { fatal: true, type: 'networkError', details: 'fragLoadError' }); });

    expect(hlsInstance.stopLoad).toHaveBeenCalled();
    expect(hlsInstance.loadSource).toHaveBeenCalledTimes(1);
    expect(hlsInstance.startLoad).toHaveBeenCalledWith(-1);
  });

  it('no encadena recargas si llegan varios errores seguidos', () => {
    renderPlayer();
    hlsInstance.loadSource.mockClear();

    act(() => {
      handlers.error('error', { fatal: true, type: 'networkError', details: 'fragLoadError' });
      handlers.error('error', { fatal: true, type: 'networkError', details: 'levelLoadError' });
      handlers.error('error', { fatal: true, type: 'networkError', details: 'fragLoadError' });
    });

    expect(hlsInstance.loadSource).toHaveBeenCalledTimes(1);
  });

  // El caso que hls.js NO reporta: quiere reproducir pero currentTime no avanza.
  it('recarga el manifest si el video no avanza durante 12 s', () => {
    const { container } = renderPlayer();
    driveVideo(container, { paused: false, currentTime: 100 });
    // Primer tick: el watchdog ve 0 → 100 y lo toma como avance. El reloj arranca acá.
    act(() => { vi.advanceTimersByTime(1_000); });
    hlsInstance.loadSource.mockClear();

    act(() => { vi.advanceTimersByTime(11_000); });
    expect(hlsInstance.loadSource).not.toHaveBeenCalled();

    act(() => { vi.advanceTimersByTime(1_000); });
    expect(hlsInstance.loadSource).toHaveBeenCalledTimes(1);
  });

  it('no recarga mientras el video avanza con normalidad', () => {
    const { container } = renderPlayer();
    const video = driveVideo(container, { paused: false, currentTime: 100 });
    hlsInstance.loadSource.mockClear();

    for (let i = 0; i < 20; i++) {
      act(() => {
        video.currentTime = 100 + i;
        vi.advanceTimersByTime(1_000);
      });
    }

    expect(hlsInstance.loadSource).not.toHaveBeenCalled();
  });

  it('no recarga si el usuario pausó el video', () => {
    const { container } = renderPlayer();
    driveVideo(container, { paused: true, currentTime: 100 });
    hlsInstance.loadSource.mockClear();

    act(() => { vi.advanceTimersByTime(30_000); });

    expect(hlsInstance.loadSource).not.toHaveBeenCalled();
  });
});
