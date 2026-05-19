# Arquitectura del Modo Podcast (crítico — no romper)

El modo podcast es el feature más delicado de la plataforma. Permite al usuario escuchar el audio de una lección en segundo plano mientras navega por cualquier ruta. Su implementación requirió una arquitectura específica debido a limitaciones de Cloudflare Stream y navegadores.

## 1. Filosofía

**Nunca puede haber dos `<Stream>` de Cloudflare para el mismo video UID en el DOM.** Si hay dos iframes del mismo UID, al destruirse uno (por navegación SPA), Cloudflare Stream corta la sesión de reproducción del otro, silenciando el audio.

## 2. Separación Engine / UI

Para garantizar que el audio nunca se interrumpa, el sistema se divide en dos componentes independientes:

| Componente | Rol | Ubicación en árbol | ¿Se desmonta? |
|---|---|---|---|
| `PodcastEngine` | Contiene el único `<Stream>` de Cloudflare para el podcast. Maneja play/pause, watchdog, restauración de posición. | `main.tsx` — fuera de `BrowserRouter`, `AuthBootstrap`, providers | **Nunca** (una vez activado) |
| `GlobalPodcastPlayer` | Solo UI — barra de controles inferior. Lee tiempo/progreso desde `podcastStreamRef`. | `App.tsx` — dentro de `BrowserRouter` | Sí, si no hay track activo |

`PodcastEngine` exporta una ref global mutable:
```ts
// src/components/feature/PodcastEngine.tsx
export let podcastStreamRef: { current: any } = { current: null };
```

`GlobalPodcastPlayer` y `LessonPlayer` importan esta ref para leer `currentTime`, `duration`, y controlar el stream sin montar su propio iframe.

## 3. Árbol de montaje

```
StrictMode
 └── ErrorBoundary
      └── Fragment
           ├── PodcastEngine         ← FUERA de todo. Nunca se desmonta.
           └── QueryClientProvider
                └── MotionProvider
                     └── TooltipProvider
                          └── AuthBootstrap
                               └── App (BrowserRouter)
                                    ├── AppRoutes
                                    ├── GlobalPodcastPlayer  ← Solo UI, no iframe
                                    └── Toaster
```

## 4. `PodcastEngine` — patrones clave

**`everActivated` (useState):** Una vez que el usuario activa el modo podcast (primer `track ≠ null`), el contenedor `<div>` se monta permanentemente. Cerrar el podcast (`closePlayer`) solo setea `track = null`, el contenedor sigue en el DOM. El `<Stream>` se renderiza condicionalmente (`{track && <Stream>}`) pero el contenedor siempre está, evitando que React lo destruya en re-renders.

**Refs sincronizadas vs stale closures:** Los handlers nativos del `<Stream>` (onPause, onCanPlay, onTimeUpdate) NO pueden depender del closure de React porque se ejecutan en contexto del iframe. Se usan refs paralelas actualizadas con useEffect:
```ts
const isPlayingRef = useRef(false);
useEffect(() => { isPlayingRef.current = isPlaying; }, [isPlaying]);
```

**Watchdog (setInterval 1s):** El navegador puede suspender iframes sin disparar el evento `pause` (especialmente en navegación SPA o cambio de pestaña). El watchdog verifica `el.paused` cada segundo y fuerza `play()` si corresponde. No depende de ningún evento.

**visibilitychange:** Listener que reanuda el audio cuando el documento vuelve a `visible`. Complementa al watchdog para reanudación inmediata (sin esperar el intervalo de 1s).

**Dimensiones del contenedor:** `320×180px` con `transform: translateX(-9999px)`. Chromium clasifica elementos con `width/height < ~50px` como "background" y los suspende. Usar dimensiones reales + desplazamiento fuera del viewport evita esto. `opacity: 0.01` (no `opacity: 0`) porque Chromium también suspende elementos con `opacity: 0`.

## 5. `LessonPlayer` — sin iframe duplicado

Cuando `isPlayingThisInPodcast` (el track activo del podcast coincide con el video de la lección actual), `LessonPlayer` **no renderiza el `<Stream>` del video**:

```tsx
{videoSrc && !isPlayingThisInPodcast && (
  <div key={videoSrc} className="...">
    <Stream ... />
  </div>
)}
```

Esto garantiza que solo haya UN `<Stream>` de Cloudflare en el DOM (el de `PodcastEngine`). Cuando el usuario vuelve al modo video, `closePlayer()` se ejecuta y `isPlayingThisInPodcast` se vuelve `false`, causando que el `<Stream>` del video se monte fresco con `autoplay`.

**Restauración de tiempo al volver del podcast:** Se usa `pendingSeekRef`. Al hacer clic "Volver a Video", se guarda el currentTime del engine (`podcastStreamRef.current?.currentTime`) en el ref. En el primer `onTimeUpdate` del Stream recién montado, se aplica el seek. El usuario escucha ≤100ms de audio desde 0 antes del seek — aceptable y no hay alternativa.

## 6. Flujo de activación

1. Usuario en `/leccion` → activa "Modo Podcast"
2. `handlePodcastToggle` → `playTrack(track, currentTime)` → store setea `track`, `isPodcastMode: true`, `isPlaying: true`
3. `PodcastEngine` re-renderiza: `everActivated` → `true`, `<Stream>` monta, iframe carga, `onCanPlay` → restaura posición → `play()`
4. `LessonPlayer` re-renderiza: `isPlayingThisInPodcast = true` → `<Stream>` del video se desmonta del DOM
5. El audio ahora solo sale del `PodcastEngine` (un iframe)
6. Usuario navega (logo, admin, login, etc.) — `PodcastEngine` no se ve afectado (fuera de Router)
7. Si el navegador suspende el iframe, el watchdog lo retoma en ≤1s

## 7. Historial de bugs resueltos

| Bug | Síntoma | Causa raíz | Fix |
|---|---|---|---|
| Audio doble al activar podcast | Se escuchaban dos audios superpuestos | El `useEffect` que controlaba play/pause del video local salía antes de pausar cuando `isPlayingThisInPodcast` era true | El efecto ahora pausa siempre que `isPlayingThisInPodcast \|\| showAd \|\| !playRequested` |
| Podcast se pausa al navegar a Home/admin | El audio se cortaba al hacer clic en el logo o entrar al admin | `PodcastEngine` estaba dentro de `BrowserRouter` y `AuthBootstrap`. Cambios de ruta/auth causaban re-renders que destruían el iframe | Mover `PodcastEngine` a `main.tsx` fuera de todos los providers |
| Podcast se pausa al navegar (segundo intento) | El audio seguía cortándose pese al fix anterior | `LessonPlayer` mantenía un segundo `<Stream>` del mismo video UID con `opacity-0` (para "no perder el SDK"). Al navegar, este iframe se destruía y Cloudflare cortaba la sesión compartida | Eliminar el `<Stream>` del `LessonPlayer` cuando `isPlayingThisInPodcast` es true |
| Podcast no se reanuda tras volver a la pestaña | El audio quedaba en pausa al volver de otra pestaña | `onPause` del Stream no se disparaba siempre. El closure de React tenía valores stale de `isPlaying`/`isPodcastMode` | Watchdog 1s + refs sincronizadas + visibilitychange listener |
| Contenedor del iframe tenía posición estática | Warning de Cloudflare Stream | El SDK require `position: non-static` para calcular offset | `position: fixed` en el contenedor del engine |
| Podcast se reinicia al activar modo podcast | Al togglear a podcast, el audio volvía a empezar desde 0 en vez de retomar la posición actual | `onTimeUpdate` del iframe recién cargado disparaba `currentTime: 0` antes de que `onCanPlay` hiciera el seek. Ese 0 sobreescribía `lastKnownTime`. | Guard `if (!initializedRef.current) return;` en `handleTimeUpdate` de `PodcastEngine`. Además se agregaron `lastKnownTimeRef`, `trackRef`, `lastVideoIdRef` sincronizados para evitar stale closures en handlers del Stream. |

## 8. Reglas para no romper el modo podcast

1. **Nunca renderizar dos `<Stream>` del mismo video UID.** Si hay un Stream en `PodcastEngine` reproduciendo un UID, ningún otro componente debe renderizar un `<Stream>` con el mismo `src`.
2. **No mover `PodcastEngine` dentro de `BrowserRouter` o `AuthBootstrap`.** Su posición en `main.tsx` como sibling de `QueryClientProvider` es la única garantía de supervivencia.
3. **No confiar en eventos nativos del iframe para reanudación.** El watchdog con `setInterval` es el mecanismo principal. Los eventos `onPause`/`visibilitychange` son complementarios.
4. **Siempre usar refs sincronizadas para valores de store en handlers del Stream.** Los closures de React quedan stale.
5. **`opacity: 0.01` y dimensiones reales (320×180) para el contenedor.** `opacity: 0` o `width/height: 1` causan throttling en Chromium.
6. **No persisitir `isPlaying` en el store.** Al recargar la página, el navegador bloquea autoplay. El estado de reproducción debe comenzar como `false` y activarse con gesto del usuario.
