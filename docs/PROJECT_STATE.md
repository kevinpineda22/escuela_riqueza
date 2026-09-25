# Estado del proyecto — Escuela de la Riqueza

> Actualizado 2026-05-19. Inventario vivo de qué está implementado, qué falta, y en qué estado visual está cada panel.
> Para el historial de cambios cronológico, ver `docs/CHANGELOG.md`.
> Para la arquitectura del modo podcast (sensible, no romper), ver `docs/PODCAST_ARCHITECTURE.md`.

---

## 1. Funcionalidad implementada

**Auth (real, Supabase)**
- `AuthPage.tsx` unificado: 3 modos en la misma shell — `signin` / `signup` / `forgot`. Sin navegar entre rutas.
- Mecánica desktop: card 860×560 con dos formularios siempre montados + overlay dorado deslizante con Framer Motion. Mobile: tabs + crossfade.
- `forgot` se trata como `signin` para el overlay (queda a la derecha). El submit muestra estado "Revisa tu correo".
- Rutas: `/login`, `/registro`, `/recuperar-contrasena`, `/restablecer-contrasena` (esta última sigue como `ResetPassword.tsx` standalone para honrar el deep-link del email).
- Supabase Auth + RLS por plan. `useAuth` hook + `useAuthStore` (zustand).
- **Flujo de registro con plan:** `PlansAct` en landing redirige a `/registro?plan=vip`. El `AuthPage` en modo signup tiene 3 pasos: formulario → elegir plan → mock de pago. Al registrarse, la cuenta se crea con el plan seleccionado (simulación de Stripe). Si el plan es free, se omite el paso de pago.

**Contenido y reproducción**
- `AdminContentManager.tsx`: CRUD real de módulos y lecciones contra Supabase.
- `AdminVideoUpload.tsx`: drag & drop a Cloudflare Stream vía `/api/stream/upload-url.ts` (Vercel Function que firma el upload directo).
- `LessonPlayer.tsx`: pre-roll con `<Stream>` de Cloudflare, skip a los 30s. Cuando el modo podcast está activo, NO renderiza el `<Stream>` del video para evitar que haya dos iframes del mismo video UID en el DOM (eso corrompía la sesión de Cloudflare).
- `PodcastEngine.tsx`: motor de audio del modo podcast, montado en `main.tsx` **fuera** de `BrowserRouter`, `AuthBootstrap` y todos los providers. Nunca se desmonta una vez activado. Contiene el único `<Stream>` de Cloudflare para el podcast.
- `GlobalPodcastPlayer.tsx`: solo UI — barra de controles inferior (play/pause, seek, volumen, skip ±10s, cerrar). Lee tiempo/progreso desde `podcastStreamRef` (ref global exportada por `PodcastEngine`). No contiene ningún iframe.
- `player.store.ts`: store Zustand con `persist`. Persiste: `track`, `isPodcastMode`, `volume`, `lastKnownTime`, `lastVideoId`. NO persiste: `isPlaying` (para respetar autoplay policies del navegador al recargar). `PodcastTrack.id` tipo `string | number`.
- `LessonViewer.tsx`: modo podcast + notas + playlist por módulo.
- Lógica de planes: columna `allowed_plans` (array) en `modules`, `lessons`, `lives`. Filtrado estricto en `StudentDashboard.tsx` por `user.plan`.

**Progreso de lecciones y certificados**
- Tabla `user_lesson_progress` en Supabase con RLS (`user_id`, `lesson_id`, `progress_seconds`, `is_completed`). FK a `auth.users` y `lessons`.
- `src/lib/api/stream/progress.ts`: API completa (fetchUserProgress, saveUserProgress, fetchAllUserProgress) con upsert por conflicto `(user_id, lesson_id)`.
- `LessonPlayer.tsx`: auto-guardado cada 10s en Supabase vía `handleTimeUpdate`. Marca `is_completed: true` al alcanzar 90% del video.
- Modal de retomo: si el usuario vuelve a una lección con progreso >5s y no completada, sale un Dialog premium con "Continuar viendo" (seek al segundo exacto) o "Iniciar de nuevo".
- `StudentDashboard.tsx`: barras de progreso doradas por módulo en la vista de grilla. Lecciones con check verde en la playlist. Pestaña Certificados reconstruida con cards por módulo (brilla dorado si 100%, gris/bloqueado si menos).
- Mutex video/podcast: `podcastTrack.id` cambiado a `string | number` para compatibilidad con UUIDs reales.

**Lives**
- `AdminLiveManager.tsx`: CRUD de salas con schema real (`starts_at`, `status`, `stream_live_input_id`, `allowed_plans`, `required_plan`, `is_active`). Timezone auto-detected con badge. Drag & drop de imagen de fondo a Supabase Storage (bucket `backgrounds`). Botón "Forzar EN VIVO" con mutex. Botón Activar/Inactivar por sala (columna `is_active`). Guía OBS estabilidad-primero (ethernet, keyframe 2, bitrate según upload). Botón "Archivar en R2" + replay firmado; las grabaciones se **auto-archivan a R2** vía Worker cron (ver `docs/RECORDINGS_ARCHITECTURE.md`).
- **Sala en vivo** (`src/components/feature/live-room/`, compartida por la sala VIP y la pública desde F37): `LiveRoom` compone el layout (`stacked` celular vertical / `side` pantalla amplia / `compact` horizontal con poca altura), el escenario (`LiveStage`: player, replay, finalizada, pausa, espera), el header, el chat plegable y la presencia. Reproductor **HLS** (`LiveHLSPlayer`, hls.js) con tres modos: Fluidez (~8 s), Baja latencia (LL-HLS, ~2-4 s) y Clase completa (DVR con retomar posición). No hay WebRTC ni latencia menor a 1 s. Ver `docs/LIVE_UX_REDESIGN_AUDIT.md`.
- `VIPLiveRoom.tsx`: resuelve la sala activa del plan del alumno (Realtime sobre `lives` + polling 3 s, errores de carga con reintento) y la señal de OBS; la presentación es `LiveRoom`. Valida `allowed_plans` al entrar y redirige al dashboard si el plan no está.
- `PublicLiveRoom.tsx`: link público por `share_token`, solo polling; repetición paga salvo `replay_is_public`.
- `LiveChat.tsx`: chat en tiempo real (Supabase Realtime) con historial de los últimos 200, seguimiento del final que respeta la lectura, borrador que no se pierde y reintento sin duplicados.
- `CommunityFeed.tsx` (Foro VIP): Foro tipo Reddit con categorias (pregunta, discusión, recurso), ordenamiento (reciente/popular), anidamiento de comentarios de 1 nivel, botones de "Me gusta". Usa `sql/sync_community.sql` (RLS para que solo VIP y Admins puedan interactuar).

**Admin shell**
- `AdminLayout.tsx`: sidebar premium con shimmer en item activo, profile card, mouse-tracking glow, animated orbs en fondo. Sheet en mobile.
- `AdminMetrics.tsx`: KPIs cards, gráfico de áreas (recharts), top módulos. Conectado a datos reales de Supabase vía `src/lib/api/admin/metrics.ts` (cuenta usuarios por plan, ingresos del período). Filtros por período (7d, mes, año, todo) integrados vía RPC.
- `AdminUsers.tsx`: tabla con búsqueda, filtros por plan/rol, cambio de plan mediante modal, eliminación de usuarios. Datos reales desde Supabase vía `src/lib/api/admin/users.ts`.
- `AdminSettings.tsx`: secciones agrupadas (Marca, Pagos, Notificaciones, Integraciones). Forms premium.

**Animación / preferencias**
- `MotionProvider.tsx`: envuelve la app en `MotionConfig`, controla Lenis en desktop, respeta `prefers-reduced-motion` y el toggle global del usuario.
- `AnimationToggle.tsx`: control persistido en `preferences.store` (zustand).
- `routes.tsx`: Enuelto en `AnimatePresence` con `PageTransition` wrapper para transiciones fluidas de fade y blur entre páginas.
- `src/components/ui/dialog.tsx`: Componente base de modal premium con backdrop blur, ring focus accesible y estética alineada.

---

## 2. Funcionalidad pendiente (la trabaja el compañero de equipo)
- `/api/stream/playback-token.ts` — token firmado para reproducir VOD premium sin que se filtre la URL.
- `/api/stripe/checkout.ts` + `/api/stripe/webhook.ts` — sincronización de plan vía suscripciones real de Stripe.
- Tabla `subscriptions` existe y se crea vía trigger SQL en signup, pero sin webhook Stripe real que la mantenga sincronizada.
- Generación de tipos `src/types/database.ts` con `supabase gen types`.
- Cloudflare R2 para PDFs / recursos descargables.

---

## 3. Estado visual por panel (100% frontend — owner del proyecto)

**🟢 PREMIUM (funcional y con buen diseño)**
- `LandingPage.tsx` y todos sus actos (`HeroCinematic`, `AwakeningAct`, `IntelligencesAct`, `PathAct`, `PlansAct`).
- `AuthPage.tsx` (signin/signup/forgot) y `ResetPassword.tsx`.
- `NotFound.tsx` (404 cinemático), `ErrorBoundary` (UI premium con retry), `AuthSplash` (logo halo + ring).
- `AdminLayout.tsx` y `AdminVideoUpload.tsx`.
- `AdminMetrics.tsx`, `AdminUsers.tsx`, `AdminSettings.tsx` (Fase 3 completada con recharts y mocks).
- `StudentDashboard.tsx` (Fase 4 completada con progreso real, módulos conectados a DB, insignias y certificados por módulo).
- `VIPLiveRoom.tsx` (flujo completo: countdown → intro cinemática → reproductor HLS + chat real).
- `AdminLiveManager.tsx` (CRUD completo con schema real, drag-drop imagen, timezone Colombia, guía OBS).
- `Plans.tsx` (página pública `/planes` completa con FAQ interactivo y tabla comparativa).
- `HistoryPage.tsx` (página `/historia` con video Cloudflare Stream embebido y copia profesional).
- `TermsPage.tsx` y `PrivacyPage.tsx` (páginas legales profesionales con contactos formales).
- `EmailConfirmed.tsx` (post-signup: checking/success/error estados con auto-redirect).
- `AdminUserDetail.tsx` (drill-down: perfil, suscripción, acciones — modificar plan/suspender/eliminar).

**🟢 PREMIUM (movidos desde DECENT tras auditoría 2026-05-19)**
- `Header.tsx` — `<Sheet>` mobile completo con user card, drill-down al panel, toggle animaciones, logout. Desktop con badge admin + avatar dorado.
- `Footer.tsx` — gradient dorado superior, glow radial ambiental (desktop), 4 redes sociales (IG/YT/FB/WA), tagline cinemático con balance de texto.
- `LiveChat.tsx` — `AnimatePresence` con entrance lateral por dueño del mensaje, Skeleton al cargar, input premium con focus ring dorado, badge `ShieldCheck` para sistema.
- `AdminContentManager.tsx` — stats bar, cards con línea dorada superior, drag-zone con estados hover/focus/disabled, upload progress animado, reordenar módulos con flechas.

**🟡 DECENT (gold/dark aplicado pero falta polish)**
- `LessonPlayer.tsx` — falta: skeleton al cargar metadata, skin custom sobre `<Stream>`.
- `GlobalPodcastPlayer.tsx` — falta: thumb del slider custom, pulse en barras durante playback, expand/collapse mobile.
- `LiveChat.tsx` — única feature faltante: indicador "está escribiendo".

**🔴 BASIC / LEGACY (a decidir si se borra o se conecta)**
- `LessonViewer.tsx` (`/leccion`) — sigue con datos hardcodeados (`upcomingLessons` array, video w3schools placeholder, `isUserPremium = false`). `StudentDashboard` ya hace el drill-down al player, así que probablemente esta ruta es legacy y se puede borrar.

---

## 4. Sistemas transversales

**✅ Construidos (Fase 1 + Fase 2)**
- **Toaster global** — `src/components/ui/toaster.tsx` (sonner + brand). API: `import { toast } from "@/components/ui/toaster"`.
- **Skeleton primitives** — `src/components/ui/skeleton.tsx` con variantes `rect` / `circle` / `text` + `SkeletonText` (multiline) + `SkeletonCard` (compose). Shimmer dorado.
- **EmptyState** — `src/components/ui/empty-state.tsx` con icono lucide, halo gold, float infinito, action slot.
- **AuthSplash** — `src/components/feature/AuthSplash.tsx` (logo + halo + ring + mensaje).
- **AuthBootstrap provider** — `src/components/providers/AuthBootstrap.tsx`. En boot revalida sesión Supabase y refresca el store (loop fixeado usando `onAuthStateChange`).
- **ErrorBoundary** — `src/components/layout/ErrorBoundary.tsx` (clase + fallback default premium o custom).
- **404 catch-all** — ruta `path="*"` → `NotFound.tsx`.
- **Page transitions** — `routes.tsx` envuelto en `AnimatePresence` con `PageTransition` wrapper (fade + blur entre rutas). ✅
- **Modal/Dialog premium** — `src/components/ui/dialog.tsx` con backdrop blur, zoom-in/zoom-out scale, gold focus ring. ✅
- **Tests** — 11 (Skeleton + EmptyState) + 4 (ErrorBoundary) = 15/15 ✅.

**❌ Pendientes**
1. **Custom Stream player skin** — wrapper sobre `<Stream>` (solo para VOD, ya no para lives).

---

---

## 4.1 Modo claro — estado por fase

> Spec completa: `docs/MODO_CLARO_ESPECIFICACION.md`. Este bloque es el estado real, no el plan.

| Fase | Entrega | Estado |
|---|---|---|
| 1. Fundaciones | Tokens semánticos, `useTheme`, `ThemeSync`, primer paint sin destello | ✅ commit `87ca9fc` |
| 2. Compartidos | Primitivos UI, Header/Footer, Toaster, `AppearanceToggle` | ✅ commit `87ca9fc` |
| 3. Públicas | Actos de landing, auth, páginas estáticas | ✅ commit `87ca9fc` |
| 4. Alumnos y multimedia | Dashboard, comunidad, chat, envoltorios de video/podcast | ✅ commit `4573853` |
| 5. Administración | Páginas admin, CRUD visual, uploads, charts | ✅ commit `4573853` |
| 6. Cierre | Matriz de QA visual + activación del selector | ✅ selector activado 2026-09-21 (ver pendientes abajo) |

El selector de apariencia está publicado: `APPEARANCE_SELECTOR_ENABLED = true` en `src/lib/theme.ts`. El tema por defecto sigue siendo oscuro; claro es opt-in.

**Revisado en navegador (2026-09-19 y 2026-09-21)**, claro y oscuro:
- Anónimo: landing completa, `/planes`, `/login`, 404; header a 320px sin choques entre logo, selector y accesos.
- VIP: dashboard (todas las pestañas, lección, certificados) y `/vip-live`.
- Admin: contenido, lives, métricas, usuarios, ajustes y sponsors.
- Free (2026-09-21): módulos, lección con barra de plan gratuito, playlist, notas bloqueadas, sala de trofeos en 0/3 y Mi Panel. Se corrigió: tarjeta de módulo que en hover pasaba a gris translúcido, pistas `text-foreground-muted/50` ilegibles en claro (⇒ `light:text-fg-40`) y "Mejorar mi Plan" que parecía deshabilitado (⇒ borde dorado).
- Individual (2026-09-21): 4 pestañas sin fondos oscuros sueltos ni scroll horizontal; lección con barra "Plan Individual", playlist, Mi Panel y modo podcast con la barra global. Con el podcast sonando, cambiar oscuro⇄claro conserva el MISMO nodo `<audio>` y la reproducción sigue (21,1 s → 22,6 s → 23,7 s).
- Modo simple (toggle apagado) en claro, 390px: landing sin fondos oscuros; 120 textos medidos contra el marfil, el mínimo es el dorado a 5,15:1; las seis tarjetas de inteligencias en flujo normal, sin sticky. "Reducir movimiento" del SO no se emuló: por código sigue el mismo camino (`reduce = prefersReduced || !animationsEnabled` en todos los consumidores y en `MotionProvider`).
- Dos pestañas: cambiar el tema en una lo aplica en la otra (un solo cambio de `data-theme`, sin recarga ni bucle), en ambos sentidos.
- Editor de la landing (admin, claro): el input de edición es texto oscuro sobre marfil con caret y borde dorados (no fuerza blanco). Se corrigió: el marcador "editado sin guardar" era ámbar pálido, indistinguible del de guardado ⇒ `light:outline-warning` + tinte translúcido `light:bg-warning/[0.07]` (un fondo OPACO tapa el texto con gradiente del título, porque ese texto se pinta con el fondo del padre recortado al texto); el ícono de deshacer pasa a `light:text-warning`. La edición de prueba se deshizo sin guardar.
- Admin: arrastre de lección en curso (elevada, sombra cálida, borde dorado; soltada sin mover ⇒ sin petición), zona de subida con archivo encima y con archivo elegido en `LessonFormSheet` (cancelado sin guardar). La barra de progreso de subida real NO se vio: solo se revisó por código (tiene overrides `light:`).
- Voseo: el detector exigía 3 letras antes de la tilde y se le escapaban los "Usá"; corregido a 2 en `scripts/voseo-scan.mjs`, y aparecieron 4 (aria-label del reordenamiento, error de `LogoUploader`, nota y toast de `AdminLiveManager`) ⇒ "Usa".
- Fuera del tema, en ambos temas: con la barra del podcast abierta, el lápiz de edición y "volver arriba" quedaban tapados (este último detrás: z-60 contra z-100). `GlobalPodcastPlayer` publica su altura en `--podcast-bar-h` (ResizeObserver) y los dos botones usan `bottom: calc(… + var(--podcast-bar-h, 0px))`. Verificado: con barra, lápiz y flecha terminan en 634/638 px y la barra empieza en 659 px; sin barra la variable desaparece y vuelven a 24/20 px.
- Barrido por ancho (2026-09-21, sesión free, claro): 9 rutas públicas (`/`, `/planes`, `/historia`, `/terminos`, `/privacidad`, `/explorar/1`, `/cuenta-verificada`, `/restablecer-contrasena`, 404) en 390/768/1440 y las 4 pestañas del dashboard en 1024/1440, sin scroll horizontal ni fondos oscuros fuera de islas (script de colores calculados + revisión a ojo de `/explorar/1`). Fuera del tema, en ambos temas: el link "Volver al inicio" de `/explorar/:id` quedaba pegado al badge del módulo (dos `inline-flex` hermanos) ⇒ `flex w-fit`.
- Link público `/live/:token` en replay: queda dentro de la isla oscura del escenario.
- Selector: menú sólido en claro; cambiar de tema con scroll a mitad de página conserva posición, foco y la misma ventana (sin recarga).
- Toasts success/error/info/warning con descripción y acción, legibles en ambos temas.
- Arranque: preferencia inexistente, JSON inválido y registro viejo sin tema ⇒ oscuro, conservando animaciones/latencia.
- Oscuro idéntico: snapshot de colores calculados antes/después (`git stash`) en rutas públicas, dashboard, `/vip-live` y 6 rutas admin; solo diferencias equivalentes (oklab vs rgba) y los envoltorios nuevos del logo.

**No verificado** (queda abierto, no se da por aprobado):
- Replay reproduciendo de verdad: en local `/api/stream/recording-url` da 502 (no corre la función de Vercel), así que solo se vio el estado de error.
- Live en curso con la lista de conectados nueva (`LiveViewersDialog`): no había transmisión; el diálogo usa las mismas clases ya revisadas en la sala VIP.
- Móvil horizontal y teclado móvil sobre el chat.

**Reversión:** `APPEARANCE_SELECTOR_ENABLED` de vuelta a `import.meta.env.DEV` solo oculta el selector. Para devolver a todos al oscuro sin borrar preferencias, sumar `data-theme-lock="dark"` al `<html>` de `index.html`.

**Verificación automática (2026-09-21):** `npm run typecheck` limpio; `npx vitest run` → 19 archivos, 142 tests.

## 5. Plan de fases de estilo

**✅ Fase 1 — Foundation (transversal)**
- Toaster + Skeleton + EmptyState + tests.

**✅ Fase 2 — Pantallas globales**
- NotFound 404 + ErrorBoundary + AuthSplash + AuthBootstrap provider + tests.

**✅ Fase 3 — Admin pages desde cero (Completada)**
- `AdminMetrics.tsx`: KPIs cards, gráfico áreas (recharts), top módulos. Mock data.
- `AdminUsers.tsx`: tabla con search + filtros plan/rol + paginación. Mock data.
- `AdminSettings.tsx`: secciones agrupadas (Marca, Pagos, Notificaciones, Integraciones). Forms premium.

**✅ Fase 4 — Polish DECENT pages (Completada salvo "está escribiendo")**
- ✅ `StudentDashboard.tsx`: Rediseño UX mobile-first, sticky nav, drill-down (grid -> player), `AnimatePresence` en tabs, Skeletons implementados, global toaster. Integrada pestaña de Comunidad VIP.
- ✅ `VIPLiveRoom.tsx`: flujo completo (countdown → intro cinemática → reproductor HLS + chat real).
- ✅ `AdminLiveManager.tsx`: CRUD completo, drag-drop imagen, timezone Colombia, guía OBS.
- ✅ `LiveChat.tsx`: entrance de mensajes con AnimatePresence, input premium con focus dorado, Skeleton al cargar. Falta solo "está escribiendo".
- ✅ `Header.tsx`: `<Sheet>` mobile funcional con user card + drill-down completo.
- ✅ `Footer.tsx`: gradient dorado, glow radial, 4 redes, tagline cinemático.
- ⏳ `LessonViewer.tsx` (`/leccion`): decidir borrar o conectar a Supabase (sigue con mocks).

**🔜 Fase 5 — Player + Admin polish**
- Custom skin sobre `<Stream>` (Cloudflare) con controles dorados — para `LessonPlayer` (VOD).
- Pulir `GlobalPodcastPlayer` (thumb slider custom, pulse en barras durante playback, expand/collapse mobile).
- Pulir `AdminContentManager` (skeleton, focus animado, depth en upload zones).

**✅ Fase Cierre — Transitions globales + Modal premium**
- ✅ Wrapper con `AnimatePresence` en `routes.tsx` para fade/slide entre rutas.
- ✅ Wrapper sobre `Dialog` (radix) con backdrop blur + scale-in para reemplazar los defaults en toda la app.

---

## 6. Seguridad

**✅ Implementado (2026-05-19)**
- **Vercel Functions con auth real**: `api/_lib/auth.ts` expone `requireAuth`, `requireAdmin`, `applyCors`. Las 4 functions (`upload-url`, `recording`, `download-status`, `live-input-status`) ahora validan JWT y rol contra Supabase.
- **Validación zod** del body en cada endpoint con caps razonables (size max 5GB, strings max 128 chars).
- **CORS por allowlist** (env `ALLOWED_ORIGINS`), no más wildcard.
- **`authedFetch` helper** (`src/lib/api/client.ts`) que mete el `Authorization: Bearer ${jwt}` desde la sesión de Supabase. Usado por todos los call sites del frontend.
- **Headers de seguridad globales** en `vercel.json`: `X-Frame-Options DENY`, `X-Content-Type-Options nosniff`, `Referrer-Policy`, `Permissions-Policy`, HSTS 2 años.
- **Sin `SUPABASE_SERVICE_ROLE_KEY`**: usamos JWT del user + anon key → respeta RLS, menos superficie de ataque.

**✅ Rate limit con Upstash (helper listo, falta config en cuenta Upstash)**
- `api/_lib/ratelimit.ts` con sliding window por `user.id`, prefix por endpoint, fail-open si las env vars no están seteadas.
- Aplicado en las 4 functions con límites diferenciados:
  - `upload-url`: 3 req/min (admin, sube videos infrecuentemente)
  - `recording`: 10 req/min (admin)
  - `download-status`: 10 req/min (admin)
  - `live-input-status`: 30 req/min (cualquier auth user; polling cada 10s = ~6/min normal)
- Headers `X-RateLimit-Limit / Remaining / Reset` + `Retry-After` cuando bloquea.

**⏳ Pendiente**
- **Audit RLS periódico** en Supabase (query para detectar tablas sin policies).
- **CSP** (Content-Security-Policy) en `vercel.json` — postergado porque requiere cuidado para no romper Cloudflare Stream / Supabase / fonts.

**🔧 Env vars que debe configurar el admin en Vercel**
| Variable | Valor | Entornos |
|---|---|---|
| `ALLOWED_ORIGINS` | `https://escuela-riqueza.vercel.app` | Production + Preview + Development |
| `CLOUDFLARE_ACCOUNT_ID` | (ya existente) | Production |
| `CLOUDFLARE_STREAM_API_TOKEN` | (ya existente) | Production |
| `UPSTASH_REDIS_REST_URL` | desde upstash.com (free tier) | Production + Preview |
| `UPSTASH_REDIS_REST_TOKEN` | desde upstash.com (free tier) | Production + Preview |
