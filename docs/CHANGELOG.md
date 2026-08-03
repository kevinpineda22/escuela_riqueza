# Historial de cambios — Escuela de la Riqueza

> Cambios ordenados cronológicamente del más viejo al más nuevo.
> Para el estado actual del proyecto, ver `docs/PROJECT_STATE.md`.

---

## 2026-08-03

### Lives — la grabación al finalizar ahora se vincula sí o sí
- **Fix raíz del "Sin grabación disponible"** (`api/stream/recording.ts`): el endpoint consultaba `GET /stream?type=live&live_input=<id>`, cuyo filtro `type=live` solo matchea el video mientras transmite, nunca el VOD ya finalizado y `ready`. Por eso la grabación existía en Cloudflare (Ready y reproducible) pero volvía `recording_uid: null`. Ahora usa el endpoint dedicado `GET /stream/live_inputs/<id>/videos` y toma la grabación `ready` más reciente.
- **Webhook endurecido** (`api/stream/cloudflare-webhook.ts`): como todos los eventos comparten el mismo Live Input, el `video.ready` vinculaba la grabación a cualquier sala sin grabación de ese input — incluida una programada futura. Ahora apunta solo a la sala que realmente transmitió (última `ended`/`live` por `starts_at`), nunca a una futura.
- **Red de seguridad en el panel** (`AdminLiveManager.tsx`): botón **"Vincular grabación"** de un clic en la pestaña Finalizados para cualquier evento sin grabación. Recupera la grabación sin tener que Reactivar, Forzar EN VIVO ni pegar el UID a mano.
- **Flujo resultante**: el equipo de cámaras aprieta Finalizar y se olvida; Cloudflare dispara `video.ready` y el webhook vincula solo; si algo fallara, se recupera en un clic.

## 2026-07-27 → 07-28

### Lives — grabaciones sanas, sin fragmentación y archivado automático a R2
- **Fix codificación de grabaciones**: el keyframe interval de OBS en `Auto` hacía fallar la codificación del VOD ("failed to be encoded"). Corregido y documentado en la guía OBS del admin (keyframe = 2, modo Avanzado).
- **Anti-fragmentación**: nuevo `scripts/configure-live-input.mjs` que setea `recording.timeoutSeconds=60` en el Live Input de Cloudflare. Antes, cada micro-corte de OBS creaba un video nuevo → decenas de clips sueltos.
- **Guía OBS reescrita** (`AdminLiveManager.tsx`): estabilidad primero — ethernet, bitrate ≤ 50% del upload (tabla por velocidad), keyframe 2. Se quitó el push a WebRTC (sumaba inestabilidad) y el bitrate 4000-8000 riesgoso.
- **Archivado automático a R2**: el `worker/` ganó un **Cron Trigger** (`scheduled()`, cada 10 min) que barre las grabaciones sin archivar, las copia a R2 y borra de Stream. El botón manual queda como forzado on-demand; ambos comparten `archiveOne()`.
- **Robustez del archivado**: descarta grabaciones muertas — video en estado `error`, o pegado en 0% de generación de MP4 > 12h — para no reintentar infinito ni tapar el batch (`limit=3`).
- **Repo**: los 18 scripts `.sql` se movieron a `sql/` con un `sql/README.md` que cataloga cada uno; se eliminó una imagen suelta; docs de estructura actualizadas.

## 2026-05-21

### Comunidad VIP — fix UX + diseño red social
- **Fix final UX Modal "Crear publicación"**: el modal `NewPostDialog` ya no usa header/footer `sticky`. Ahora usa una estructura flex perfecta: `DialogContent` está limitado a la altura de la pantalla y no hace scroll (`overflow-hidden`); el form interno usa `flex-1 overflow-y-auto` en el cuerpo de los campos, dejando el header y los botones fijos naturalmente en la parte superior e inferior sin flotar sobre el contenido de forma invasiva.
- **`isAdmin` no llegaba a `NewPostDialog`**: `CommunityFeed` no pasaba la prop. Corregido.
- **Pin/unpin desde el feed (admin)**: nueva API `togglePinPost(id, pinned)` en `src/lib/api/community.ts`. Admin puede fijar/desfijar CUALQUIER post (suyo o ajeno) desde:
  - **PostCard**: menú "⋯" → "Fijar publicación" / "Desfijar publicación".
  - **PostDetail**: botón Pin/PinOff junto a Eliminar en el header del post.
- **Separación visual fijados vs recientes** en `CommunityFeed`: headers "📌 Fijado por el equipo" (gold) y "🕐 Recientes" (muted) con línea gradient. Auto-ocultos cuando no aplican.
- **Rediseño `PostCard` estilo red social profesional**:
  - Avatar 48px con ring dinámico (gold si admin, blanco si user normal) + badge `Shield` dorado para admin.
  - Header inline: nombre + badge admin + timestamp en una línea, categoría + pin chips en otra.
  - Menú "⋯" agrupado (top-right) con dropdown que contiene pin (admin) y delete (autor/admin).
  - Body con `whitespace-pre-wrap` para respetar saltos de línea + "Ver más" / "Ver menos" para posts >280 chars.
  - Borde gold + accent line en top para posts fijados.
  - Action bar inferior separada por `border-t` con LikeButton + contador de comentarios.
- **Rediseño `PostDetail`**:
  - Header tipo Twitter: avatar 56px con shield admin badge + ring dinámico, autor/timestamp en una línea, categoría+pin en otra.
  - Borde dorado y línea de acento gradient arriba para posts fijados (consistente con PostCard).
  - Body `whitespace-pre-wrap` respeta saltos de línea.
  - Action bar inferior con border-t separador.
  - `CommentBody`: avatares responsivos (40px raíz, 32px reply), shield admin badge, "Admin" pill, tipografía mejorada.
- **Banner welcome `CommunityFeed`** más profesional: dot pattern de fondo, gold glow asimétrico, blob purple sutil, badge "Espacio exclusivo" con backdrop-blur.
- **Fix Likes y contador de comentarios en tiempo real**:
  - `LikeButton`: reescrito el manejo de estado optimista con `useEffect` separados para `liked` y `count`. Antes, el botón revertía visualmente el like si el prop del padre (que era viejo) causaba un re-render antes de que llegara el evento de Realtime.
  - `CommunityFeed` y `PostDetail`: agregados listeners de Supabase Realtime para el evento `UPDATE` en las tablas `community_posts` y `community_comments`. Como los conteos están desnormalizados vía triggers en la BD (`like_count`, `comment_count`), escuchar los `UPDATE`s hace que todo el UI reaccione en tiempo real globalmente cuando cualquier usuario da like o comenta.

- **Configuración avanzada de publicidad (Plan Free)**:
  - Nueva migración SQL `sync_platform_ads.sql` para agregar `free_ad_type` ('preroll', 'midroll', 'both', 'none') y `free_ads_per_block` a la tabla `platform_settings`.
  - El Panel de Admin (pestaña Operativa) ahora permite elegir:
    - Modo de aparición: Solo al inicio, Solo intervalos, Inicio + Intervalos, Desactivados.
    - Anuncios por pausa (consecutivos, e.g. 1 o 2).
    - Frecuencia en segundos (sólo visible si hay intervalos activados).
  - `LikeButton`: reescrito el manejo de estado optimista con `useEffect` separados para `liked` y `count`. Antes, el botón revertía visualmente el like si el prop del padre (que era viejo) causaba un re-render antes de que llegara el evento de Realtime.
  - `CommunityFeed` y `PostDetail`: agregados listeners de Supabase Realtime para el evento `UPDATE` en las tablas `community_posts` y `community_comments`. Como los conteos están desnormalizados vía triggers en la BD (`like_count`, `comment_count`), escuchar los `UPDATE`s hace que todo el UI reaccione en tiempo real globalmente cuando cualquier usuario da like o comenta.

## 2026-05-11

### API de lives alineada al schema real de Supabase
- `src/lib/api/stream/lives.ts`: `LiveEvent` reescrito para coincidir con la tabla real (`starts_at`, `status`, `stream_live_input_id`, `required_plan`, `allowed_plans`, `background_image_url`).
- `fetchActiveLive()` ahora devuelve la sala con `status="live"` o la próxima `scheduled`.
- `sanitize()` corregido: solo convierte `""` a `null` para campos presentes en el payload (no para undefined). Fix del error 400 al forzar EN VIVO que mataba `starts_at`.

### AdminLiveManager — funcionalidad completa
- **Timezone Colombia**: badge automático con timezone detectado (`Intl`). Helper `isoToLocalDatetime` para que el input `datetime-local` respete la zona horaria local al cargar datos guardados.
- **Drag & drop de imagen**: subida a Supabase Storage bucket `backgrounds`. Fallback URL textual. Validación de tamaño (5MB max).
- **Campos simplificados**: eliminado `duration_minutes` del UI. `required_plan` se auto-deriva del plan más alto en `allowed_plans`. Sin duplicados.
- **Refresco al seleccionar sala**: `selectRoom()` hace fetch fresco a Supabase en vez de usar el estado local.
- **Guía OBS**: pasos para CBR, keyframe 1s, 30fps, Low-Latency HLS y activación WebRTC.

### VIPLiveRoom — WebRTC + polling
- **Reemplazo de `<Stream>` por `<iframe>` directo**: URL modo WebRTC (`?mode=webrtc&preferLowLatency=true`) para latencia <1s. Usa `VITE_CLOUDFLARE_STREAM_CUSTOMER_SUBDOMAIN` del `.env`.
- **Polling 3s**: consulta periódica a Supabase como fallback de Realtime (no requiere F5).
- **Fallback de título**: si `live.title` existe, se muestra solo el título; si no, cae a "El conocimiento es la moneda definitiva".

### SQL migrations
- `docs/migrate-lives-schema.sql`: incluye:
  - `ALTER COLUMN background_image_url` (si no existe)
  - `ALTER TABLE ADD COLUMN is_active boolean NOT NULL DEFAULT false`
  - `ALTER TABLE ADD COLUMN recording_stream_uid text`
  - RLS policies para `lives`, `live_messages`, storage bucket `backgrounds`
  - Habilitación de Realtime (`ALTER PUBLICATION supabase_realtime ADD TABLE lives`)
  - WebRTC manual step reminder

---

## 2026-05-12

### Columna `is_active` + selección manual de sala activa
- **Motivación**: el admin quería elegir QUÉ sala se muestra a los usuarios, no que el sistema auto-seleccionara la más próxima.
- **Columna `is_active`** (`boolean NOT NULL DEFAULT false`) agregada a tabla `lives`.
- **`apiSetActiveLive(id)`** en `src/lib/api/stream/lives.ts`: desactiva todas las demás salas (`is_active = false`) y activa la seleccionada (`is_active = true`), todo en una transacción.
- **`fetchActiveLive()`** reescrito: ahora solo consulta `is_active = true` + `status IN (scheduled, live)`. Sin auto-selección.
- **Botón Activar/Inactivar** en `AdminLiveManager.tsx`: cada sala tiene un ícono de radio en la lista. Al clickear, llama a `apiSetActiveLive()` y actualiza el estado local + editor + toast.

### VIPLiveRoom — real-time contra toda la tabla + acceso dinámico por plan
- **Ruta `/vip-live`** (`routes.tsx`): se quitó `minPlan={PLANS.VIP}`. Ahora es accesible a cualquier usuario autenticado.
- **Validación de plan en VIPLiveRoom**: en el mount, si el `activeLive` existe pero el plan del usuario no está en `allowed_plans`, redirige a `/dashboard` via `useNavigate`.
- **Suscripción Realtime a TODA la tabla** `lives` (antes solo al `live.id` específico). Esto permite detectar:
  - Admin activa otra sala → VIP se cambia instantáneamente a la nueva sala
  - Admin forza EN VIVO → la sala transiciona a live → intro cinemática → stream
  - Admin detiene → vuelve a scheduled → countdown
  - Admin finaliza → `fetchActiveLive()` devuelve null → muestra "No hay eventos"
- **`isLive`** ahora es derivado (`live?.status === "live"`) en vez de estado separado. Detener/Finalizar resetean correctamente la vista sin stale state.
- **Polling 3s** siempre activo (ya no condicional a `!live || live.status === "live"`) para cubrir fallback de Realtime.

### StudentDashboard — entrada anticipada ≤15 min
- **Botón "Ver sala"** cuando el live está programado y falta ≤15 min para `starts_at`. Link a `/vip-live` para que el usuario entre a la sala de espera con countdown.
- Si falta >15 min, muestra "Disponible para tu plan" (sin CTA).
- La sección de lives ahora usa `fetchActiveLive()` en vez de `fetchLivesForPlan()`. Solo muestra la sala que el admin activó, si pertenece al plan del usuario.

---

## 2026-05-13

### Grabación automática de lives (sin acceso a Cloudflare)
- **`/api/stream/recording.ts`** (Vercel Function): consulta Cloudflare Stream API para obtener el video de grabación de un Live Input. También habilita MP4 downloads vía API (`POST /accounts/{id}/stream/{uid}/downloads`).
- **`fetchRecording(liveInputId)`** en `src/lib/api/stream/lives.ts`: llama a la Vercel Function desde el frontend.
- **Botón "Obtener grabación"** en AdminLiveManager editor: busca la grabación en Cloudflare y rellena `recording_stream_uid` automáticamente.
- **Al hacer clic en "Finalizar"**: intenta obtener la grabación automáticamente. Si Cloudflare ya la procesó, se vincula automáticamente.
- **URL de descarga corregida**: `{subdomain}/{uid}/downloads/` (plural, con 's') que lista los MP4 disponibles.
- **Pestaña "Finalizados"**: muestra el iframe embebido de la grabación + botón descarga + botón "Reactivar" (cambia status de vuelta a scheduled).

### VIPLiveRoom — auto-detección de OBS + sala persistente
- **El iframe de Cloudflare WebRTC** se muestra automáticamente cuando `starts_at` ha pasado (sin depender de Forzar EN VIVO). Cloudflare maneja internamente el estado "live" / "waiting for signal" según si OBS está transmitiendo.
- **Detección de OBS vía API**: cuando la sala está en countdown (antes de `starts_at`), `VIPLiveRoom` consulta `/api/stream/live-input-status.ts` cada 10s. Si Cloudflare reporta que el Live Input está `connected` (OBS transmitiendo), salta el contador y muestra el iframe inmediatamente.
- **Nuevo estado "FINALIZADO"**: cuando admin hace clic en "Finalizar", la sala NO se oculta. Muestra "Transmisión finalizada" overlay + el chat sigue activo. Solo al desactivar `is_active` aparece "No hay eventos".
- **Chat siempre visible**: en estados scheduled, live, ended y hasta que la sala se desactive.
- **Badges dinámicos**: "EN VIVO" (rojo), "EN ESPERA" (dorado, OBS conectado o starts_at pasado), "PRÓXIMAMENTE" (antes de starts_at), "FINALIZADO" (gris).

---

## 2026-05-14 (Sesión 1)

### Arquitectura robusta del Modo Podcast (Autoplay + Lock Screen)
- **Desbloqueo de Autoplay en Móviles (Safari/Chrome)**: Modificado `PodcastEngine` para que SIEMPRE renderice el `<Stream>` (usando un video de Cloudflare silenciado como placeholder). Esto garantiza que el iframe exista en el DOM antes del gesto del usuario, permitiendo que `internalRef.current.play()` ocurra de forma síncrona sin ser bloqueado por los navegadores móviles.
- **Secuestro de MediaSession (El fix "Stream" en Lock Screen)**: Cloudflare Stream sobreescribe la metadata del sistema operativo por defecto. Se implementó una técnica de "secuestro" ("hijacking") utilizando un elemento `<audio id="media-session-hijacker">` invisible (con una pista silenciosa `data:audio/wav`). Cuando el iframe emite el evento `onPlay`, se espera 100ms e inmediatamente se reproduce el audio silencioso para "robarle" el foco del reproductor al sistema operativo e inyectar la metadata real (`track.title`, "Escuela de la Riqueza" y el logo de la marca desde el CDN).
- **Loop de Re-afirmación**: Añadido un intervalo cada 5 segundos que re-produce el secuestrador silencioso y actualiza la metadata, previniendo que iOS/Android le devuelvan el control al iframe al navegar o tras mucho tiempo.
- **Mutex Video vs Podcast**: Modificado `LessonPlayer` para prevenir audios superpuestos. Si un usuario tiene el podcast en segundo plano e intenta darle "Play" a cualquier lección visual normal, el sistema automáticamente hace `closePlayer()` sobre el estado global del podcast antes de arrancar el video.

---

## 2026-05-14 (Sesión 2 — Footer, Páginas, Progreso)

### Footer actualizado + páginas estáticas
- **Redes Sociales**: URLs de Instagram y YouTube corregidas a las oficiales (`instagram.com/escueladelariqueza`, `youtube.com/@EscuelaDeLaRiqueza`). Eliminado "Las 6 inteligencias" del footer.
- **Hash scrolling funcional**: Creado `useScrollToHash` hook en `src/hooks/useScrollToHash.ts`. Se invoca en `routes.tsx` y escucha cambios de `pathname` + `hash`. Cuando el hash cambia, hace `window.scrollTo` con offset -100px para respetar headers fijos. Timeout de 500ms para esperar transiciones de AnimatePresence.
- **Links del footer reparados**: "Planes y precios" → `/planes#planes`, "Preguntas frecuentes" → `/planes#faq`. Se agregaron `id="planes"` y `id="faq"` en `Plans.tsx`.
- **Nuevas páginas públicas**: `HistoryPage.tsx` (`/historia`) con video Cloudflare Stream embebido + copia profesional. `TermsPage.tsx` (`/terminos`) y `PrivacyPage.tsx` (`/privacidad`) con texto legal completo.
- **Email de contacto**: Actualizado de `soporte@escuelariqueza.com` a `escueladelariquezaweb@gmail.com` en Footer, TermsPage y PrivacyPage.

### Sistema de progreso de lecciones (user_lesson_progress)
- **Tabla SQL en Supabase**: `user_lesson_progress` con columnas `user_id` (FK auth.users), `lesson_id` (FK lessons UUID), `progress_seconds`, `is_completed`, timestamps. RLS habilitado con políticas estrictas de select/insert/update solo para el propio usuario.
- **`src/lib/api/stream/progress.ts`**: API completa (`fetchUserProgress`, `saveUserProgress`, `fetchAllUserProgress`) usando `upsert` con `onConflict: 'user_id,lesson_id'`.
- **Auto-guardado en LessonPlayer**: cada 10s durante `onTimeUpdate` se llama `saveUserProgress()` con el `currentTime` actual. Throttle mínimo de 5s entre llamadas para no saturar Supabase.
- **Regla del 90%**: si `currentTime / duration >= 0.9`, se marca `is_completed: true` automáticamente.
- **Modal de retomo (Resume Modal)**: Al cargar una lección, se llama `fetchUserProgress()`. Si `progress_seconds > 5` y `!is_completed`, se muestra un Dialog (shadcn) premium con "Continuar viendo" (usa `pendingSeekRef` para hacer seek) o "Iniciar de nuevo".
- **Progreso en StudentDashboard**: Barra dorada de progreso por módulo usando `completed-lessons / total-lessons * 100`. Checks verdes en la playlist de lecciones. Pestaña Certificados ahora muestra tarjetas por módulo: dorado + check si 100%, gris + bloqueado + barra de progreso si menos.

### Fix PodcastEngine — stale closures en handlers del Stream
- **Problema**: Al activar modo podcast, el iframe de Cloudflare se recargaba y su primer `onTimeUpdate` (con `currentTime: 0`) sobreescribía `lastKnownTime` en el store ANTES de que `onCanPlay` buscara restaurar la posición.
- **Solución**: Se agregaron `lastKnownTimeRef`, `trackRef`, `lastVideoIdRef` sincronizados con `useEffect`. `handleTimeUpdate` ahora ignora eventos si `!initializedRef.current` (guard para evitar que el `onTimeUpdate` del iframe recién cargado pise el seek). `handleCanPlay`, `handlePlayEvent`, `handleTimeUpdate` leen desde las refs en vez del closure stale.
- **Cambio en player.store**: `PodcastTrack.id` cambiado de `number` a `string | number` para soportar UUIDs reales de Supabase.

---

## 2026-05-14 (Sesión 3 — Upload, reordenar, podcast, insignias)

### Fix: Loop de video pisaba `is_completed` (LessonPlayer)
- **Problema**: Cloudflare Stream reinicia el video al llegar al final, `handleTimeUpdate` con currentTime≈0 pisaba `is_completed=false`
- **Solución**: `endedRef` (useRef) que guarda `endedRef.current || ...` en el cálculo de `isCompleted`. `handleEnded` setea `playRequested=false` (corta el loop) y guarda completed. Overlay con check verde + "Reproducir de nuevo" cuando terminó.

### Dashboard se actualiza sin F5 (polling fallback)
- **Problema**: `user_lesson_progress` no estaba en la publicación Realtime de Supabase, el dashboard solo mostraba progreso tras F5
- **Solución**: `setInterval` cada 15s que re-fetchea `fetchAllUserProgress()` y actualiza `userProgress`. La suscripción Realtime se conserva.

### Progreso en modo podcast (PodcastEngine)
- **Problema**: `handleTimeUpdate` solo actualizaba el store de zustand, nunca persistía en Supabase
- **Solución**: Importado `saveUserProgress`. `handleTimeUpdate` guarda cada 10s con throttle 5s. `handleEnded` guarda con `isCompleted=true`. Mismas refs sincronizadas que en video.

### Insignias con imágenes personalizadas
- Agregado `badge_image_url?: string | null` a interfaz `Module` en `content.ts`
- Certificates tab: si el módulo tiene `badge_image_url`, muestra `<img>` con grayscale si bloqueado, glow si desbloqueado; fallback a icono anterior
- SQL migration: `docs/migrate-badge-image.sql`

### Barra de progreso en subida de videos (AdminContentManager)
- Nueva función `uploadFileWithProgress()` con `XMLHttpRequest` + `xhr.upload.onprogress`
- Reemplazado `fetch` por XHR para tracking de progreso en tiempo real
- Barra animated gradient gold en formularios de crear y editar lección
- `uploadVideo` envuelto en try/finally para limpiar estado incluso en error

### Reordenar módulos (AdminContentManager)
- `updateModuleOrder(orderedIds)` con `PATCH` individuales en paralelo (`supabase.from("modules").update({ order_index }).eq("id", id)`) — evita error `null value in column "title"` que ocurría con `upsert`
- Flechas ↑↓ en cabecera de cada módulo (solo desktop). `handleMoveModule` intercambia localmente y persiste.

### Rediseño UX del AdminContentManager
- Stats bar: módulos totales, lecciones, con video
- Create module: card full-width con fade en vez de popup top-right
- Cards con sombra, línea gold superior, icono BookOpen, contador de lecciones
- Lecciones con barra lateral gold, icono en caja, badges de plan coloreados
- Labels visibles en todos los campos del form
- Todos los `alert()` reemplazados por toasts del sistema
- Botones con spinner durante upload, drag zone con estados hover/focus/disabled
- Skeleton loading en vez de texto plano
- Selectores de plan como chips visuales con color por plan

### Archivos modificados
| Archivo | Cambio |
|---|---|
| `src/components/feature/LessonPlayer.tsx` | endedRef, overlay completado, guard en isCompleted |
| `src/components/feature/PodcastEngine.tsx` | saveUserProgress en handleTimeUpdate y handleEnded |
| `src/pages/student/StudentDashboard.tsx` | Polling 15s, badge_image_url en certificados |
| `src/pages/admin/AdminContentManager.tsx` | Rediseño completo, upload progress, reordenar módulos |
| `src/lib/api/stream/content.ts` | updateModuleOrder, uploadFileWithProgress, badge_image_url en Module |
| `docs/migrate-badge-image.sql` | (nuevo) SQL para columna badge_image_url |

---

## 2026-05-15

### Fix: Upload de videos a Cloudflare Stream (CORS + TUS Protocol)

**Problema**: El upload usaba `XMLHttpRequest` + `FormData` contra `upload.cloudflarestream.com/{uid}`. Cloudflare Stream no habilita CORS para POST multipart/form-data desde navegadores. El preflight fallaba silenciosamente, el archivo nunca se subía, y Cloudflare mostraba "Video has no name" / "Pending Upload" para siempre. Además, fallaba por Content Too Large (413) y bloqueaba los videos requiriendo URLs firmadas.

**Solución**: Reemplazado el mecanismo de upload por **TUS protocol** usando `tus-js-client` (librería oficial que Cloudflare recomienda para uploads desde browser).

**Cambios técnicos:**
- `src/lib/api/stream/content.ts` — `uploadFileWithProgress()` reescrito con `tus.Upload`. Envía `filename` y `filetype` como metadata TUS. Configurado `chunkSize` a 50MB para evitar error 413. Eliminado `requireSignedURLs` para evitar 401 Unauthorized post-subida.
- `api/stream/upload-url.ts` — Agregado manejo de OPTIONS preflight con CORS headers (`Access-Control-Allow-Origin: *`). Soporte para `req.body.name` para nombrar el video y tamaño correcto usando `direct_user=true`.

### Nueva Feature: Vista Pública de Módulos (Module Preview)
- **`src/pages/public/ModulePreview.tsx`**: Nueva página pública `/explorar/:intelligenceId` para que usuarios sin registrar puedan visualizar la tabla de contenido, descripción y lecciones del módulo de una inteligencia específica.
- **`src/components/feature/IntelligencesAct.tsx`**: Las "8 Inteligencias" de la landing ahora enlazan a los módulos reales de la DB a través de `/explorar/:intelligenceId`.

### Mejoras UI: Certificados y Dashboard
- **`src/pages/student/StudentDashboard.tsx`**: Se rediseñó la sección de certificados conectada con las insignias de los módulos reales y su texto correspondiente.

### Cleanup: Eliminación de código muerto

Se eliminaron 10 archivos que eran mocks/data quemados sin uso real:

| Archivo | Motivo |
|---|---|
| `src/mocks/courses.ts` | Datos mock, no importado por ningún componente real |
| `src/mocks/lives.ts` | Idem |
| `src/mocks/users.ts` | Idem |
| `src/mocks/` (directorio) | Quedó vacío |
| `src/lib/api/courses.ts` | API mock envuelve mocks, no importada |
| `src/lib/api/lives.ts` | Idem |
| `src/lib/api/billing.ts` | Idem |
| `src/pages/admin/AdminVideoUpload.tsx` | No enrutado en routes.tsx, reemplazado por AdminContentManager |
| `src/types/course.ts` | Solo usado por mocks/APIs eliminados |
| `src/types/live.ts` | Idem |
| `src/types/subscription.ts` | Idem |

**Archivos limpiados:**
- `src/lib/api/client.ts` — eliminada función `delay()` (solo usada por APIs mock eliminadas). Conservado `ApiError` (usado por `auth.ts`, `AuthPage.tsx`, `ResetPassword.tsx`).

**Verificación:** `npm run typecheck` ✅, `npm run test` (15/15) ✅, `npm run lint` (sin errores nuevos) ✅.

### Estado actual del proyecto

- **Upload de videos**: Funcional con TUS protocol. Pendiente verificar en producción tras deploy.
- **Mocks**: 0 archivos mock. Todo el contenido se sirve desde Supabase (real).
- **Tipos de datos**: Solo queda `src/types/user.ts`. Los tipos `Module`, `Lesson` están en `src/lib/api/stream/content.ts` donde se usan.
- **Páginas admin**: Gestor de Contenido (`/admin/content`), Lives (`/admin/lives`), Métricas (`/admin/metrics`), Usuarios (`/admin/users`), Settings (`/admin/settings`).

---

## 2026-05-15 (Sesión 2)

### Mejoras UI: Student Dashboard
- **Mockup de Portal de Pagos**: Se reemplazó el botón de pagos inactivo por un modal completo (Dialog de shadcn) que simula el Customer Portal de Stripe.
- Muestra la fecha real del `current_period_end` (o simulada si está vacío), junto a una tarjeta predeterminada y opciones para gestionar la suscripción.
- **Fix de Ortografía**: Restaurados los acentos y 'ñ' en el archivo `StudentDashboard.tsx` que se habían perdido tras una conversión de codificación (suscripción, próximo, añadir, etc).

### Rediseño: Página de Historia
- **Nueva Estructura**: Se reconstruyó `/historia` dividiendo el contenido en dos columnas. Izquierda con la historia del fundador, derecha con un contenedor *sticky* para el diferenciador. Textos provistos por el usuario integrados.
- **Fix de Cloudflare Stream (Layout Shift)**: Se eliminó el `responsive={true}` del componente `<Stream>` y se le aplicó `absolute inset-0 w-full h-full` dentro de un contenedor `aspect-video`. Esto evita que el SDK inyecte scripts de recálculo que bugueaban o interrumpían el scroll del usuario.

### Fix: Descarga de Grabaciones (Lives)
- **Corrección de URL Cloudflare**: El botón de descarga ahora apunta a `.../downloads/default.mp4` en lugar de la carpeta raíz, previniendo el error `404 Not Found`.
- **Nuevo Endpoint (`/api/stream/download-status`)**: Creada una nueva Vercel Serverless Function para consultar el estado de renderizado del MP4 en tiempo real antes de descargarlo.
- **Feedback Interactivo**: Al hacer clic en descargar, un `toast` avisa si Cloudflare está empaquetando el video (`inprogress` con porcentaje), si aún se está preparando (info), o abre la descarga directa si ya está `ready`.
- **Fallback Local**: Si el servidor Vercel local (`/api`) está apagado en dev, atrapa el error `502 Bad Gateway` y abre la URL de emergencia para no bloquear el flujo de desarrollo.

### Contenido: FAQ
- Añadida nueva pregunta a la sección FAQ de `Plans.tsx` sobre la diferencia de Escuela de la Riqueza con otros programas de formación.

---

## 2026-05-16

### Rework del player de live

**Problema acumulado**: el approach del iframe raw con `mode=webrtc&preferLowLatency=true` + carga manual del SDK de Cloudflare via `<script>` y `window.Stream(iframe)` rompía la reconciliación de React. Síntomas en móviles:
- Pantalla negra en Android (incluso con `muted=true&playsinline=true`)
- Errores `NotFoundError: Failed to execute 'removeChild' on 'Node'` durante unmount
- `Maximum update depth exceeded` (loop del ErrorBoundary cayendo por la cascada de removeChild)
- En la práctica la latencia era ~10s aunque pidiéramos WebRTC (la ingesta RTMP de OBS hace que el playback caiga a HLS interno de Cloudflare)

**Causa raíz**: el SDK manual mutaba el DOM del iframe fuera del ciclo de React. Cuando React intentaba desmontar el player (cambio de estado, AnimatePresence exit, etc.), encontraba el árbol corrupto y tiraba `removeChild`. Eso a su vez disparaba el ErrorBoundary, que intentaba renderizar el fallback mientras seguía habiendo nodos rotos, generando el loop `Maximum update depth`.

**Fix** (`src/pages/student/VIPLiveRoom.tsx`):
1. **Reemplazado iframe raw + SDK manual por `<Stream>` de `@cloudflare/stream-react`** (la misma lib que usa `LessonPlayer` y `HistoryPage`). La lib gestiona el iframe, el SDK y el cleanup de listeners internamente; nunca toca DOM por fuera de React.
2. **Modo WebRTC eliminado**. Se usa HLS estándar (compatible con TODO dispositivo). Latencia 5-10s; no perdemos nada porque ya estábamos en ese rango por la ingesta RTMP.
3. **`controls` activos** en el `<Stream>`: el usuario ve el reproductor nativo de Cloudflare con su botón de mute como respaldo.
4. **Control de mute via `streamRef`**: nuestro botón overlay "Activar sonido" llama `streamRef.current.muted = false; player.volume = 1; player.play()` usando la API oficial de la lib. Sin remount, sin SDK manual.
5. **Fade-in cinemático en capa separada**: motion.div con `bg-black opacity 1 → 0` encima del `<Stream>`. Cubre la transición visual sin afectar el iframe, que arranca a opacity 1 (clave para que Android no pierda la pista de video durante el compositing).
6. **`CF_CUSTOMER_CODE`** se extrae del subdominio (`customer-XXX.cloudflarestream.com` → `XXX`) y se pasa como prop al `<Stream>` para mantener el subdomain del proyecto.

**Trade-offs aceptados**:
- Perdimos el ideal teórico de WebRTC (<1s). En la práctica nunca lo teníamos.
- Ganamos: compatibilidad universal (iOS, Android Chrome, Samsung Browser, in-app browsers), cleanup robusto sin errores de React, botón nativo de mute como fallback, código sustancialmente más simple.
- Para volver a <1s en el futuro: requiere migrar OBS a WHIP (ingesta WebRTC nativa) — sección Pendientes.

### Pendientes de optimización del live (NO atacados aún)

#### Latencia real es ~10s aunque el modo es WebRTC

**Síntoma**: la URL del iframe pide `mode=webrtc&preferLowLatency=true`, que en papel da <1s. Pero medido con cronómetro frente a cámara, el delay real es ~10s. Eso significa que WebRTC **playback** está cayendo silenciosamente a HLS.

**Causa probable**: la **ingesta** está en RTMP. OBS por defecto manda RTMP. Cloudflare puede servir WebRTC playback sobre RTMP ingest, pero el transcoding agrega latencia y muchas veces cae a LL-HLS. Para latencia <1s real, **ingesta y playback deben ser ambos WebRTC**.

**Cómo verificar la latencia real**:
1. Visual: cronómetro frente a la cámara de OBS vs reloj del cel viendo el stream.
2. `chrome://inspect` desde PC con Android conectado → abrir `chrome://webrtc-internals` dentro del iframe. Si NO hay `RTCPeerConnection` activa, el playback NO es WebRTC — cayó a HLS.
3. Cloudflare Dashboard → Stream → Live Inputs → tu input → tab "Connection". Muestra si la ingesta entrante es RTMP o WebRTC (WHIP).

**Cómo bajarla cuando se ataque**:
- Migrar OBS de RTMP a WHIP. Requiere OBS 30+ (Studio).
  - Servicio: WHIP.
  - URL: `https://customer-<TU_SUBDOMAIN>.cloudflarestream.com/<LIVE_INPUT_ID>/webRTC/publish`.
  - Codec: H.264 **baseline** (NO main ni high — algunos decoders Android no soportan).
  - Bitrate: 2500-5000 kbps CBR.
  - Keyframe: 1s.
- Alternativa intermedia (si Iván no puede migrar OBS): mantener RTMP pero forzar keyframe=1s + activar Low-Latency HLS en el Live Input. Latencia esperada: 2-5s en lugar de 10.
- Después de migrar, validar con `chrome://webrtc-internals` que efectivamente hay PeerConnection activa.

#### ¿Por qué el live "siempre" está en low latency?

No es un bug, es la URL hardcodeada. Cloudflare Stream tiene tres modos de playback:

| Modo | Latencia | URL param |
|---|---|---|
| HLS estándar | 10-30s | sin `mode` ni `preferLowLatency` |
| LL-HLS | 2-5s | `?preferLowLatency=true` |
| WebRTC | <1s (si la ingesta también es WebRTC) | `?mode=webrtc` |

`VIPLiveRoom.tsx` siempre pide WebRTC + LLHLS. Si en algún momento se quisiera priorizar **estabilidad sobre latencia** (por ejemplo, para redes corporativas/móviles malas que bloquean UDP), habría que sacar ambos params y caer a HLS clásico. **No es necesario hoy**: WebRTC con fallback automático de Cloudflare ya cubre el caso de UDP bloqueado degradando a LL-HLS.

---

## 2026-05-19 (Sesión 2)

### Feature: Comunidad VIP (Foro tipo Reddit)
- **Base de datos (SQL)**: Creado `sync_community.sql` con las tablas `community_posts`, `community_comments` y `community_likes`. Incluye:
  - Estructura de anidamiento de 1 nivel para comentarios (`parent_id`).
  - Triggers para mantener actualizados `like_count` y `comment_count` en tiempo real para optimizar lecturas.
  - Políticas RLS estrictas (Solo VIP y Admin pueden crear/ver, los autores pueden borrar sus propios posts/comentarios, admins pueden borrar cualquiera).
  - Habilitación de publicación en Supabase Realtime.
- **Capa API (`src/lib/api/community.ts`)**: CRUD completo. `fetchPosts`, `fetchPost`, `createPost`, `deletePost`, `fetchComments`, `createComment`, `deleteComment`, `toggleLike`. Optimización de estado `liked_by_me` inyectado en cada consulta usando `community_likes`.
- **UI & Componentes (`src/components/feature/community/`)**:
  - `CommunityFeed`: Orquestador principal, listas, filtros de categoría (Pregunta, Discusión, Recurso, Otro), ordenamiento (Recientes / Más populares). Subscripción a Realtime para posts nuevos.
  - `PostCard` & `PostDetail`: Tarjetas resumen y vista completa del post. El detalle tiene un árbol de comentarios recursivo aplanado a un nivel, con subscripción a Realtime para comentarios nuevos/borrados.
  - `LikeButton`: Toggle optimista con fallback en caso de error.
  - `NewPostDialog`: Modal robusto validado para crear preguntas/discusiones.
- **Integración**: Se reemplazó el placeholder de la pestaña "Comunidad VIP" en `StudentDashboard.tsx`. Usuarios gratis/individuales ven un estado vacío (candado) con botón de *upsell* para "Mejorar a VIP".

### Ajustes en el Admin: Filtros por Periodo en Métricas
- **SQL (`sync_admin_metrics_v2.sql`)**: Modificadas y creadas nuevas RPCs (`admin_count_new_users`, `admin_revenue_in_period`, `admin_get_top_lessons`) que ahora aceptan un parámetro `since timestamptz`. El top lessons ahora cuenta visualizaciones sólo dentro del período, manteniendo el `LEFT JOIN` para incluir lecciones con cero vistas.
- **Frontend (`AdminMetrics.tsx` & `metrics.ts`)**: Agregado selector de periodo ("Todos los tiempos", "Últimos 7 días", "Último mes", "Último año"). Los KPIs cambian dinámicamente sus etiquetas ("Usuarios Totales" vs "Nuevos usuarios", "MRR Estimado" vs "Ingresos del período").

### Fix: Scroll en Modo Desktop (Bug del iframe)
- **Problema**: El `iframe` de Cloudflare en HistoryPage interceptaba todos los eventos de mouse en desktop, bloqueando el plugin de smooth scroll (Lenis) a menos que movieras el puntero fuera del video.
- **Solución**: Se inyectó CSS global (`html.lenis-scrolling iframe { pointer-events: none !important; }`) para deshabilitar temporalmente los iframes durante un scroll activo en todo el sitio. Además, en `HistoryPage`, se puso un overlay transparente que absorbe scrolls pasivos.

### Actualización de Copys (Contenidos)
- **Historia (`HistoryPage.tsx`)**: Reescritura completa del texto por los contenidos actualizados del cliente ("La riqueza es una consecuencia...", "Rediseño cerebral", etc).
- **Insignias de Certificados (`StudentDashboard.tsx`)**: Se renombró el módulo de "Inteligencia del aprendizaje" a "Inteligencia mental" en los textos locales (con fallback alias para retrocompatibilidad).
- **Footer**: Añadidos íconos/SVG (`FbIcon`, `WaIcon`) y enlaces directos a Facebook y WhatsApp de la academia.

---

## 2026-05-19

### Endurecimiento de seguridad: las 4 Vercel Functions ahora exigen JWT + admin role

**Problema**: Las 4 functions (`api/stream/*`) no tenían autenticación. Cualquier persona en internet podía llamar `POST /api/stream/upload-url` y recibir una URL firmada para subir archivos a Cloudflare Stream contra la cuenta del cliente. Sin validación de body (`size`, `live_input_id`, `video_uid` se aceptaban tal cual). CORS de `upload-url` en wildcard (`*`). Esto era el riesgo más alto del proyecto.

**Solución** (`api/_lib/auth.ts` nuevo + las 4 functions modificadas):

- **`requireAuth(req, res)`** valida `Authorization: Bearer <jwt>` contra Supabase y devuelve `{ id, email, role, plan }` o `null` (ya respondió 401).
- **`requireAdmin(req, res)`** = `requireAuth` + checkea `role === 'admin'`, sino 403.
- **`applyCors(req, res)`** setea allowlist desde env `ALLOWED_ORIGINS` (separada por comas). En dev refleja el origin del request. Maneja preflight OPTIONS internamente y devuelve `true` si ya respondió.
- **Sin `SUPABASE_SERVICE_ROLE_KEY`**: el helper usa anon key + JWT del header, respeta RLS, no expone service role. Una env var menos para configurar y menos superficie de ataque.

**Matriz aplicada**:

| Endpoint | Auth | Validación zod |
|---|---|---|
| `upload-url.ts` | `requireAdmin` | `size` (int positivo, max 5GB) + `name` opcional (max 200) |
| `recording.ts` | `requireAdmin` | `live_input_id` (8-128 chars) |
| `download-status.ts` | `requireAdmin` | `video_uid` (8-128 chars) |
| `live-input-status.ts` | `requireAuth` (any logged-in user) | `live_input_id` (8-128 chars) |

`live-input-status` NO requiere admin porque lo usa el polling del VIP en `/vip-live` para detectar OBS.

### Frontend: `authedFetch` helper en `src/lib/api/client.ts`

Nuevo helper que prepend `Authorization: Bearer ${session.access_token}` desde `supabase.auth.getSession()`. Si no hay sesión, tira `ApiError("UNAUTHENTICATED", 401)` antes de salir a la red.

**Call sites migrados** (4 puntos):
- `src/lib/api/stream/content.ts` → `getDirectUploadUrl`
- `src/lib/api/stream/lives.ts` → `checkLiveInputStatus`, `fetchRecording`
- `src/pages/admin/AdminLiveManager.tsx` → `handleDownloadRecording`

### `vercel.json`: headers de seguridad + fix del rewrite

Headers nuevos aplicados a todas las rutas:
- `X-Frame-Options: DENY` (anti-clickjacking)
- `X-Content-Type-Options: nosniff` (anti MIME sniffing)
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy: camera=(), microphone=(), geolocation=(), interest-cohort=()`
- `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload`

**Fix del rewrite**: el catch-all anterior `/(.*)` podía interferir con `/api/*`. Cambiado a `/((?!api/).*)` para que las API routes se manejen primero (Vercel ya lo hace implícito, pero ahora es explícito).

### Env vars nuevas que el admin debe configurar en Vercel

| Variable | Valor sugerido | Entornos |
|---|---|---|
| `ALLOWED_ORIGINS` | `https://escuela-riqueza.vercel.app` | Production + Preview + Development |

Opcionalmente: `SUPABASE_URL` y `SUPABASE_ANON_KEY` server-side (sino el helper cae a `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` que ya existen).

### Pendiente — rate limit (NO atacado)

Falta integrar rate limit (e.g. Upstash Ratelimit, tier gratis 10k cmds/día) para protegerse de bots que disparen los endpoints en bucle. Recomendado para `upload-url` (3 req/min por user), `live-input-status` (30/min, lo llaman cada 10s desde polling) y `recording/download-status` (10/min).

### Verificación
- `npm run typecheck` ✅ limpio.
- Tests existentes no afectados.
- **Pendiente verificar en producción** tras agregar `ALLOWED_ORIGINS` en Vercel y redeployar.

### Archivos creados/modificados

| Archivo | Cambio |
|---|---|
| `api/_lib/auth.ts` | (nuevo) `requireAuth`, `requireAdmin`, `applyCors` |
| `api/stream/upload-url.ts` | `requireAdmin` + zod + CORS |
| `api/stream/recording.ts` | `requireAdmin` + zod + CORS |
| `api/stream/download-status.ts` | `requireAdmin` + zod + CORS |
| `api/stream/live-input-status.ts` | `requireAuth` + zod + CORS |
| `src/lib/api/client.ts` | (nuevo) `authedFetch` helper |
| `src/lib/api/stream/content.ts` | `getDirectUploadUrl` usa `authedFetch` |
| `src/lib/api/stream/lives.ts` | `checkLiveInputStatus`, `fetchRecording` usan `authedFetch` |
| `src/pages/admin/AdminLiveManager.tsx` | `handleDownloadRecording` usa `authedFetch` |
| `vercel.json` | headers de seguridad + fix rewrite |

### Auditoría del estado del proyecto (correcciones a `PROJECT_STATE.md`)

Durante esta sesión se auditó el código vs `docs/PROJECT_STATE.md` y se detectaron varios componentes marcados como "🟡 DECENT" o "🔴 BASIC" que **ya están en estado PREMIUM** en el código. Las correcciones se aplicaron al `PROJECT_STATE.md`. Hallazgos:

| Componente | Decía en PROJECT_STATE | Realidad en código |
|---|---|---|
| `Header.tsx` | "🟡 falta menú mobile funcional" | 🟢 `<Sheet>` mobile completo con user card, navegación drill-down al panel, toggle de animaciones, logout |
| `Footer.tsx` | "🟡 falta gradient/separador animado" | 🟢 gradient dorado, glow radial, redes sociales (IG/YT/FB/WA), tagline cinemático |
| `LiveChat.tsx` | "🟡 sin entrance/skeleton" | 🟢 `AnimatePresence` en mensajes, Skeleton al cargar, input premium con focus dorado |
| `AdminContentManager.tsx` | "🟡 sin skeleton/focus" | 🟢 rediseñado en sesión 3 del 14-05 (stats bar, drag-zone con estados, upload progress, reordenar) |
| `LessonViewer.tsx` (`/leccion`) | "🔴 sin animación" | 🔴 **sigue legacy con mocks hardcodeados** (`upcomingLessons` array, video w3schools placeholder, `isUserPremium = false`). Probable: borrar la ruta — `StudentDashboard` ya hace el drill-down |

### Pendientes reales de diseño (post-auditoría)

1. **Decidir destino de `LessonViewer.tsx`** — borrar ruta `/leccion` (recomendado) o conectarlo a Supabase de verdad.
2. **`GlobalPodcastPlayer.tsx`** — thumb del slider custom, pulse en barras durante playback, expand/collapse mobile (pendiente desde Fase 5).
3. **Custom skin sobre `<Stream>` de Cloudflare** para `LessonPlayer` VOD (Fase 5 original).
4. **`LiveChat.tsx`** — indicador "está escribiendo" (única feature faltante, lo demás está done).

### Cleanup: borrado de `LessonViewer.tsx` legacy

- Eliminada ruta `/leccion` de `routes.tsx`.
- Eliminado import de `LessonViewer` en `routes.tsx`.
- Eliminado archivo `src/pages/student/LessonViewer.tsx` (tenía datos mock hardcodeados, video w3schools, `isUserPremium = false`).
- `StudentDashboard.tsx` ya maneja el drill-down a la lección, así que era código muerto.
- Verificado: `npm run typecheck` limpio.

### Rate limit con Upstash (helper listo, falta config en cuenta Upstash)

**Qué se agregó:**
- `api/_lib/ratelimit.ts` — helper `applyRateLimit(req, res, identifier, config)` con sliding window. Singleton de cliente Redis. Cache local de limiters por config. Headers `X-RateLimit-*` + `Retry-After`. **Fail-open** si `UPSTASH_REDIS_REST_URL`/`TOKEN` no están seteados (no bloquea en dev local).
- Dependencias: `@upstash/ratelimit` + `@upstash/redis`.

**Límites aplicados** (key = `user.id`, prefijo por endpoint):

| Endpoint | Límite | Razón |
|---|---|---|
| `upload-url` | 3/min | Admin sube videos infrecuentemente |
| `recording` | 10/min | Admin |
| `download-status` | 10/min | Admin |
| `live-input-status` | 30/min | Polling cada 10s = 6/min, +margen para reconexiones |

**Env vars pendientes que el admin debe configurar en Vercel:**
- `UPSTASH_REDIS_REST_URL`
- `UPSTASH_REDIS_REST_TOKEN`

(Ambas se generan al crear un Redis database en upstash.com → tier gratis 10k cmds/día).

**Verificación:** `npm run typecheck` ✅ limpio.

---

## 2026-05-20

### Webhook de Cloudflare Stream para sync OBS ↔ panel admin

**Qué**: nuevo endpoint `api/stream/cloudflare-webhook.ts` que recibe eventos de Cloudflare Stream (a nivel cuenta) y actualiza la tabla `lives` sin polling.

**Por qué**: el polling `/api/stream/live-input-status` se apaga en DEV por diseño y se desactiva permanentemente tras un 500. Webhooks son la forma profesional, sin polling, sin DEV-blindness.

**Eventos manejados**:
- `live_input.connected` → sala en `scheduled` + `is_active=true` con ese `stream_live_input_id` pasa a `status='live'` automático.
- `live_input.disconnected` → marca `is_paused=true` (NO finaliza para no perder sesión por microcortes de OBS).
- `video.ready` con `liveInput` → vincula `recording_stream_uid` si está vacío (auto-vincular grabación al finalizar).

**Seguridad**:
- Firma HMAC-SHA256 con `CLOUDFLARE_WEBHOOK_SECRET`. Header `Webhook-Signature: time=<ts>,sig1=<hex>`.
- Anti-replay: rechaza eventos con `time` fuera de ±300s.
- `timingSafeEqual` para evitar timing attacks.
- `export const config = { api: { bodyParser: false } }` — Vercel parsea el body por default y eso rompe HMAC porque `JSON.stringify(req.body)` no es idéntico al payload original. Hay que leer el raw body antes de cualquier parse.
- Usa `SUPABASE_SERVICE_ROLE_KEY` para bypass RLS (webhook no tiene contexto de usuario).

**Setup manual requerido en Cloudflare Dashboard**: configurar Stream → Webhooks con URL del endpoint y guardar el `secret` devuelto en Vercel envs.

**El polling existente se mantiene** como fallback. Webhook + polling = defense-in-depth.

### Rework del aviso del tab "Salas" en `AdminLiveManager`

Pasó de tarjeta horizontal apretada en `text-xs` a info-card vertical con ícono en pill dorado, título `text-sm` semibold y 3 bullets. Mucho más legible especialmente en mobile.

### Rework completo del gestor de contenido admin

**Qué**: `AdminContentManager.tsx` pasó de archivo monolítico de 1005 líneas (lista expandible con formularios inline) a layout master-detail estilo Platzi/Linear, partido en 5 componentes con responsabilidad clara.

**Por qué**: la versión previa mezclaba state, layout y 4 formularios distintos inline. El usuario pidió interfaz más intuitiva, inspirada en sistemas conocidos.

**Estructura nueva**:
- `src/pages/admin/AdminContentManager.tsx` (~280 líneas, solo orquestación)
- `src/components/feature/admin-content/PlansSelector.tsx` — checkbox group reutilizable + `PLAN_BADGE_STYLES` export
- `src/components/feature/admin-content/ModulesSidebar.tsx` — sidebar 320px con búsqueda, selección activa, reorder con flechas en hover
- `src/components/feature/admin-content/ModuleDetail.tsx` — panel derecho con header del módulo, stats inline, lista de `LessonRow`, CTA crear lección
- `src/components/feature/admin-content/ModuleFormSheet.tsx` — drawer crear/editar módulo
- `src/components/feature/admin-content/LessonFormSheet.tsx` — drawer crear/editar lección con upload TUS a Cloudflare e indicador de progreso interno

**Mejoras UX**: búsqueda de módulos (nuevo), edición en drawer lateral en vez de inline, header sobrio sin hero cinematográfico, acciones secundarias en menú `⋮`, tipografía calmada, upload bloquea cierre del drawer mientras sube (antes era posible cerrarlo y romper el progreso).

### Rework del player de live: reemplazo de `@cloudflare/stream-react` por `hls.js` + `<video>` nativo

**Problema acumulado** (reportado por usuario):
- Buffering/reconexión cada ~5s, "como tratando de reconectar"
- Calidad baja sin selector — no había forma de elegir 1080p/720p
- Botón fullscreen no funciona en mobile (especialmente iOS)
- Sin control sobre buffer ni recovery

**Causa raíz común**: el SDK de Cloudflare encierra todo dentro de un iframe. Sin acceso a `hls.levels[]`, sin recovery configurable (cada stall = reload del manifest), sin acceso al `<video>` element interno (iOS Safari requiere `webkitEnterFullscreen()` sobre el `<video>`, no sobre el wrapper).

**Solución** (`src\components\feature\LiveHLSPlayer.tsx` nuevo + `LivePlayerControls.tsx` reescrito + `VIPLiveRoom.tsx` modificado):

1. **`LiveHLSPlayer`**: componente con `<video>` HTML nativo + `hls.js` apuntando al manifest URL directo `https://customer-XXX.cloudflarestream.com/<input>/manifest/video.m3u8`. Detecta iOS Safari (HLS nativo) vs resto (hls.js polyfill). Cleanup explícito con `hls.destroy()` en useEffect.
2. **Config hls.js low-latency**: `lowLatencyMode: true`, `liveSyncDuration: 4`, `liveMaxLatencyDuration: 10`, `backBufferLength: 30`, `startLevel: -1` (ABR auto).
3. **Recovery silencioso**: `NETWORK_ERROR` → `hls.startLoad()`. `MEDIA_ERROR` → `hls.recoverMediaError()` con retry counter (max 2). Solo dispara `onError` si la recuperación falla.
4. **Selector de calidad**: hls.js expone `hls.levels[]`. Nuevo dropdown en `LivePlayerControls` con menú "Auto / 1080p / 720p / 480p..." usando shadcn `DropdownMenu`. Click forza nivel via `hls.currentLevel = N` (o `-1` para Auto).
5. **Fullscreen iOS**: `LiveHLSPlayer.enterFullscreen()` detecta iOS Safari y llama `video.webkitEnterFullscreen()` (la única API que iOS soporta), resto usa `requestFullscreen()` standard sobre el wrapper. Listeners `webkitbeginfullscreen` / `webkitendfullscreen` para sync de estado.
6. **API forwarded**: `LiveHLSPlayerHandle` expone `video`, `enterFullscreen`, `exitFullscreen`, `setQualityLevel`, `getQualityLevels` via `useImperativeHandle`. El parent maneja play/pause/mute directo sobre `livePlayerRef.current?.video`.

**Por qué NO repite el problema de `removeChild` del CHANGELOG 2026-05-16**: no hay iframe. No hay `window.Stream()` mutando DOM por fuera de React. hls.js sólo escribe sobre el `<video>` ref que React controla. Cleanup explícito.

**Dependencia agregada**: `hls.js` (~50KB gzip). Se usa SÓLO para `VIPLiveRoom`. VOD (`LessonPlayer`, `HistoryPage`) sigue con `@cloudflare/stream-react`.

**Verificación**: `npm run typecheck` ✅ limpio.

