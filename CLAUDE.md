# CLAUDE.md — Escuela de la Riqueza

> Plataforma educativa con planes Free / Individual / VIP para Iván Mazo.
> Landing pública + área de alumnos + lives en vivo + panel admin self-service.

---

## 1. Producto

**Cliente**: Iván Mazo (conferencista, no técnico).
**Visión**: Plataforma tipo Platzi donde Iván sube cursos, programa lives y gestiona usuarios sin que el desarrollador tenga que tocar código por cada cambio de contenido.

**Roles**:
| Rol | Acceso |
|---|---|
| `anon` | Landing, módulos free con publicidad cada 120s |
| `free` | Módulos free sin publicidad reducida, comunidad limitada |
| `individual` | Todo el catálogo, modo podcast, notas, certificados |
| `vip` | Individual + lives 1:1 con Iván + grupales |
| `admin` | Panel completo (Iván) — CRUD cursos, lives, usuarios, métricas |

---

## 2. Stack

| Capa | Tecnología | Estado |
|---|---|---|
| Build / dev | Vite 8 | ✅ instalado |
| UI | React 19 | ✅ instalado |
| Lenguaje | TypeScript | ✅ migrado (todos los `.tsx`) |
| Routing | React Router DOM 7 | ✅ instalado |
| Estilos | Tailwind CSS 4 (`@tailwindcss/vite`) | ✅ instalado |
| UI primitives | shadcn/ui (Radix + button, sheet, select, dropdown, accordion, tooltip, dialog) | ✅ instalado |
| Animaciones | motion (Framer Motion v12) + Lenis (smooth scroll desktop) | ✅ instalado |
| Iconos | lucide-react | ✅ instalado |
| Carousels | embla-carousel-react + embla-carousel-autoplay | ✅ instalado |
| Forms + validación | react-hook-form + zod (v4) | ✅ instalado |
| State cliente | zustand (auth.store, player.store, preferences.store) | ✅ instalado |
| Server state | @tanstack/react-query | ✅ instalado |
| Auth + DB + Realtime + Storage | Supabase | ✅ integrado (auth real, RLS, realtime chat) |
| VOD + Live | Cloudflare Stream | ✅ integrado (upload directo + Live Inputs + grabaciones) |
| Storage de recursos (PDFs) | Cloudflare R2 | ❌ pendiente |
| Pagos | Stripe (Subscriptions) | 🟡 parcial (tabla subscriptions via SQL trigger, sin webhook Stripe aún) |
| Backend mínimo | Vercel Serverless Functions (`/api/*.ts`) | ✅ 3 functions (`upload-url.ts`, `live-input-status.ts`, `recording.ts`) |
| Gráficos | recharts | ✅ instalado |
| SEO landing | vite-prerender-plugin | ❌ pendiente |
| Tests | Vitest + @testing-library/react + @testing-library/jest-dom | ✅ configurado (15 tests) |
| Deploy | Vercel | ✅ deployando |

> **No hay backend Express standalone.** El "backend" es: Supabase (auth/DB/realtime) + Cloudflare (video/storage) + Stripe (pagos) + un puñado de Vercel Functions para firmar URLs y recibir webhooks.

---

## 3. Estructura objetivo

```
escuela_riqueza/
├── api/                          # Vercel Serverless Functions
│   ├── stream/
│   │   ├── upload-url.ts         # Firma URL de upload directo a Cloudflare Stream
│   │   ├── live-input-status.ts  # Consulta estado del Live Input (OBS conectado?)
│   │   └── recording.ts          # Obtiene grabación de un Live Input finalizado
│   └── stripe/                   # ❌ Pendiente
│       ├── checkout.ts           # Crea sesión de checkout
│       └── webhook.ts            # Recibe eventos Stripe, actualiza Supabase
├── public/                       # Assets estáticos (favicon.svg)
├── src/
│   ├── main.tsx
│   ├── App.tsx
│   ├── routes.tsx                # Definición central de rutas + guards + PageTransition wrapper
│   ├── lib/
│   │   ├── supabase.ts           # Cliente Supabase tipado
│   │   ├── utils.ts              # cn() helper (clsx + tailwind-merge)
│   │   ├── query-client.ts       # QueryClient de @tanstack/react-query
│   │   └── api/                  # Capa de datos
│   │       ├── client.ts         # Helpers base (delay, ApiError)
│   │       ├── auth.ts           # signIn, signUp, signOut, getCurrentUser reales
│   │       ├── courses.ts        # Mock de módulos/lecciones
│   │       ├── lives.ts          # Mock de lives/chat
│   │       ├── billing.ts        # Mock de suscripción
│   │       ├── admin/
│   │       │   ├── metrics.ts    # Dashboard KPIs reales desde Supabase
│   │       │   └── users.ts      # CRUD de usuarios admin real
│   │       └── stream/
│   │           ├── content.ts    # CRUD real de módulos/lecciones en Supabase
│   │           ├── lives.ts      # CRUD real de lives, input status, recordings
│   │           └── progress.ts   # Progreso de lecciones (upsert)
│   ├── schemas/                  # Validación zod
│   │   ├── auth.schema.ts        # Login/Signup/Reset
│   │   ├── lesson.schema.ts      # Subida de lección
│   │   └── live.schema.ts        # Creación de live
│   ├── types/
│   │   ├── user.ts               # Plan, UserRole, User
│   │   ├── course.ts             # Module, Lesson, ModuleWithLessons
│   │   ├── live.ts               # Live, ChatMessage, LiveStatus
│   │   └── subscription.ts       # Subscription, SubscriptionStatus
│   ├── stores/                   # Zustand stores con persist
│   │   ├── auth.store.ts         # Sesión del usuario
│   │   ├── player.store.ts       # Modo podcast (track, isPlaying, volumen)
│   │   └── preferences.store.ts  # Animaciones toggle
│   ├── mocks/                    # Datos mock legacy
│   │   ├── courses.ts            # 6 módulos, 3 lecciones
│   │   ├── lives.ts              # 1 live programado
│   │   └── users.ts              # 4 usuarios de prueba
│   ├── hooks/
│   │   ├── useAuth.ts            # Envuelve auth store + api auth
│   │   ├── useRequireRole.ts     # Guard de rutas por rol/plan
│   │   ├── useMediaQuery.ts      # useIsDesktop, usePrefersReducedMotion
│   │   └── useScrollToHash.ts    # Hash scroll con offset para AnimatePresence
│   ├── components/
│   │   ├── ui/                   # shadcn/ui primitives (button, dialog, sheet, select, dropdown, accordion, tooltip, skeleton, empty-state, toaster)
│   │   ├── layout/               # Header, Footer, AdminLayout, RequireAuth, ErrorBoundary
│   │   └── feature/              # PodcastEngine, GlobalPodcastPlayer, LessonPlayer, LiveChat, AuthSplash, AnimationToggle, HeroCinematic, AwakeningAct, IntelligencesAct, PathAct, PlansAct
│   └── pages/
│       ├── public/               # LandingPage, AuthPage, ResetPassword, EmailConfirmed, Plans, HistoryPage, TermsPage, PrivacyPage, NotFound
│       ├── student/              # StudentDashboard, LessonViewer, VIPLiveRoom
│       └── admin/                # AdminMetrics, AdminContentManager, AdminLiveManager, AdminVideoUpload, AdminUsers, AdminUserDetail, AdminSettings
├── test/                         # Setup vitest
├── docs/
│   ├── ARCHITECTURE.md
│   ├── migrate-lives-schema.sql  # Migración lives + RLS
│   └── RESPONSIVE_AUDIT.md       # Auditoría responsive
├── sync_admin_plan.sql           # RPC admin_update_user_plan, admin_delete_user
├── sync_signup.sql               # Trigger handle_new_user (perfil + suscripción)
├── sync_profiles.sql             # Trigger handle_user_update (email sync)
├── sync_progress.sql             # Tabla user_lesson_progress + RLS + trigger
├── CLAUDE.md
└── README.md
```

---

## 4. Convenciones

### Nombres de archivo
- Componentes React: `PascalCase.tsx` (`LessonPlayer.tsx`)
- Hooks: `useCamelCase.ts` (`useAuth.ts`)
- Helpers / lib: `camelCase.ts` (`supabase.ts`)
- Tests: `Componente.test.tsx` o `archivo.test.ts` al lado del archivo

### Componentes
- Un componente por archivo. Export `default` para componentes de página, `named` para utilitarios.
- Props tipadas con `interface` (no `type` salvo para uniones).
- Sin `React.FC`. Función nombrada o arrow exportada.
- Si un componente pasa de ~150 líneas, dividir.

### Estilos
- **Solo Tailwind**. Nada de CSS modules ni styled-components.
- Paleta del cliente — definida en `tailwind.config.js`:
  - `dark` `#121212`, `darker` `#0a0a0a`
  - `gold` `#CCA43B`, `goldHover` `#E1B846`
  - `textMain` `#E5E5E5`, `textMuted` `#A3A3A3`
- Helper `cn()` (de `clsx + tailwind-merge`) para combinar clases condicionales.
- Mobile-first: clases base = mobile, `md:` y `lg:` para escalar.

### Imports
- Path alias `@/` para `src/` (configurar en `vite.config.ts` y `tsconfig.json`).
- Orden: 1) librerías externas, 2) `@/`, 3) relativos, 4) tipos (`import type`).

### TypeScript
- `strict: true` siempre.
- No `any` salvo casos justificados con comentario de una línea.
- Tipos de DB: regenerar con `npx supabase gen types typescript --project-id <id> > src/types/database.ts` cada vez que cambia el schema.

---

## 5. Comandos

```bash
npm run dev          # vite dev server en http://localhost:5173
npm run build        # build de producción → dist/
npm run preview      # preview del build
npm run lint         # eslint
npm run typecheck    # tsc --noEmit
npm run test         # vitest
npm run test:ui      # vitest --ui
```

> **Nunca correr `npm run build` para "verificar" un cambio.** Para tipos: `npm run typecheck`. Para lógica: `npm run test`.

---

## 6. Variables de entorno

Ver `env.example` (copiar a `.env.local` para desarrollo). Reglas:
- Variables expuestas al cliente: prefijo `VITE_` (ej. `VITE_SUPABASE_URL`).
- Secrets que NUNCA tocan el cliente: sin prefijo, solo accesibles desde `/api/*.ts` (ej. `STRIPE_SECRET_KEY`, `CLOUDFLARE_STREAM_TOKEN`).
- Validar todas las env vars al boot con `zod` en `src/lib/env.ts`.

---

## 7. Patrones por feature

### 7.1 Auth con Supabase
- Cliente: `src/lib/supabase.ts` exporta `supabase` (singleton).
- Hook `useAuth()` envuelve `supabase.auth` y expone `user`, `session`, `signIn`, `signOut`, `loading`.
- Guard de ruta: componente `<RequireAuth>` y `<RequireRole role="admin">` que redirigen a `/login`.
- Plan del usuario se lee desde tabla `subscriptions` (no del JWT) — actualizada por webhook Stripe.

### 7.2 Subida de videos (admin)
1. Admin selecciona archivo en UI.
2. Cliente llama `POST /api/stream/upload-url` (Vercel Function) con metadata.
3. Function valida que el caller es admin (con JWT de Supabase) y pide a Cloudflare Stream una "Direct Creator Upload URL".
4. Function devuelve la URL firmada.
5. Cliente sube el archivo directo a Cloudflare (NO pasa por nuestro server).
6. Webhook de Cloudflare Stream avisa cuando el video terminó de procesar → guarda `stream_uid` en tabla `lessons`.

### 7.3 Reproducción protegida
- Para videos premium: cliente pide token a `POST /api/stream/playback-token` con `lesson_id`.
- Function chequea suscripción activa del usuario en Supabase, firma token de Cloudflare Stream con expiración corta (~5 min).
- Reproductor (`<Stream>` de `@cloudflare/stream-react`) consume el token.

### 7.4 Lives en vivo
- Iván desde el panel admin crea una sala (`AdminLiveManager`) con título, `starts_at`, `stream_live_input_id`, `background_image_url` y `allowed_plans`.
- Tabla `lives`: `id, title, description, starts_at (NOT NULL), duration_minutes, stream_live_input_id, required_plan, status (scheduled/live/ended), background_image_url, allowed_plans (text[]), created_at`.
- Iván emite desde OBS apuntando al RTMP de Cloudflare (servidor `rtmps://live.cloudflare.com:443/live/`, clave = Input ID).
- **Reproducción WebRTC**: en `VIPLiveRoom` se usa un `<iframe>` directo a Cloudflare con `?mode=webrtc&preferLowLatency=true` para latencia <1s.
- Admin forza EN VIVO desde el panel → cambia `status` a `"live"` con mutex (solo 1 sala activa).
- VIP ve countdown desde `starts_at` → intro cinemática → player WebRTC.
- Polling 3s como fallback por si Realtime no está habilitado.
- Chat en `Supabase Realtime` (canal `live:{liveId}`) — broadcast con tabla `live_messages` y RLS por suscripción.
- Para baja latencia: OBS en CBR, keyframe 1s, 30fps; Cloudflare Live Input con Low-Latency HLS + WebRTC activado.

### 7.5 Pagos
- Plan elegido en landing → checkout de Stripe (`POST /api/stripe/checkout`).
- Webhook `/api/stripe/webhook.ts` recibe `customer.subscription.*` y actualiza tabla `subscriptions` en Supabase.
- "Customer Portal" de Stripe para que el usuario gestione su suscripción.

### 7.6 RLS (Row Level Security)
La capa crítica de seguridad. Toda tabla con datos sensibles debe tener policies. Patrón base:

```sql
-- Lecciones premium solo si hay suscripción activa
create policy "view_premium_lessons" on lessons
for select using (
  is_premium = false
  or exists (
    select 1 from subscriptions
    where user_id = auth.uid()
      and status = 'active'
      and plan in ('individual', 'vip')
  )
);
```

> **Si una tabla nueva no tiene RLS habilitada, NO se mergea.**

---

## 8. Reglas de seguridad

1. **Nunca** exponer secret keys en el cliente. Solo en `/api/*.ts`.
2. **Nunca** confiar en el cliente para roles/permisos. Las decisiones de acceso ocurren en RLS de Supabase + verificación en Vercel Functions.
3. **Siempre** validar input en las Functions con `zod`.
4. **Webhooks** validan firma (`stripe.webhooks.constructEvent`).
5. **No commitear** `.env.local`, `.env`, claves, ni archivos de Supabase generados con datos reales.

---

## 9. Estilo de código (auto-resuelto desde skill registry)

- **react-19**: sin `useMemo`/`useCallback` salvo necesidad real (React Compiler optimiza).
- **typescript**: `strict: true`, sin `any`, `interface` para props.
- **tailwind-4**: `cn()` helper, sin `var()` en `className`, theme variables en config.
- **zod-4**: schemas como single source of truth, `z.infer<>` para tipos.
- **react-hook-form**: con `zodResolver` para validación.

---

## 10. Estado del proyecto (Actualizado 2026-05-14)

### 10.1 Funcionalidad implementada

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
- `AdminLiveManager.tsx`: CRUD de salas con schema real (`starts_at`, `status`, `stream_live_input_id`, `allowed_plans`, `required_plan`, `is_active`). Timezone auto-detected con badge. Drag & drop de imagen de fondo a Supabase Storage (bucket `backgrounds`). Botón "Forzar EN VIVO" con mutex. Botón Activar/Inactivar por sala (columna `is_active`). Guía OBS con pasos para baja latencia y activación WebRTC.
- `VIPLiveRoom.tsx`: countdown desde `starts_at`, intro cinemática al activarse, reproductor WebRTC via `<iframe mode=webrtc>` para latencia <1s. Suscripción Realtime a TODA la tabla `lives` + polling 3s. Acceso dinámico: valida `allowed_plans` del active live (sin plan fijo en ruta). Si el plan del usuario no está en `allowed_plans`, redirige al dashboard.
- `LiveChat.tsx`: chat funcional con scroll y broadcast en tiempo real (Supabase Realtime).

**Admin shell**
- `AdminLayout.tsx`: sidebar premium con shimmer en item activo, profile card, mouse-tracking glow, animated orbs en fondo. Sheet en mobile.
- `AdminMetrics.tsx`: KPIs cards, gráfico de áreas (recharts), top módulos. Conectado a datos reales de Supabase vía `src/lib/api/admin/metrics.ts` (cuenta usuarios por plan, módulos publicados, MRR estimado).
- `AdminUsers.tsx`: tabla con búsqueda, filtros por plan/rol, cambio de plan mediante modal, eliminación de usuarios. Datos reales desde Supabase vía `src/lib/api/admin/users.ts`.
- `AdminSettings.tsx`: secciones agrupadas (Marca, Pagos, Notificaciones, Integraciones). Forms premium.

**Animación / preferencias**
- `MotionProvider.tsx`: envuelve la app en `MotionConfig`, controla Lenis en desktop, respeta `prefers-reduced-motion` y el toggle global del usuario.
- `AnimationToggle.tsx`: control persistido en `preferences.store` (zustand).
- `routes.tsx`: Enuelto en `AnimatePresence` con `PageTransition` wrapper para transiciones fluidas de fade y blur entre páginas.
- `src/components/ui/dialog.tsx`: Componente base de modal premium con backdrop blur, ring focus accesible y estética alineada.

### 10.2 Funcionalidad pendiente (la trabaja el compañero de equipo)
- `/api/stream/playback-token.ts` — token firmado para reproducir VOD premium sin que se filtre la URL.
- `/api/stripe/checkout.ts` + `/api/stripe/webhook.ts` — sincronización de plan vía suscripciones real de Stripe.
- Tabla `subscriptions` existe y se crea vía trigger SQL en signup, pero sin webhook Stripe real que la mantenga sincronizada.
- Generación de tipos `src/types/database.ts` con `supabase gen types`.
- Cloudflare R2 para PDFs / recursos descargables.

### 10.3 Estado visual por panel (100% frontend — owner del proyecto)

**🟢 PREMIUM (funcional y con buen diseño)**
- `LandingPage.tsx` y todos sus actos (`HeroCinematic`, `AwakeningAct`, `IntelligencesAct`, `PathAct`, `PlansAct`).
- `AuthPage.tsx` (signin/signup/forgot) y `ResetPassword.tsx`.
- `NotFound.tsx` (404 cinemático), `ErrorBoundary` (UI premium con retry), `AuthSplash` (logo halo + ring).
- `AdminLayout.tsx` y `AdminVideoUpload.tsx`.
- `AdminMetrics.tsx`, `AdminUsers.tsx`, `AdminSettings.tsx` (Fase 3 completada con recharts y mocks).
- `StudentDashboard.tsx` (Fase 4 completada con progreso real, módulos conectados a DB, insignias y certificados por módulo).
- `VIPLiveRoom.tsx` (flujo completo: countdown → intro cinemática → WebRTC <1s + chat real).
- `AdminLiveManager.tsx` (CRUD completo con schema real, drag-drop imagen, timezone Colombia, guía OBS + WebRTC).
- `Plans.tsx` (página pública `/planes` completa con FAQ interactivo y tabla comparativa).
- `HistoryPage.tsx` (página `/historia` con video Cloudflare Stream embebido y copia profesional).
- `TermsPage.tsx` y `PrivacyPage.tsx` (páginas legales profesionales con contactos formales).
- `EmailConfirmed.tsx` (post-signup: checking/success/error estados con auto-redirect).
- `AdminUserDetail.tsx` (drill-down: perfil, suscripción, acciones — modificar plan/suspender/eliminar).

**🟡 DECENT (gold/dark aplicado pero falta polish)**
- `Header.tsx` — falta: menú mobile funcional (botón existe pero no abre nada).
- `Footer.tsx` — falta: gradient sutil, separador animado, vida visual.
- `AdminContentManager.tsx` — falta: skeleton, focus-state animado, depth en upload zone.
- `LessonPlayer.tsx` — falta: skeleton al cargar metadata, skin custom sobre `<Stream>`.
- `GlobalPodcastPlayer.tsx` — falta: thumb del slider custom, pulse en barras, expand/collapse mobile.
- `LiveChat.tsx` — mensajes sin entrance, input plano, sin skeleton, sin "está escribiendo".

**🔴 BASIC / MISSING (placeholder o sin identidad)**
- `LessonViewer.tsx` — playlist sin animación, modal upgrade plano, sin empty states.

### 10.4 Sistemas transversales

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

### 10.5 Plan de fases de estilo

**✅ Fase 1 — Foundation (transversal)**
- Toaster + Skeleton + EmptyState + tests.

**✅ Fase 2 — Pantallas globales**
- NotFound 404 + ErrorBoundary + AuthSplash + AuthBootstrap provider + tests.

**✅ Fase 3 — Admin pages desde cero (Completada)**
- `AdminMetrics.tsx`: KPIs cards, gráfico áreas (recharts), top módulos. Mock data.
- `AdminUsers.tsx`: tabla con search + filtros plan/rol + paginación. Mock data.
- `AdminSettings.tsx`: secciones agrupadas (Marca, Pagos, Notificaciones, Integraciones). Forms premium.

**🔜 Fase 4 — Polish DECENT pages**
- ✅ `StudentDashboard.tsx`: Rediseño UX mobile-first, sticky nav, drill-down (grid -> player), `AnimatePresence` en tabs, Skeletons implementados, global toaster.
- ✅ `VIPLiveRoom.tsx`: flujo completo (countdown → intro cinemática → WebRTC <1s + chat real).
- ✅ `AdminLiveManager.tsx`: CRUD completo, drag-drop imagen, timezone Colombia, guía OBS + WebRTC.
- ⏳ `LiveChat.tsx`: rediseñar (entrance de mensajes, input premium, skeleton, "está escribiendo").
- ⏳ `LessonViewer.tsx`: playlist animada, modal upgrade premium, empty states con `<EmptyState/>`.
- ⏳ `Header.tsx`: menú mobile funcional usando `<Sheet>` ya disponible.
- ⏳ `Footer.tsx`: gradient sutil + separador animado.

**🔜 Fase 5 — Player + Admin polish**
- Custom skin sobre `<Stream>` (Cloudflare) con controles dorados — para `LessonPlayer` (VOD).
- Pulir `GlobalPodcastPlayer` (thumb slider custom, pulse en barras durante playback, expand/collapse mobile).
- Pulir `AdminContentManager` (skeleton, focus animado, depth en upload zones).

**✅ Fase Cierre — Transitions globales + Modal premium**
- ✅ Wrapper con `AnimatePresence` en `routes.tsx` para fade/slide entre rutas.
- ✅ Wrapper sobre `Dialog` (radix) con backdrop blur + scale-in para reemplazar los defaults en toda la app.

### 10.7 Arquitectura del Modo Podcast (crítico — no romper)

El modo podcast es el feature más delicado de la plataforma. Permite al usuario escuchar el audio de una lección en segundo plano mientras navega por cualquier ruta. Su implementación requirió una arquitectura específica debido a limitaciones de Cloudflare Stream y navegadores.

#### 10.7.1 Filosofía

**Nunca puede haber dos `<Stream>` de Cloudflare para el mismo video UID en el DOM.** Si hay dos iframes del mismo UID, al destruirse uno (por navegación SPA), Cloudflare Stream corta la sesión de reproducción del otro, silenciando el audio.

#### 10.7.2 Separación Engine / UI

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

#### 10.7.3 Árbol de montaje

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

#### 10.7.4 `PodcastEngine` — patrones clave

**`everActivated` (useState):** Una vez que el usuario activa el modo podcast (primer `track ≠ null`), el contenedor `<div>` se monta permanentemente. Cerrar el podcast (`closePlayer`) solo setea `track = null`, el contenedor sigue en el DOM. El `<Stream>` se renderiza condicionalmente (`{track && <Stream>}`) pero el contenedor siempre está, evitando que React lo destruya en re-renders.

**Refs sincronizadas vs stale closures:** Los handlers nativos del `<Stream>` (onPause, onCanPlay, onTimeUpdate) NO pueden depender del closure de React porque se ejecutan en contexto del iframe. Se usan refs paralelas actualizadas con useEffect:
```ts
const isPlayingRef = useRef(false);
useEffect(() => { isPlayingRef.current = isPlaying; }, [isPlaying]);
```

**Watchdog (setInterval 1s):** El navegador puede suspender iframes sin disparar el evento `pause` (especialmente en navegación SPA o cambio de pestaña). El watchdog verifica `el.paused` cada segundo y fuerza `play()` si corresponde. No depende de ningún evento.

**visibilitychange:** Listener que reanuda el audio cuando el documento vuelve a `visible`. Complementa al watchdog para reanudación inmediata (sin esperar el intervalo de 1s).

**Dimensiones del contenedor:** `320×180px` con `transform: translateX(-9999px)`. Chromium clasifica elementos con `width/height < ~50px` como "background" y los suspende. Usar dimensiones reales + desplazamiento fuera del viewport evita esto. `opacity: 0.01` (no `opacity: 0`) porque Chromium también suspende elementos con `opacity: 0`.

#### 10.7.5 `LessonPlayer` — sin iframe duplicado

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

#### 10.7.6 Flujo de activación

1. Usuario en `/leccion` → activa "Modo Podcast"
2. `handlePodcastToggle` → `playTrack(track, currentTime)` → store setea `track`, `isPodcastMode: true`, `isPlaying: true`
3. `PodcastEngine` re-renderiza: `everActivated` → `true`, `<Stream>` monta, iframe carga, `onCanPlay` → restaura posición → `play()`
4. `LessonPlayer` re-renderiza: `isPlayingThisInPodcast = true` → `<Stream>` del video se desmonta del DOM
5. El audio ahora solo sale del `PodcastEngine` (un iframe)
6. Usuario navega (logo, admin, login, etc.) — `PodcastEngine` no se ve afectado (fuera de Router)
7. Si el navegador suspende el iframe, el watchdog lo retoma en ≤1s

#### 10.7.7 Historial de bugs resueltos

| Bug | Síntoma | Causa raíz | Fix |
|---|---|---|---|
| Audio doble al activar podcast | Se escuchaban dos audios superpuestos | El `useEffect` que controlaba play/pause del video local salía antes de pausar cuando `isPlayingThisInPodcast` era true | El efecto ahora pausa siempre que `isPlayingThisInPodcast \|\| showAd \|\| !playRequested` |
| Podcast se pausa al navegar a Home/admin | El audio se cortaba al hacer clic en el logo o entrar al admin | `PodcastEngine` estaba dentro de `BrowserRouter` y `AuthBootstrap`. Cambios de ruta/auth causaban re-renders que destruían el iframe | Mover `PodcastEngine` a `main.tsx` fuera de todos los providers |
| Podcast se pausa al navegar (segundo intento) | El audio seguía cortándose pese al fix anterior | `LessonPlayer` mantenía un segundo `<Stream>` del mismo video UID con `opacity-0` (para "no perder el SDK"). Al navegar, este iframe se destruía y Cloudflare cortaba la sesión compartida | Eliminar el `<Stream>` del `LessonPlayer` cuando `isPlayingThisInPodcast` es true |
| Podcast no se reanuda tras volver a la pestaña | El audio quedaba en pausa al volver de otra pestaña | `onPause` del Stream no se disparaba siempre. El closure de React tenía valores stale de `isPlaying`/`isPodcastMode` | Watchdog 1s + refs sincronizadas + visibilitychange listener |
| Contenedor del iframe tenía posición estática | Warning de Cloudflare Stream | El SDK require `position: non-static` para calcular offset | `position: fixed` en el contenedor del engine |
| Podcast se reinicia al activar modo podcast | Al togglear a podcast, el audio volvía a empezar desde 0 en vez de retomar la posición actual | `onTimeUpdate` del iframe recién cargado disparaba `currentTime: 0` antes de que `onCanPlay` hiciera el seek. Ese 0 sobreescribía `lastKnownTime`. | Guard `if (!initializedRef.current) return;` en `handleTimeUpdate` de `PodcastEngine`. Además se agregaron `lastKnownTimeRef`, `trackRef`, `lastVideoIdRef` sincronizados para evitar stale closures en handlers del Stream. |

#### 10.7.8 Reglas para no romper el modo podcast

1. **Nunca renderizar dos `<Stream>` del mismo video UID.** Si hay un Stream en `PodcastEngine` reproduciendo un UID, ningún otro componente debe renderizar un `<Stream>` con el mismo `src`.
2. **No mover `PodcastEngine` dentro de `BrowserRouter` o `AuthBootstrap`.** Su posición en `main.tsx` como sibling de `QueryClientProvider` es la única garantía de supervivencia.
3. **No confiar en eventos nativos del iframe para reanudación.** El watchdog con `setInterval` es el mecanismo principal. Los eventos `onPause`/`visibilitychange` son complementarios.
4. **Siempre usar refs sincronizadas para valores de store en handlers del Stream.** Los closures de React quedan stale.
5. **`opacity: 0.01` y dimensiones reales (320×180) para el contenedor.** `opacity: 0` o `width/height: 1` causan throttling en Chromium.
6. **No persisitir `isPlaying` en el store.** Al recargar la página, el navegador bloquea autoplay. El estado de reproducción debe comenzar como `false` y activarse con gesto del usuario.

### 10.8 Historial de cambios — 2026-05-11

#### API de lives alineada al schema real de Supabase
- `src/lib/api/stream/lives.ts`: `LiveEvent` reescrito para coincidir con la tabla real (`starts_at`, `status`, `stream_live_input_id`, `required_plan`, `allowed_plans`, `background_image_url`).
- `fetchActiveLive()` ahora devuelve la sala con `status="live"` o la próxima `scheduled`.
- `sanitize()` corregido: solo convierte `""` a `null` para campos presentes en el payload (no para undefined). Fix del error 400 al forzar EN VIVO que mataba `starts_at`.

#### AdminLiveManager — funcionalidad completa
- **Timezone Colombia**: badge automático con timezone detectado (`Intl`). Helper `isoToLocalDatetime` para que el input `datetime-local` respete la zona horaria local al cargar datos guardados.
- **Drag & drop de imagen**: subida a Supabase Storage bucket `backgrounds`. Fallback URL textual. Validación de tamaño (5MB max).
- **Campos simplificados**: eliminado `duration_minutes` del UI. `required_plan` se auto-deriva del plan más alto en `allowed_plans`. Sin duplicados.
- **Refresco al seleccionar sala**: `selectRoom()` hace fetch fresco a Supabase en vez de usar el estado local.
- **Guía OBS**: pasos para CBR, keyframe 1s, 30fps, Low-Latency HLS y activación WebRTC.

#### VIPLiveRoom — WebRTC + polling
- **Reemplazo de `<Stream>` por `<iframe>` directo**: URL modo WebRTC (`?mode=webrtc&preferLowLatency=true`) para latencia <1s. Usa `VITE_CLOUDFLARE_STREAM_CUSTOMER_SUBDOMAIN` del `.env`.
- **Polling 3s**: consulta periódica a Supabase como fallback de Realtime (no requiere F5).
- **Fallback de título**: si `live.title` existe, se muestra solo el título; si no, cae a "El conocimiento es la moneda definitiva".

#### SQL migrations
- `docs/migrate-lives-schema.sql`: incluye:
  - `ALTER COLUMN background_image_url` (si no existe)
  - `ALTER TABLE ADD COLUMN is_active boolean NOT NULL DEFAULT false`
  - `ALTER TABLE ADD COLUMN recording_stream_uid text`
  - RLS policies para `lives`, `live_messages`, storage bucket `backgrounds`
  - Habilitación de Realtime (`ALTER PUBLICATION supabase_realtime ADD TABLE lives`)
  - WebRTC manual step reminder

### 10.9 Historial de cambios — 2026-05-12

#### Columna `is_active` + selección manual de sala activa
- **Motivación**: el admin quería elegir QUÉ sala se muestra a los usuarios, no que el sistema auto-seleccionara la más próxima.
- **Columna `is_active`** (`boolean NOT NULL DEFAULT false`) agregada a tabla `lives`.
- **`apiSetActiveLive(id)`** en `src/lib/api/stream/lives.ts`: desactiva todas las demás salas (`is_active = false`) y activa la seleccionada (`is_active = true`), todo en una transacción.
- **`fetchActiveLive()`** reescrito: ahora solo consulta `is_active = true` + `status IN (scheduled, live)`. Sin auto-selección.
- **Botón Activar/Inactivar** en `AdminLiveManager.tsx`: cada sala tiene un ícono de radio en la lista. Al clickear, llama a `apiSetActiveLive()` y actualiza el estado local + editor + toast.

#### VIPLiveRoom — real-time contra toda la tabla + acceso dinámico por plan
- **Ruta `/vip-live`** (`routes.tsx`): se quitó `minPlan={PLANS.VIP}`. Ahora es accesible a cualquier usuario autenticado.
- **Validación de plan en VIPLiveRoom**: en el mount, si el `activeLive` existe pero el plan del usuario no está en `allowed_plans`, redirige a `/dashboard` via `useNavigate`.
- **Suscripción Realtime a TODA la tabla** `lives` (antes solo al `live.id` específico). Esto permite detectar:
  - Admin activa otra sala → VIP se cambia instantáneamente a la nueva sala
  - Admin forza EN VIVO → la sala transiciona a live → intro cinemática → stream
  - Admin detiene → vuelve a scheduled → countdown
  - Admin finaliza → `fetchActiveLive()` devuelve null → muestra "No hay eventos"
- **`isLive`** ahora es derivado (`live?.status === "live"`) en vez de estado separado. Detener/Finalizar resetean correctamente la vista sin stale state.
- **Polling 3s** siempre activo (ya no condicional a `!live || live.status === "live"`) para cubrir fallback de Realtime.

#### StudentDashboard — entrada anticipada ≤15 min
- **Botón "Ver sala"** cuando el live está programado y falta ≤15 min para `starts_at`. Link a `/vip-live` para que el usuario entre a la sala de espera con countdown.
- Si falta >15 min, muestra "Disponible para tu plan" (sin CTA).
- La sección de lives ahora usa `fetchActiveLive()` en vez de `fetchLivesForPlan()`. Solo muestra la sala que el admin activó, si pertenece al plan del usuario.

### 10.10 Historial de cambios — 2026-05-13

#### Grabación automática de lives (sin acceso a Cloudflare)
- **`/api/stream/recording.ts`** (Vercel Function): consulta Cloudflare Stream API para obtener el video de grabación de un Live Input. También habilita MP4 downloads vía API (`POST /accounts/{id}/stream/{uid}/downloads`).
- **`fetchRecording(liveInputId)`** en `src/lib/api/stream/lives.ts`: llama a la Vercel Function desde el frontend.
- **Botón "Obtener grabación"** en AdminLiveManager editor: busca la grabación en Cloudflare y rellena `recording_stream_uid` automáticamente.
- **Al hacer clic en "Finalizar"**: intenta obtener la grabación automáticamente. Si Cloudflare ya la procesó, se vincula automáticamente.
- **URL de descarga corregida**: `{subdomain}/{uid}/downloads/` (plural, con 's') que lista los MP4 disponibles.
- **Pestaña "Finalizados"**: muestra el iframe embebido de la grabación + botón descarga + botón "Reactivar" (cambia status de vuelta a scheduled).

#### VIPLiveRoom — auto-detección de OBS + sala persistente
- **El iframe de Cloudflare WebRTC** se muestra automáticamente cuando `starts_at` ha pasado (sin depender de Forzar EN VIVO). Cloudflare maneja internamente el estado "live" / "waiting for signal" según si OBS está transmitiendo.
- **Detección de OBS vía API**: cuando la sala está en countdown (antes de `starts_at`), `VIPLiveRoom` consulta `/api/stream/live-input-status.ts` cada 10s. Si Cloudflare reporta que el Live Input está `connected` (OBS transmitiendo), salta el contador y muestra el iframe inmediatamente.
- **Nuevo estado "FINALIZADO"**: cuando admin hace clic en "Finalizar", la sala NO se oculta. Muestra "Transmisión finalizada" overlay + el chat sigue activo. Solo al desactivar `is_active` aparece "No hay eventos".
- **Chat siempre visible**: en estados scheduled, live, ended y hasta que la sala se desactive.
- **Badges dinámicos**: "EN VIVO" (rojo), "EN ESPERA" (dorado, OBS conectado o starts_at pasado), "PRÓXIMAMENTE" (antes de starts_at), "FINALIZADO" (gris).

### 10.11 Historial de cambios — 2026-05-14 (Sesión 1)

#### Arquitectura robusta del Modo Podcast (Autoplay + Lock Screen)
- **Desbloqueo de Autoplay en Móviles (Safari/Chrome)**: Modificado `PodcastEngine` para que SIEMPRE renderice el `<Stream>` (usando un video de Cloudflare silenciado como placeholder). Esto garantiza que el iframe exista en el DOM antes del gesto del usuario, permitiendo que `internalRef.current.play()` ocurra de forma síncrona sin ser bloqueado por los navegadores móviles.
- **Secuestro de MediaSession (El fix "Stream" en Lock Screen)**: Cloudflare Stream sobreescribe la metadata del sistema operativo por defecto. Se implementó una técnica de "secuestro" ("hijacking") utilizando un elemento `<audio id="media-session-hijacker">` invisible (con una pista silenciosa `data:audio/wav`). Cuando el iframe emite el evento `onPlay`, se espera 100ms e inmediatamente se reproduce el audio silencioso para "robarle" el foco del reproductor al sistema operativo e inyectar la metadata real (`track.title`, "Escuela de la Riqueza" y el logo de la marca desde el CDN).
- **Loop de Re-afirmación**: Añadido un intervalo cada 5 segundos que re-produce el secuestrador silencioso y actualiza la metadata, previniendo que iOS/Android le devuelvan el control al iframe al navegar o tras mucho tiempo.
- **Mutex Video vs Podcast**: Modificado `LessonPlayer` para prevenir audios superpuestos. Si un usuario tiene el podcast en segundo plano e intenta darle "Play" a cualquier lección visual normal, el sistema automáticamente hace `closePlayer()` sobre el estado global del podcast antes de arrancar el video.

### 10.12 Historial de cambios — 2026-05-14 (Sesión 2 — Footer, Páginas, Progreso)

#### Footer actualizado + páginas estáticas
- **Redes Sociales**: URLs de Instagram y YouTube corregidas a las oficiales (`instagram.com/escueladelariqueza`, `youtube.com/@EscuelaDeLaRiqueza`). Eliminado "Las 6 inteligencias" del footer.
- **Hash scrolling funcional**: Creado `useScrollToHash` hook en `src/hooks/useScrollToHash.ts`. Se invoca en `routes.tsx` y escucha cambios de `pathname` + `hash`. Cuando el hash cambia, hace `window.scrollTo` con offset -100px para respetar headers fijos. Timeout de 500ms para esperar transiciones de AnimatePresence.
- **Links del footer reparados**: "Planes y precios" → `/planes#planes`, "Preguntas frecuentes" → `/planes#faq`. Se agregaron `id="planes"` y `id="faq"` en `Plans.tsx`.
- **Nuevas páginas públicas**: `HistoryPage.tsx` (`/historia`) con video Cloudflare Stream embebido + copia profesional. `TermsPage.tsx` (`/terminos`) y `PrivacyPage.tsx` (`/privacidad`) con texto legal completo.
- **Email de contacto**: Actualizado de `soporte@escuelariqueza.com` a `escueladelariquezaweb@gmail.com` en Footer, TermsPage y PrivacyPage.

#### Sistema de progreso de lecciones (user_lesson_progress)
- **Tabla SQL en Supabase**: `user_lesson_progress` con columnas `user_id` (FK auth.users), `lesson_id` (FK lessons UUID), `progress_seconds`, `is_completed`, timestamps. RLS habilitado con políticas estrictas de select/insert/update solo para el propio usuario.
- **`src/lib/api/stream/progress.ts`**: API completa (`fetchUserProgress`, `saveUserProgress`, `fetchAllUserProgress`) usando `upsert` con `onConflict: 'user_id,lesson_id'`.
- **Auto-guardado en LessonPlayer**: cada 10s durante `onTimeUpdate` se llama `saveUserProgress()` con el `currentTime` actual. Throttle mínimo de 5s entre llamadas para no saturar Supabase.
- **Regla del 90%**: si `currentTime / duration >= 0.9`, se marca `is_completed: true` automáticamente.
- **Modal de retomo (Resume Modal)**: Al cargar una lección, se llama `fetchUserProgress()`. Si `progress_seconds > 5` y `!is_completed`, se muestra un Dialog (shadcn) premium con "Continuar viendo" (usa `pendingSeekRef` para hacer seek) o "Iniciar de nuevo".
- **Progreso en StudentDashboard**: Barra dorada de progreso por módulo usando `completed-lessons / total-lessons * 100`. Checks verdes en la playlist de lecciones. Pestaña Certificados ahora muestra tarjetas por módulo: dorado + check si 100%, gris + bloqueado + barra de progreso si menos.

#### Fix PodcastEngine — stale closures en handlers del Stream
- **Problema**: Al activar modo podcast, el iframe de Cloudflare se recargaba y su primer `onTimeUpdate` (con `currentTime: 0`) sobreescribía `lastKnownTime` en el store ANTES de que `onCanPlay` buscara restaurar la posición.
- **Solución**: Se agregaron `lastKnownTimeRef`, `trackRef`, `lastVideoIdRef` sincronizados con `useEffect`. `handleTimeUpdate` ahora ignora eventos si `!initializedRef.current` (guard para evitar que el `onTimeUpdate` del iframe recién cargado pise el seek). `handleCanPlay`, `handlePlayEvent`, `handleTimeUpdate` leen desde las refs en vez del closure stale.
- **Cambio en player.store**: `PodcastTrack.id` cambiado de `number` a `string | number` para soportar UUIDs reales de Supabase.

### 10.13 Reglas operativas para retomar

- Después de cada módulo terminado: correr `npm run typecheck` + `npx vitest run <files>` antes de cerrar la tarea.
- Mantener el inventario de tareas vivo (`TaskCreate`/`TaskUpdate`) en cada sesión nueva.
- Cualquier nuevo primitivo va a `src/components/ui/` con un test al lado (`*.test.tsx`).
- No volver a meter keyframes CSS en `tailwind.config.js`: las animaciones se hacen con Framer Motion.
- Toda toast del proyecto entra por `import { toast } from "@/components/ui/toaster"` — NO importar sonner directo.

### 10.14 Historial de cambios — 2026-05-14 (Sesión 3 — Upload, reordenar, podcast, insignias)

#### Fix: Loop de video pisaba `is_completed` (LessonPlayer)
- **Problema**: Cloudflare Stream reinicia el video al llegar al final, `handleTimeUpdate` con currentTime≈0 pisaba `is_completed=false`
- **Solución**: `endedRef` (useRef) que guarda `endedRef.current || ...` en el cálculo de `isCompleted`. `handleEnded` setea `playRequested=false` (corta el loop) y guarda completed. Overlay con check verde + "Reproducir de nuevo" cuando terminó.

#### Dashboard se actualiza sin F5 (polling fallback)
- **Problema**: `user_lesson_progress` no estaba en la publicación Realtime de Supabase, el dashboard solo mostraba progreso tras F5
- **Solución**: `setInterval` cada 15s que re-fetchea `fetchAllUserProgress()` y actualiza `userProgress`. La suscripción Realtime se conserva.

#### Progreso en modo podcast (PodcastEngine)
- **Problema**: `handleTimeUpdate` solo actualizaba el store de zustand, nunca persistía en Supabase
- **Solución**: Importado `saveUserProgress`. `handleTimeUpdate` guarda cada 10s con throttle 5s. `handleEnded` guarda con `isCompleted=true`. Mismas refs sincronizadas que en video.

#### Insignias con imágenes personalizadas
- Agregado `badge_image_url?: string | null` a interfaz `Module` en `content.ts`
- Certificates tab: si el módulo tiene `badge_image_url`, muestra `<img>` con grayscale si bloqueado, glow si desbloqueado; fallback a icono anterior
- SQL migration: `docs/migrate-badge-image.sql`

#### Barra de progreso en subida de videos (AdminContentManager)
- Nueva función `uploadFileWithProgress()` con `XMLHttpRequest` + `xhr.upload.onprogress`
- Reemplazado `fetch` por XHR para tracking de progreso en tiempo real
- Barra animated gradient gold en formularios de crear y editar lección
- `uploadVideo` envuelto en try/finally para limpiar estado incluso en error

#### Reordenar módulos (AdminContentManager)
- `updateModuleOrder(orderedIds)` con `PATCH` individuales en paralelo (`supabase.from("modules").update({ order_index }).eq("id", id)`) — evita error `null value in column "title"` que ocurría con `upsert`
- Flechas ↑↓ en cabecera de cada módulo (solo desktop). `handleMoveModule` intercambia localmente y persiste.

#### Rediseño UX del AdminContentManager
- Stats bar: módulos totales, lecciones, con video
- Create module: card full-width con fade en vez de popup top-right
- Cards con sombra, línea gold superior, icono BookOpen, contador de lecciones
- Lecciones con barra lateral gold, icono en caja, badges de plan coloreados
- Labels visibles en todos los campos del form
- Todos los `alert()` reemplazados por toasts del sistema
- Botones con spinner durante upload, drag zone con estados hover/focus/disabled
- Skeleton loading en vez de texto plano
- Selectores de plan como chips visuales con color por plan

#### Archivos modificados
| Archivo | Cambio |
|---|---|
| `src/components/feature/LessonPlayer.tsx` | endedRef, overlay completado, guard en isCompleted |
| `src/components/feature/PodcastEngine.tsx` | saveUserProgress en handleTimeUpdate y handleEnded |
| `src/pages/student/StudentDashboard.tsx` | Polling 15s, badge_image_url en certificados |
| `src/pages/admin/AdminContentManager.tsx` | Rediseño completo, upload progress, reordenar módulos |
| `src/lib/api/stream/content.ts` | updateModuleOrder, uploadFileWithProgress, badge_image_url en Module |
| `docs/migrate-badge-image.sql` | (nuevo) SQL para columna badge_image_url |

---

## 11. Reglas para Claude / agentes en este repo

- Match del idioma del usuario (español rioplatense voseo si responde así, inglés si no).
- Respuestas cortas. No options menus salvo bifurcación real.
- **Nunca** agregar features ni refactors fuera del scope pedido.
- **Nunca** crear archivos `.md` extra sin pedido explícito.
- **Nunca** correr `npm run build` para verificar.
- Antes de tocar tabla nueva en Supabase: verificar que tiene RLS.
- Antes de exponer un endpoint: verificar que valida JWT y rol.
- Conservar la paleta gold/dark — el diseño actual es del cliente.
- **SPA en Vercel**: cualquier ruta que no sea `/` requiere `vercel.json` con `rewrites: [{ "source": "/(.*)", "destination": "/index.html" }]`. Sin esto, recargar cualquier página (dashboard, VIP-live, admin) devuelve 404 NOT_FOUND. También afecta links con `<a href>` (navegación dura): aunque el link funcione en dev, en producción Vercel no conoce la ruta y devuelve 404.
- **Grabaciones de lives**: columna `recording_stream_uid` en tabla `lives`. Al hacer clic en "Finalizar", el sistema intenta obtener la grabación automáticamente desde Cloudflare via `/api/stream/recording.ts` (Vercel Function). También hay botón "Obtener grabación" manual en el editor. En la pestaña "Finalizados" se muestra iframe embebido + botón descarga + botón "Reactivar".
- **Footer enlaces funcionales**: navegación con rutas absolutas + hash (`/planes#planes`, `/planes#faq`, `/historia`). `useScrollToHash` hook escucha `pathname + hash` y hace smooth scroll con offset -100px tras 500ms de timeout (para esperar transiciones de AnimatePresence).
- **Selector de Input ID**: dropdown con preset `950f6b77844e5a369bbeea208b2c428e` + opción "Personalizado" que muestra input libre. Estado `customInputId` controla si se muestra input editable o select.
- **Progreso de lecciones**: tabla `user_lesson_progress` con RLS estricto (cada usuario solo ve/edita su propio progreso). Auto-guardado cada 10s desde `LessonPlayer`. Regla del 90% para marcar completado. Modal de retomo si hay progreso >5s y no completado.
- **Nuevas páginas estáticas**: registrar en `routes.tsx` con `PageTransition` wrapper. Usar mismo patrón: Header + main + Footer, con enlace "Volver al inicio" y badge de sección.

---

## 12. Historial de cambios — 2026-05-15

### Fix: Upload de videos a Cloudflare Stream (CORS + TUS Protocol)

**Problema**: El upload usaba `XMLHttpRequest` + `FormData` contra `upload.cloudflarestream.com/{uid}`. Cloudflare Stream no habilita CORS para POST multipart/form-data desde navegadores. El preflight fallaba silenciosamente, el archivo nunca se subía, y Cloudflare mostraba "Video has no name" / "Pending Upload" para siempre. Además, fallaba por Content Too Large (413) y bloqueaba los videos requiriendo URLs firmadas.

**Solución**: Reemplazado el mecanismo de upload por **TUS protocol** usando `tus-js-client` (librería oficial que Cloudflare recomienda para uploads desde browser).

**Cambios técnicos:**
- `src/lib/api/stream/content.ts` — `uploadFileWithProgress()` reescrito con `tus.Upload`. Envía `filename` y `filetype` como metadata TUS. Configurado `chunkSize` a 50MB para evitar error 413. Eliminado `requireSignedURLs` para evitar 401 Unauthorized post-subida.
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

### 12.1 Historial de cambios â€” 2026-05-15 (SesiÃ³n 2)

#### Mejoras UI: Student Dashboard
- **Mockup de Portal de Pagos**: Se reemplazÃ³ el botÃ³n de pagos inactivo por un modal completo (Dialog de shadcn) que simula el Customer Portal de Stripe. 
- Muestra la fecha real del `current_period_end` (o simulada si estÃ¡ vacÃ­o), junto a una tarjeta predeterminada y opciones para gestionar la suscripciÃ³n.
- **Fix de OrtografÃ­a**: Restaurados los acentos y 'Ã±' en el archivo `StudentDashboard.tsx` que se habÃ­an perdido tras una conversiÃ³n de codificaciÃ³n (suscripciÃ³n, prÃ³ximo, aÃ±adir, etc).

#### RediseÃ±o: PÃ¡gina de Historia
- **Nueva Estructura**: Se reconstruyÃ³ `/historia` dividiendo el contenido en dos columnas. Izquierda con la historia del fundador, derecha con un contenedor *sticky* para el diferenciador. Textos provistos por el usuario integrados.
- **Fix de Cloudflare Stream (Layout Shift)**: Se eliminÃ³ el `responsive={true}` del componente `<Stream>` y se le aplicÃ³ `absolute inset-0 w-full h-full` dentro de un contenedor `aspect-video`. Esto evita que el SDK inyecte scripts de recÃ¡lculo que bugueaban o interrumpÃ­an el scroll del usuario.

#### Fix: Descarga de Grabaciones (Lives)
- **CorrecciÃ³n de URL Cloudflare**: El botÃ³n de descarga ahora apunta a `.../downloads/default.mp4` en lugar de la carpeta raÃ­z, previniendo el error `404 Not Found`.
- **Nuevo Endpoint (`/api/stream/download-status`)**: Creada una nueva Vercel Serverless Function para consultar el estado de renderizado del MP4 en tiempo real antes de descargarlo.
- **Feedback Interactivo**: Al hacer clic en descargar, un `toast` avisa si Cloudflare estÃ¡ empaquetando el video (`inprogress` con porcentaje), si aÃºn se estÃ¡ preparando (info), o abre la descarga directa si ya estÃ¡ `ready`.
- **Fallback Local**: Si el servidor Vercel local (`/api`) estÃ¡ apagado en dev, atrapa el error `502 Bad Gateway` y abre la URL de emergencia para no bloquear el flujo de desarrollo.

#### Contenido: FAQ
- AÃ±adida nueva pregunta a la secciÃ³n FAQ de `Plans.tsx` sobre la diferencia de Escuela de la Riqueza con otros programas de formaciÃ³n.

---

## 13. Historial de cambios — 2026-05-16

### Fix: Pantalla negra en Android vertical al entrar al live

**Problema**: en Android Chrome vertical, al entrar a `/vip-live` el iframe del player queda totalmente negro. Al rotar a horizontal, el video aparece. En desktop e iOS funciona normal.

**Causa raíz**: el iframe se cargaba con `?mode=webrtc&autoplay=true&preferLowLatency=true` **sin `muted=true`**. Chrome Android bloquea autoplay con audio cuando no hay gesto del usuario, y como encima del player hay un header con `pointer-events: none`, el usuario nunca podía disparar el gesto que destrabara la reproducción. Rotar a landscape disparaba un `resize` + reflow que en algunas builds de Chrome cuenta como interacción del sistema y desbloqueaba el play.

**Fix** (`src/pages/student/VIPLiveRoom.tsx`):
1. Estado nuevo `audioEnabled` (default `false`) + `iframeRef` + `streamPlayerRef`.
2. URL del iframe siempre arranca con `&muted=true&playsinline=true`. El `play()` se ejecuta sin pedir gesto.
3. Cargar el SDK de Cloudflare Stream globalmente (`https://embed.cloudflarestream.com/embed/sdk.latest.js`) en `useEffect`. En el `onLoad` del iframe se invoca `window.Stream(iframe)` y se guarda el player en `streamPlayerRef`.
4. Overlay premium con backdrop blur + botón dorado pulsante centrado sobre el player. Click en el overlay o el botón ejecuta `handleEnableAudio`: setea `player.muted = false`, `player.volume = 1`, y `player.play()`. **No hay remount del iframe** — el gesto del usuario se aplica directo a la sesión WebRTC ya establecida.
5. Visible en todos los dispositivos (Chrome desktop también bloquea autoplay-con-audio sin MEI score; rotar el botón a mobile-only generaría inconsistencias raras).

**Por qué el remount via `key` NO funcionaba (primer intento)**: al cambiar la `key` del iframe, React desmonta y vuelve a montar. Cloudflare establece una nueva conexión WebRTC (1-2s de negociación UDP). Para cuando el handshake termina y se intenta reproducir con audio, el "user activation context" de Chrome (~5s) ya expiró. El SDK soluciona esto porque la conexión ya está activa: solo se togglea la propiedad `muted` del player vivo, sin reload ni handshake.

### 13.1 Pendientes de optimización del live (NO atacados aún)

#### 13.1.1 Latencia real es ~10s aunque el modo es WebRTC

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

#### 13.1.2 ¿Por qué el live "siempre" está en low latency?

No es un bug, es la URL hardcodeada. Cloudflare Stream tiene tres modos de playback:

| Modo | Latencia | URL param |
|---|---|---|
| HLS estándar | 10-30s | sin `mode` ni `preferLowLatency` |
| LL-HLS | 2-5s | `?preferLowLatency=true` |
| WebRTC | <1s (si la ingesta también es WebRTC) | `?mode=webrtc` |

`VIPLiveRoom.tsx` siempre pide WebRTC + LLHLS. Si en algún momento se quisiera priorizar **estabilidad sobre latencia** (por ejemplo, para redes corporativas/móviles malas que bloquean UDP), habría que sacar ambos params y caer a HLS clásico. **No es necesario hoy**: WebRTC con fallback automático de Cloudflare ya cubre el caso de UDP bloqueado degradando a LL-HLS.
