import { useEffect, useRef, forwardRef, useImperativeHandle, useState } from "react";
import Hls from "hls.js";

export interface QualityLevel {
  index: number;
  height: number;
  bitrate: number;
  label: string;
}

export type LiveLatencyMode = "smooth" | "low" | "dvr";

export interface LiveHLSPlayerHandle {
  video: HTMLVideoElement | null;
  enterFullscreen: () => Promise<void>;
  exitFullscreen: () => Promise<void>;
  setQualityLevel: (index: number) => void;
  getQualityLevels: () => QualityLevel[];
  // Intención EXPLÍCITA del usuario (play/pause toggle). El consumidor debe
  // llamarlo desde la acción real del usuario — el player ya NO infiere esto
  // del evento nativo 'pause' (una pausa por backgrounding de la pestaña,
  // interrupción del SO, o `ended` dispara 'pause' igual que un click).
  setUserPaused: (paused: boolean) => void;
  // Posición del filo LL-HLS que hls.js calcula a partir de PART-HOLD-BACK
  // (modo "low"). `null` si no hay instancia de hls.js (path nativo Safari)
  // o si el manifest todavía no expone esa posición.
  getLiveSyncPosition: () => number | null;
  // Ventana seekable actual (modo "dvr" — crece con la transmisión). `null`
  // si no hay datos seekable todavía.
  getSeekableRange: () => { start: number; end: number } | null;
  // Busca una posición dentro de la ventana seekable, clampada a sus límites.
  seekTo: (position: number) => void;
}

interface LiveHLSPlayerProps {
  liveInputId: string;
  customerCode: string;
  muted: boolean;
  autoPlay?: boolean;
  // "smooth" (default): perfil tipo Twitch/YouTube clásico — ~8s atrás del
  // edge con buffer 20s, fluidez asegurada. "low": ~3s del edge con buffer 10s,
  // baja latencia pero requiere red estable. "dvr": ventana DVR completa de
  // Cloudflare (`?dvrEnabled=true`) — misma config hls.js que "smooth", sin
  // catch-up de latencia, pero con timeline scrubbable y resume de posición.
  latencyMode?: LiveLatencyMode;
  // Pausa de sala (admin marcó `is_paused`). El player se mantiene montado
  // pero pausa el <video>; al reanudar solo retoma si el usuario no había
  // pausado manualmente antes.
  roomPaused?: boolean;
  className?: string;
  // Clave de resume (modo "dvr" solamente) — típicamente el id de la fila
  // `lives`. Persiste la posición de reproducción en localStorage bajo
  // `live-position:<resumeKey>` y la retoma al volver a entrar.
  resumeKey?: string;
  // Se llama cuando el player retomó una posición guardada (modo "dvr").
  onResumed?: (position: number) => void;
  onPlay?: () => void;
  onPause?: () => void;
  onWaiting?: () => void;
  onPlaying?: () => void;
  onError?: (err: string) => void;
  // Se agotaron los reintentos de recarga automática — la UI debe mostrar un
  // estado de error con reintento manual (remount vía `key`).
  onFatalError?: () => void;
  onLevelsChange?: (levels: QualityLevel[], currentLevel: number) => void;
}

const LiveHLSPlayer = forwardRef<LiveHLSPlayerHandle, LiveHLSPlayerProps>(
  function LiveHLSPlayer(
    {
      liveInputId,
      customerCode,
      muted,
      autoPlay = true,
      latencyMode = "smooth",
      roomPaused = false,
      className,
      resumeKey,
      onResumed,
      onPlay,
      onPause,
      onWaiting,
      onPlaying,
      onError,
      onFatalError,
      onLevelsChange,
    },
    ref,
  ) {
    const videoRef = useRef<HTMLVideoElement>(null);
    const hlsRef = useRef<Hls | null>(null);
    // Lock para que la recuperación por evento y el watchdog no recarguen a la vez.
    const reloadingRef = useRef(false);
    // Intención EXPLÍCITA del usuario: solo la cambia `setUserPaused` (invocado
    // por el toggle play/pause de la sala), NUNCA el evento nativo 'pause' —
    // ese evento también dispara por backgrounding de la pestaña, interrupción
    // del SO o `ended`, y confundirlo con un pause manual dejaba al alumno
    // trabado en un frame congelado sin recuperación posible. Gatea el
    // autoplay tras reconexión y el resume tras una pausa de sala.
    const userPausedRef = useRef(false);
    const [levels, setLevels] = useState<QualityLevel[]>([]);
    // Refs para leer siempre el valor más reciente de `resumeKey`/`onResumed`
    // desde dentro del efecto principal sin tener que agregarlos a sus deps
    // (evitaría recrear la instancia de Hls innecesariamente).
    const resumeKeyRef = useRef(resumeKey);
    resumeKeyRef.current = resumeKey;
    const onResumedRef = useRef(onResumed);
    onResumedRef.current = onResumed;

    useImperativeHandle(ref, () => ({
      video: videoRef.current,
      enterFullscreen: async () => {
        const v = videoRef.current;
        if (!v) return;

        // iOS Safari: el único path posible es webkitEnterFullscreen sobre el <video>.
        // El iframe/wrapper NO soporta requestFullscreen en iOS Safari < 17.
        const iosFs = (v as unknown as { webkitEnterFullscreen?: () => void }).webkitEnterFullscreen;
        if (typeof iosFs === "function") {
          try { iosFs.call(v); return; } catch (e) { console.warn("[LiveHLSPlayer] iOS fs failed", e); }
        }

        // Defensivo: probar wrapper → video, con todos los prefijos legacy.
        const wrapper = v.parentElement;
        const candidates: Array<{ el: Element; methods: string[] }> = [];
        if (wrapper) candidates.push({ el: wrapper, methods: ["requestFullscreen", "webkitRequestFullscreen", "mozRequestFullScreen", "msRequestFullscreen"] });
        candidates.push({ el: v, methods: ["requestFullscreen", "webkitRequestFullscreen", "mozRequestFullScreen", "msRequestFullscreen"] });

        for (const { el, methods } of candidates) {
          for (const m of methods) {
            const fn = (el as unknown as Record<string, unknown>)[m];
            if (typeof fn === "function") {
              try { await (fn as () => Promise<void>).call(el); return; }
              catch (e) { console.warn(`[LiveHLSPlayer] ${m} failed`, e); }
            }
          }
        }

        console.warn("[LiveHLSPlayer] No fullscreen API available");
      },
      exitFullscreen: async () => {
        const exits = ["exitFullscreen", "webkitExitFullscreen", "mozCancelFullScreen", "msExitFullscreen"];
        for (const m of exits) {
          const fn = (document as unknown as Record<string, unknown>)[m];
          if (typeof fn === "function") {
            try { await (fn as () => Promise<void>).call(document); return; }
            catch (e) { console.warn(`[LiveHLSPlayer] ${m} failed`, e); }
          }
        }
      },
      setQualityLevel: (index: number) => {
        if (hlsRef.current) {
          // `nextLevel` cambia en el próximo fragmento, sin vaciar el buffer
          // actual. `currentLevel` fuerza un flush inmediato (latigazo visible).
          hlsRef.current.nextLevel = index;
        }
      },
      getQualityLevels: () => levels,
      setUserPaused: (paused: boolean) => {
        userPausedRef.current = paused;
      },
      getLiveSyncPosition: () => hlsRef.current?.liveSyncPosition ?? null,
      getSeekableRange: () => {
        const video = videoRef.current;
        if (!video || !video.seekable.length) return null;
        return { start: video.seekable.start(0), end: video.seekable.end(video.seekable.length - 1) };
      },
      seekTo: (position: number) => {
        const video = videoRef.current;
        if (!video || !video.seekable.length) return;
        const start = video.seekable.start(0);
        const end = video.seekable.end(video.seekable.length - 1);
        const clamped = Math.min(Math.max(position, start), end);
        try { video.currentTime = clamped; } catch { /* seekable todavía no listo */ }
      },
    }));

    useEffect(() => {
      const video = videoRef.current;
      if (!video || !liveInputId || !customerCode) return;

      // Dos perfiles:
      // - "smooth" (default): HLS estándar (sin LL-HLS), ~8s del edge, buffer
      //   20s. Tipo Twitch/YouTube clásico. Es el fallback si LL-HLS da
      //   problemas — se mantiene intacto.
      // - "low": LL-HLS real vía el flag `?protocol=llhls` de Cloudflare
      //   Stream (beta). El manifest expone PART-TARGET/PART-HOLD-BACK y
      //   partes de 0.5s; con `lowLatencyMode: true` hls.js deriva su propio
      //   target de latencia de esos tags — por eso NO fijamos
      //   liveSyncDuration/liveMaxLatencyDuration en este modo (fijarlos
      //   pisa el cálculo automático y anula la ganancia de LL-HLS).
      //   Esperado: ~2-4s del edge. Para minimizar latigazos sin tocar el
      //   delay: subimos maxBufferLength (más colchón forward), suavizamos
      //   el ABR (EWMA largo + factor conservador) y el catchup permite
      //   hasta 1.1x (los "parts" LL-HLS son más chicos, hay más margen que
      //   con segmentos enteros de 2s).
      const lowLatency = latencyMode === "low";
      // "dvr": DVR de Cloudflare Stream vía `?dvrEnabled=true`. Medido en vivo
      // real: HLS v8, latencia p50 14.6s, ventana seekable CRECE con la
      // transmisión (88s → 144s en la prueba), 0 stalls, misma config hls.js
      // que "smooth" (lowLatency queda en false). `?protocol=llhls&dvrEnabled=true`
      // da HTTP 500 — DVR y LL-HLS son mutuamente excluyentes, nunca combinar.
      const isDvr = latencyMode === "dvr";
      const manifestUrl = lowLatency
        ? `https://customer-${customerCode}.cloudflarestream.com/${liveInputId}/manifest/video.m3u8?protocol=llhls`
        : isDvr
        ? `https://customer-${customerCode}.cloudflarestream.com/${liveInputId}/manifest/video.m3u8?dvrEnabled=true`
        : `https://customer-${customerCode}.cloudflarestream.com/${liveInputId}/manifest/video.m3u8`;

      // Modo "dvr": persiste `video.currentTime` en localStorage cada 5s (y al
      // pausar) para retomar donde quedó el alumno. Wrapped en try/catch —
      // localStorage puede tirar en modo privado estricto de Safari.
      const getPositionStorageKey = () => {
        const key = resumeKeyRef.current;
        return key ? `live-position:${key}` : null;
      };
      const savePosition = () => {
        if (!isDvr) return;
        const key = getPositionStorageKey();
        if (!key) return;
        try {
          localStorage.setItem(key, JSON.stringify({ position: video.currentTime, savedAt: Date.now() }));
        } catch { /* localStorage no disponible (modo privado) */ }
      };
      let positionSaveInterval: number | null = null;
      if (isDvr) {
        positionSaveInterval = window.setInterval(() => {
          if (!video.paused) savePosition();
        }, 5000);
        video.addEventListener("pause", savePosition);
      }

      let hls: Hls | null = null;
      let mediaErrorRetries = 0;
      let didSeekToLiveEdge = false;
      let stallTimer: number | null = null;
      let pendingReloadTimeout: number | null = null;
      let reloadCooldownTimeout: number | null = null;
      let handlePlaybackRecovered: (() => void) | null = null;
      let clearStableTimer: (() => void) | null = null;
      let llCatchUpInterval: number | null = null;
      let handleLLCatchUpOnPlay: (() => void) | null = null;

      if (Hls.isSupported()) {
        hls = new Hls({
          enableWorker: true,
          lowLatencyMode: lowLatency,
          backBufferLength: lowLatency ? 6 : 10,
          maxBufferLength: lowLatency ? 12 : 20,
          maxMaxBufferLength: lowLatency ? 24 : 40,
          // Solo para "smooth".
          // - En "low" NO se fijan: hls.js los deriva de PART-HOLD-BACK del
          //   manifest LL-HLS; fijarlos acá pisa ese cálculo y anula LL-HLS.
          // - En "dvr" NO se fijan porque `liveMaxLatencyDuration` hace que
          //   hls.js considere un error estar a más de N segundos del filo y
          //   devuelva al usuario al vivo de un salto. En Clase completa el
          //   espectador tiene que poder quedarse donde quiera de la ventana.
          ...(lowLatency || isDvr
            ? {}
            : {
                liveSyncDuration: 8,
                // 2.5x el liveSyncDuration. Permite catchup suave; si excede, seek al edge.
                liveMaxLatencyDuration: 20,
              }),
          liveDurationInfinity: true,
          startLevel: -1,
          // Catchup: 10% en low (partes LL-HLS más chicas dan más margen sin
          // que se note), 0% (sin catchup) en smooth como antes.
          maxLiveSyncPlaybackRate: lowLatency ? 1.1 : 1.0,
          abrBandWidthFactor: lowLatency ? 0.7 : 0.8,
          abrBandWidthUpFactor: lowLatency ? 0.5 : 0.7,
          abrEwmaFastLive: 3.0,
          abrEwmaSlowLive: 9.0,
          fragLoadingMaxRetry: 6,
          manifestLoadingMaxRetry: 4,
          levelLoadingMaxRetry: 4,
        });
        hlsRef.current = hls;

        hls.loadSource(manifestUrl);
        hls.attachMedia(video);

        // Mapea hls.levels[] a QualityLevel[]. Helper para reusar tanto en
        // MANIFEST_PARSED como en LEVEL_SWITCHED — éste último necesita recomputar
        // y NO leer del state React, porque la closure del useEffect captura el
        // `levels` inicial vacío (stale closure clásico).
        const computeLevels = (h: Hls): QualityLevel[] =>
          h.levels.map((lvl, i) => ({
            index: i,
            height: lvl.height || 0,
            bitrate: lvl.bitrate || 0,
            label: lvl.height ? `${lvl.height}p` : `${Math.round((lvl.bitrate || 0) / 1000)} kbps`,
          }));

        // LL-HLS catch-up (modo "low" solamente). Medido en vivo real: hls.js
        // arranca con `targetLatency` correcto (≈1.5s, del PART-HOLD-BACK) pero
        // el reproductor entra ~7-8s atrás del edge y `maxLatencyDuration` no
        // está seteado (a propósito, ver arriba) — no hay seek forzado propio
        // de hls.js. Sin este catch-up manual, el modo "low" queda pegado al
        // atraso inicial y nunca converge a la latencia real de LL-HLS.
        // Un seek único a `liveSyncPosition` en cuanto detectamos el atraso
        // resuelve esto: se probó en vivo y estabiliza en ~2.3s sin stalls.
        const LL_LATENCY_MARGIN = 3;
        const LL_CATCHUP_COOLDOWN_MS = 30_000;
        const LL_CHECK_INTERVAL_MS = 10_000;
        let lastLLSeekAt = -Infinity;
        let pendingLLCatchUpCheck = false;

        const attemptLLCatchUp = (requireForwardBuffer: boolean) => {
          if (!lowLatency || !hls) return;
          if (userPausedRef.current || video.paused) return;

          const latency = hls.latency;
          const targetLatency = hls.targetLatency ?? 1.5;
          const syncPosition = hls.liveSyncPosition;
          if (!Number.isFinite(latency) || latency <= targetLatency + LL_LATENCY_MARGIN) return;
          if (syncPosition == null || !Number.isFinite(syncPosition)) return;

          if (requireForwardBuffer) {
            const buffered = video.buffered;
            if (!buffered.length) return;
            const forwardBuffer = buffered.end(buffered.length - 1) - video.currentTime;
            if (forwardBuffer < 1) return;
          }

          const now = Date.now();
          if (now - lastLLSeekAt < LL_CATCHUP_COOLDOWN_MS) return;
          lastLLSeekAt = now;

          console.info("[LiveHLSPlayer] LL catch-up seek", { latency, targetLatency, seekTo: syncPosition });
          try { video.currentTime = syncPosition; } catch { /* seekable todavía no listo */ }
        };

        if (lowLatency) {
          handleLLCatchUpOnPlay = () => {
            if (!pendingLLCatchUpCheck) return;
            pendingLLCatchUpCheck = false;
            attemptLLCatchUp(false);
          };
          video.addEventListener("playing", handleLLCatchUpOnPlay);
          llCatchUpInterval = window.setInterval(() => attemptLLCatchUp(true), LL_CHECK_INTERVAL_MS);
        }

          // Modo "dvr": retoma la posición guardada (<12h) si cae dentro de la
        // ventana navegable. Se intenta en MANIFEST_PARSED y de nuevo en
        // LEVEL_UPDATED porque `video.seekable` suele estar vacío en el
        // primero — sin el segundo intento el alumno siempre arrancaba en el
        // filo del vivo y la posición guardada no servía de nada.
        const tryRestoreSavedPosition = (): boolean => {
          if (!isDvr || didSeekToLiveEdge) return false;
          const key = getPositionStorageKey();
          if (!key || !video.seekable.length) return false;
          try {
            const raw = localStorage.getItem(key);
            if (!raw) return false;
            const saved = JSON.parse(raw) as { position?: number; savedAt?: number };
            const MAX_AGE_MS = 12 * 60 * 60 * 1000;
            const isFresh =
              Number.isFinite(saved.position) &&
              Number.isFinite(saved.savedAt) &&
              Date.now() - (saved.savedAt as number) < MAX_AGE_MS;
            if (!isFresh) return false;
            const start = video.seekable.start(0);
            const end = video.seekable.end(video.seekable.length - 1);
            const position = saved.position as number;
            if (position < start || position > end - 2) return false;
            video.currentTime = position;
            didSeekToLiveEdge = true;
            onResumedRef.current?.(position);
            return true;
          } catch {
            // localStorage bloqueado o JSON inválido — arranca al filo como siempre.
            return false;
          }
        };

        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          // Este handler corre también tras cada recarga por recuperación
          // (H8). Si el usuario pausó a propósito, no lo reactivamos.
          if (autoPlay && !userPausedRef.current) {
            video.play().catch(() => {
              // Autoplay con sonido bloqueado por el browser — el overlay "Activar sonido" lo resuelve
            });
          }
          const parsed = computeLevels(hls!);
          setLevels(parsed);
          onLevelsChange?.(parsed, hls!.currentLevel);

        // Arma el catch-up de LL-HLS para el próximo 'playing': cubre tanto
          // el montaje inicial como cualquier recarga por recuperación (H8),
          // ya que executeReload vuelve a disparar MANIFEST_PARSED.
          if (lowLatency) pendingLLCatchUpCheck = true;

          // Modo "dvr": si hay una posición guardada fresca (<12h) y cae
          // dentro de la ventana seekable actual, retomamos ahí en vez del
          // filo del vivo. Si `video.seekable` todavía no tiene datos en este
          // punto (puede pasar, MANIFEST_PARSED dispara antes de cargar
          // fragmentos) simplemente no restauramos — el seek al filo del vivo
          // de siempre (LEVEL_UPDATED, más abajo) sigue su curso normal.
          if (isDvr) tryRestoreSavedPosition();
        });

        // Diagnóstico LL-HLS — TEMPORAL. Loggea una vez si el manifest expone los
        // tags de Low-Latency HLS. Esperado "SÍ" en modo "low" (manifest con
        // `?protocol=llhls`); "NO" en "smooth" (HLS estándar a propósito).
        let llhlsLogged = false;
        hls.on(Hls.Events.LEVEL_LOADED, (_, data) => {
          if (llhlsLogged) return;
          llhlsLogged = true;
          const d = data.details;
          const isLLHLS = !!(d.partTarget || (d.partList && d.partList.length > 0));
          console.log("%c[LL-HLS Check]", "color:#CCA43B;font-weight:bold", {
            "✓ LL-HLS activo": isLLHLS ? "SÍ" : "NO",
            partTarget: d.partTarget,
            holdBack: d.holdBack,
            partHoldBack: d.partHoldBack,
            targetduration: d.targetduration,
            live: d.live,
            manifestUrl,
          });
        });

        hls.on(Hls.Events.LEVEL_SWITCHED, (_, data) => {
          if (!hlsRef.current) return;
          const parsed = computeLevels(hlsRef.current);
          onLevelsChange?.(parsed, data.level);
        });

        // Arranca SIEMPRE en el borde en vivo, no desde el inicio del DVR. Sin esto,
        // tras una pausa (que remonta este player) la reproducción volvía al principio
        // de la grabación en vez de retomar el vivo. `liveSyncPosition` respeta el
        // perfil de latencia elegido (smooth ~8s / low ~2-3s del edge).
        hls.on(Hls.Events.LEVEL_UPDATED, () => {
          if (didSeekToLiveEdge || !hls) return;
          // En "dvr" la posición guardada gana sobre el filo del vivo. Acá
          // `video.seekable` ya tiene datos, a diferencia de MANIFEST_PARSED.
          if (tryRestoreSavedPosition()) return;
          const edge = hls.liveSyncPosition;
          if (edge != null && Number.isFinite(edge)) {
            try { video.currentTime = edge; } catch { /* seekable todavía no listo */ }
            didSeekToLiveEdge = true;
          }
        });

        // Recuperación REAL ante un fallo de red persistente. `startLoad()` solo
        // reanuda con el manifest que hls.js ya tiene en memoria — si las URLs
        // firmadas de los segmentos vencieron o Cloudflare las rechaza (se vio un
        // 413 sostenido en un vivo), vuelve a fallar con los mismos datos y el
        // player queda "cargando" hasta que el usuario da F5. Esto es ese F5, pero
        // interno: manifest fresco, tokens frescos, y de vuelta al borde en vivo.
        // Backoff exponencial + tope total de recargas. Antes se reintentaba
        // sin límite (con solo una ventana de 4s anti-cascada): un fallo
        // persistente entraba en loop de recargas infinito.
        const MAX_RELOAD_ATTEMPTS = 6;
        let reloadAttempts = 0;

        const executeReload = (reason: string) => {
          if (!hls) return;
          console.warn(`[LiveHLSPlayer] recargando el manifest (${reason})`);
          didSeekToLiveEdge = false;
          try {
            hls.stopLoad();
            hls.loadSource(manifestUrl);
            hls.startLoad(-1);
          } finally {
            // Ventana corta para que la propia recarga no dispare otro trigger en cascada.
            reloadCooldownTimeout = window.setTimeout(() => {
              reloadCooldownTimeout = null;
              reloadingRef.current = false;
            }, 1000);
          }
        };

        const reloadFromScratch = (reason: string) => {
          if (!hls || reloadingRef.current) return;
          if (reloadAttempts >= MAX_RELOAD_ATTEMPTS) {
            console.error(`[LiveHLSPlayer] se alcanzó el máximo de ${MAX_RELOAD_ATTEMPTS} reintentos, abandonando`);
            onFatalError?.();
            return;
          }
          reloadingRef.current = true;
          const attempt = reloadAttempts;
          reloadAttempts++;
          const delay = Math.min(8000, 1000 * 2 ** attempt);
          pendingReloadTimeout = window.setTimeout(() => {
            pendingReloadTimeout = null;
            executeReload(reason);
          }, delay);
        };

        // Solo reseteamos el contador de reintentos tras reproducción ESTABLE
        // sostenida (15s sin 'waiting'/'stalled'/error desde el último
        // 'playing') — resetear en cada 'playing' individual permitía que una
        // conexión intermitente (play/stall/play/stall...) nunca escalara el
        // backoff ni disparara onFatalError.
        const STABLE_PLAYBACK_MS = 15000;
        let stableTimeoutId: number | null = null;
        clearStableTimer = () => {
          if (stableTimeoutId !== null) {
            window.clearTimeout(stableTimeoutId);
            stableTimeoutId = null;
          }
        };
        handlePlaybackRecovered = () => {
          clearStableTimer!();
          stableTimeoutId = window.setTimeout(() => {
            stableTimeoutId = null;
            reloadAttempts = 0;
          }, STABLE_PLAYBACK_MS);
        };
        video.addEventListener("playing", handlePlaybackRecovered);
        video.addEventListener("waiting", clearStableTimer);
        video.addEventListener("stalled", clearStableTimer);

        hls.on(Hls.Events.ERROR, (_, data) => {
          // Cualquier error interrumpe la ventana de estabilidad — no cuenta
          // como recuperación sostenida.
          clearStableTimer?.();
          // Los no-fatales también dejan rastro: sin esto el 413 de los segmentos
          // era invisible hasta que el player ya estaba clavado.
          if (!data.fatal) {
            if (data.details === Hls.ErrorDetails.FRAG_LOAD_ERROR || data.details === Hls.ErrorDetails.LEVEL_LOAD_ERROR) {
              console.warn("[LiveHLSPlayer] carga fallida (reintentando)", data.details, data.response?.code ?? "");
            }
            return;
          }
          if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
            reloadFromScratch(`network: ${data.details}`);
          } else if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
            mediaErrorRetries++;
            if (mediaErrorRetries > 2) {
              console.error("[LiveHLSPlayer] media error, unrecoverable", data.details);
              onError?.(`Error de reproducción: ${data.details}`);
              return;
            }
            console.warn("[LiveHLSPlayer] media error, recovering...", data.details);
            hls!.recoverMediaError();
          } else {
            console.error("[LiveHLSPlayer] fatal error", data);
            onError?.(`Error: ${data.details}`);
          }
        });
        // Watchdog de estancamiento. Cubre el caso que hls.js NO reporta como fatal:
        // el video quiere reproducir (no está pausado por el usuario) pero currentTime
        // no avanza. Si pasa STALL_SECONDS así, recargamos el manifest. Es la red de
        // seguridad detrás de la recuperación por evento — el "F5 automático".
        const STALL_SECONDS = 12;
        let lastTime = video.currentTime;
        let stalledFor = 0;
        stallTimer = window.setInterval(() => {
          if (!hls || video.paused || video.ended) { stalledFor = 0; lastTime = video.currentTime; return; }
          if (video.currentTime > lastTime + 0.2) {
            stalledFor = 0;
            lastTime = video.currentTime;
            return;
          }
          stalledFor += 1;
          if (stalledFor >= STALL_SECONDS) {
            stalledFor = 0;
            reloadFromScratch(`sin avance durante ${STALL_SECONDS}s`);
          }
        }, 1000);
      } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
        // iOS Safari y desktop Safari: HLS nativo (no necesita hls.js)
        video.src = manifestUrl;
        if (autoPlay) {
          video.addEventListener(
            "loadedmetadata",
            () => {
              if (!userPausedRef.current) {
                video.play().catch(() => {});
              }
            },
            { once: true },
          );
        }
      } else {
        onError?.("HLS no soportado en este navegador");
      }

      return () => {
        if (positionSaveInterval !== null) window.clearInterval(positionSaveInterval);
        if (isDvr) video.removeEventListener("pause", savePosition);
        if (llCatchUpInterval !== null) window.clearInterval(llCatchUpInterval);
        if (handleLLCatchUpOnPlay) video.removeEventListener("playing", handleLLCatchUpOnPlay);
        if (stallTimer !== null) window.clearInterval(stallTimer);
        if (pendingReloadTimeout !== null) window.clearTimeout(pendingReloadTimeout);
        if (reloadCooldownTimeout !== null) window.clearTimeout(reloadCooldownTimeout);
        clearStableTimer?.();
        if (handlePlaybackRecovered) video.removeEventListener("playing", handlePlaybackRecovered);
        if (clearStableTimer) {
          video.removeEventListener("waiting", clearStableTimer);
          video.removeEventListener("stalled", clearStableTimer);
        }
        reloadingRef.current = false;
        if (hls) {
          hls.destroy();
          hlsRef.current = null;
        }
      };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [liveInputId, customerCode, latencyMode]);

    // H7: pausa de sala. Se mantiene el <video> montado; solo se pausa/reanuda
    // el elemento. Al reanudar, respeta la intención del usuario: si pausó a
    // propósito antes de la pausa de sala, no lo reactivamos por él.
    // `isFirstRunRef` evita que este efecto dispare un `play()` en el montaje
    // inicial (donde `roomPaused` arranca en `false` y el <video> arranca
    // pausado por defecto) — ese arranque ya lo maneja MANIFEST_PARSED/autoPlay.
    const isFirstRoomPausedRunRef = useRef(true);
    useEffect(() => {
      const video = videoRef.current;
      if (!video) return;
      if (isFirstRoomPausedRunRef.current) {
        isFirstRoomPausedRunRef.current = false;
        if (roomPaused && !video.paused) {
          video.pause();
        }
      } else if (roomPaused) {
        if (!video.paused) video.pause();
      } else if (!userPausedRef.current && video.paused) {
        video.play().catch(() => {});
      }

      // La pestaña backgrounded en mobile Safari/Chrome pausa el <video>
      // "solo": ni pausa de sala ni pausa del usuario. Al volver a foco,
      // reintentamos play() si nada legítimo lo tiene pausado.
      const handleVisibility = () => {
        if (
          document.visibilityState === "visible" &&
          video.paused &&
          !userPausedRef.current &&
          !roomPaused
        ) {
          video.play().catch(() => {});
        }
      };
      document.addEventListener("visibilitychange", handleVisibility);
      return () => document.removeEventListener("visibilitychange", handleVisibility);
    }, [roomPaused]);

    return (
      <video
        ref={videoRef}
        muted={muted}
        playsInline
        autoPlay={autoPlay}
        preload="auto"
        className={className}
        onPlay={() => {
          userPausedRef.current = false;
          onPlay?.();
        }}
        onPause={onPause}
        onWaiting={onWaiting}
        onPlaying={onPlaying}
      />
    );
  },
);

export default LiveHLSPlayer;
