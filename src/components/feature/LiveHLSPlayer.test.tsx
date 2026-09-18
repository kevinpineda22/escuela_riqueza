import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createRef } from 'react';
import { render, act } from '@testing-library/react';
import LiveHLSPlayer, { type LiveHLSPlayerHandle } from './LiveHLSPlayer';

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
  nextLevel: -1,
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
  Hls.Events = {
    MANIFEST_PARSED: 'manifestParsed',
    LEVEL_LOADED: 'levelLoaded',
    LEVEL_SWITCHED: 'levelSwitched',
    LEVEL_UPDATED: 'levelUpdated',
    ERROR: 'error',
  };
  Hls.ErrorTypes = { NETWORK_ERROR: 'networkError', MEDIA_ERROR: 'mediaError' };
  Hls.ErrorDetails = { FRAG_LOAD_ERROR: 'fragLoadError', LEVEL_LOAD_ERROR: 'levelLoadError' };
  return { default: Hls };
});

function renderPlayer(props: Partial<React.ComponentProps<typeof LiveHLSPlayer>> = {}) {
  return render(<LiveHLSPlayer liveInputId="input-1" customerCode="abc" muted autoPlay={false} {...props} />);
}

function renderPlayerWithRef(props: Partial<React.ComponentProps<typeof LiveHLSPlayer>> = {}) {
  const ref = createRef<LiveHLSPlayerHandle>();
  const utils = render(
    <LiveHLSPlayer ref={ref} liveInputId="input-1" customerCode="abc" muted autoPlay={false} {...props} />,
  );
  return { ...utils, ref };
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
    hlsInstance.currentLevel = -1;
    hlsInstance.nextLevel = -1;
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

  // H5: el cambio de calidad debe usar `nextLevel` (cambia en el próximo
  // fragmento) y NO `currentLevel` (fuerza flush de buffer y latigazo visible).
  it('usa nextLevel (no currentLevel) al cambiar de calidad', () => {
    const { ref } = renderPlayerWithRef();
    act(() => { ref.current?.setQualityLevel(2); });

    expect(hlsInstance.nextLevel).toBe(2);
    expect(hlsInstance.currentLevel).toBe(-1);
  });

  // Regresión: ante un fallo de red fatal se hacía solo startLoad(), que reintenta
  // con el mismo manifest ya vencido. El player quedaba "cargando" hasta un F5.
  it('recarga el manifest completo ante un error de red fatal', () => {
    renderPlayer();
    hlsInstance.loadSource.mockClear();

    act(() => { handlers.error('error', { fatal: true, type: 'networkError', details: 'fragLoadError' }); });
    // H8: backoff — el primer intento espera 1s antes de ejecutar la recarga.
    act(() => { vi.advanceTimersByTime(1_000); });

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
    act(() => { vi.advanceTimersByTime(1_000); });

    expect(hlsInstance.loadSource).toHaveBeenCalledTimes(1);
  });

  // H8: backoff exponencial (1s, 2s, 4s, 8s, tope 8s) + máximo 6 recargas por
  // montaje. Al agotar los reintentos, se llama a onFatalError en vez de
  // seguir recargando en loop.
  it('aplica backoff exponencial y llama a onFatalError tras agotar los reintentos', () => {
    const onFatalError = vi.fn();
    renderPlayer({ onFatalError });
    hlsInstance.loadSource.mockClear();

    const delays = [1000, 2000, 4000, 8000, 8000, 8000];
    for (let i = 0; i < delays.length; i++) {
      act(() => { handlers.error('error', { fatal: true, type: 'networkError', details: 'fragLoadError' }); });
      // Recarga aún no ejecutada antes de que venza el backoff de este intento.
      act(() => { vi.advanceTimersByTime(delays[i] - 1); });
      expect(hlsInstance.loadSource).toHaveBeenCalledTimes(i);
      // Vence el backoff + ventana de cooldown post-recarga (1s) para liberar el lock.
      act(() => { vi.advanceTimersByTime(1 + 1000); });
      expect(hlsInstance.loadSource).toHaveBeenCalledTimes(i + 1);
    }

    // Séptimo error: se agotaron los 6 intentos permitidos.
    act(() => { handlers.error('error', { fatal: true, type: 'networkError', details: 'fragLoadError' }); });
    expect(onFatalError).toHaveBeenCalledTimes(1);
    expect(hlsInstance.loadSource).toHaveBeenCalledTimes(delays.length);
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

    // Segundo 12: el watchdog dispara reloadFromScratch, que agenda un backoff de 1s.
    act(() => { vi.advanceTimersByTime(1_000); });
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

  // Autoplay respect: MANIFEST_PARSED corre de nuevo tras cada recarga por
  // recuperación (H8). Si el alumno pausó a propósito (vía `setUserPaused`,
  // llamado por el toggle real de la sala), no debe reactivarse solo.
  it('no reanuda automáticamente tras manifest si el usuario pausó manualmente', () => {
    const { container, ref } = renderPlayerWithRef({ autoPlay: true });
    const video = container.querySelector('video') as HTMLVideoElement;
    const playSpy = vi.fn().mockReturnValue(Promise.resolve());
    video.play = playSpy;

    // Primer parseo (montaje): autoplay dispara play() con normalidad.
    act(() => { handlers.manifestParsed('manifestParsed', {}); });
    expect(playSpy).toHaveBeenCalledTimes(1);

    // El alumno pausa manualmente desde el toggle real (la sala llama a esto,
    // NO se infiere del evento nativo 'pause' — ver test siguiente).
    act(() => { ref.current?.setUserPaused(true); });
    playSpy.mockClear();

    // Nuevo parseo (ej. tras una recarga de recuperación): no debe forzar el play.
    act(() => { handlers.manifestParsed('manifestParsed', {}); });
    expect(playSpy).not.toHaveBeenCalled();
  });

  // Regresión del fix H1: una pausa nativa SIN intención del usuario (tab
  // backgrounded, interrupción del SO, `ended`) no debe envenenar el flag de
  // "pausó a propósito" — de lo contrario el alumno queda trabado en un frame
  // congelado sin que nada lo reactive.
  it('no confunde una pausa nativa no solicitada con una pausa del usuario', () => {
    const { container } = renderPlayer({ autoPlay: true });
    const video = container.querySelector('video') as HTMLVideoElement;
    const playSpy = vi.fn().mockReturnValue(Promise.resolve());
    video.play = playSpy;

    act(() => { handlers.manifestParsed('manifestParsed', {}); });
    expect(playSpy).toHaveBeenCalledTimes(1);

    // Pausa nativa SIN pasar por setUserPaused (ej. backgrounding de pestaña).
    act(() => { video.dispatchEvent(new Event('pause')); });
    playSpy.mockClear();

    // Un nuevo parseo (recarga de recuperación) SÍ debe poder reanudar.
    act(() => { handlers.manifestParsed('manifestParsed', {}); });
    expect(playSpy).toHaveBeenCalledTimes(1);
  });
});
