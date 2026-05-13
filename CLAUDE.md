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
| UI primitives | shadcn/ui (Radix + button, sheet, select, dropdown, accordion, tooltip) | ✅ instalado |
| Animaciones | motion (Framer Motion v12) + Lenis (smooth scroll desktop) | ✅ instalado |
| Iconos | lucide-react | ✅ instalado |
| Forms + validación | react-hook-form + zod (v4) | ✅ instalado |
| State cliente | zustand (auth.store, preferences.store) | ✅ instalado |
| Server state | @tanstack/react-query | ✅ instalado |
| Auth + DB + Realtime + Storage | Supabase | ✅ integrado (auth real, RLS, realtime chat) |
| VOD + Live | Cloudflare Stream | ✅ integrado (upload directo + Live Inputs) |
| Storage de recursos (PDFs) | Cloudflare R2 | ❌ pendiente |
| Pagos | Stripe (Subscriptions) | ❌ pendiente (mock plan en perfil) |
| Backend mínimo | Vercel Serverless Functions (`/api/*.ts`) | 🟡 parcial (`/api/stream/upload-url.ts`) |
| SEO landing | vite-prerender-plugin | ❌ pendiente |
| Tests | Vitest + @testing-library/react | ✅ configurado (sin cobertura aún) |
| Deploy | Vercel | ✅ deployando |

> **No hay backend Express standalone.** El "backend" es: Supabase (auth/DB/realtime) + Cloudflare (video/storage) + Stripe (pagos) + un puñado de Vercel Functions para firmar URLs y recibir webhooks.

---

## 3. Estructura objetivo

```
escuela_riqueza/
├── api/                          # Vercel Serverless Functions
│   ├── stream/
│   │   ├── upload-url.ts         # Firma URL de upload directo a Cloudflare Stream
│   │   └── playback-token.ts     # Firma token de reproducción para video VIP
│   └── stripe/
│       ├── checkout.ts           # Crea sesión de checkout
│       └── webhook.ts            # Recibe eventos Stripe, actualiza Supabase
├── public/                       # Assets estáticos
├── src/
│   ├── main.tsx
│   ├── App.tsx
│   ├── routes.tsx                # Definición central de rutas + guards
│   ├── lib/
│   │   ├── supabase.ts           # Cliente Supabase tipado
│   │   ├── stripe.ts             # Helpers cliente
│   │   ├── stream.ts             # Helpers Cloudflare Stream
│   │   └── env.ts                # Validación de env vars con zod
│   ├── types/
│   │   └── database.ts           # Tipos generados desde Supabase (`supabase gen types`)
│   ├── hooks/
│   │   ├── useAuth.ts
│   │   ├── useSubscription.ts
│   │   └── useRequireRole.ts
│   ├── components/
│   │   ├── ui/                   # shadcn/ui primitives (button, dialog, table…)
│   │   ├── layout/               # Header, Footer, Sidebar
│   │   └── feature/              # Componentes de dominio (LessonPlayer, LiveChat…)
│   ├── pages/
│   │   ├── public/               # LandingPage, Login, Signup
│   │   ├── student/              # Dashboard, LessonViewer, VIPLiveRoom
│   │   └── admin/                # AdminDashboard, AdminVideoUpload, AdminLives, AdminUsers
│   └── features/                 # Lógica de dominio agrupada
│       ├── auth/
│       ├── courses/
│       ├── lives/
│       ├── billing/
│       └── admin/
├── docs/
│   └── ARCHITECTURE.md
├── env.example                   # Plantilla — copiar a .env.local
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
npm run typecheck    # tsc --noEmit (a configurar)
npm run test         # vitest (a configurar)
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

## 10. Estado del proyecto (Actualizado 2026-05-11)

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
- `player.store.ts`: store Zustand con `persist`. Persiste: `track`, `isPodcastMode`, `volume`, `lastKnownTime`, `lastVideoId`. NO persiste: `isPlaying` (para respetar autoplay policies del navegador al recargar).
- `LessonViewer.tsx`: modo podcast + notas + playlist por módulo.
- Lógica de planes: columna `allowed_plans` (array) en `modules`, `lessons`, `lives`. Filtrado estricto en `StudentDashboard.tsx` por `user.plan`.

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

### 10.2 Funcionalidad pendiente (la trabaja el compañero de equipo)
- `/api/stream/playback-token.ts` — token firmado para reproducir VOD premium sin que se filtre la URL.
- `/api/stripe/checkout.ts` + `/api/stripe/webhook.ts` — sincronización de plan vía suscripciones.
- Tabla `subscriptions` real (hoy el plan vive en `users.plan` mock).
- Generación de tipos `src/types/database.ts` con `supabase gen types`.
- Cloudflare R2 para PDFs / recursos descargables.

### 10.3 Estado visual por panel (100% frontend — owner del proyecto)

**🟢 PREMIUM (funcional y con buen diseño)**
- `LandingPage.tsx` y todos sus actos (`HeroCinematic`, `AwakeningAct`, `IntelligencesAct`, `PathAct`, `PlansAct`).
- `AuthPage.tsx` (signin/signup/forgot) y `ResetPassword.tsx`.
- `NotFound.tsx` (404 cinemático), `ErrorBoundary` (UI premium con retry), `AuthSplash` (logo halo + ring).
- `AdminLayout.tsx` y `AdminVideoUpload.tsx`.
- `AdminMetrics.tsx`, `AdminUsers.tsx`, `AdminSettings.tsx` (Fase 3 completada con recharts y mocks).
- `StudentDashboard.tsx` (Fase 4 parcial: rediseño UX mobile-first, grid de módulos, drill-down, transiciones AnimatePresence).
- `VIPLiveRoom.tsx` (flujo completo: countdown → intro cinemática → WebRTC <1s + chat real).
- `AdminLiveManager.tsx` (CRUD completo con schema real, drag-drop imagen, timezone Colombia, guía OBS + WebRTC).

**🟡 DECENT (gold/dark aplicado pero falta polish)**
- `Header.tsx` — falta: menú mobile funcional (botón existe pero no abre nada).
- `Footer.tsx` — falta: gradient sutil, separador animado, vida visual.
- `AdminContentManager.tsx` — falta: skeleton, focus-state animado, depth en upload zone.
- `LessonPlayer.tsx` — falta: skeleton al cargar metadata, skin custom sobre `<Stream>`.
- `GlobalPodcastPlayer.tsx` — falta: thumb del slider custom, pulse en barras, expand/collapse mobile.
- `LiveChat.tsx` — mensajes sin entrance, input plano, sin skeleton, sin "está escribiendo".

**🔴 BASIC / MISSING (placeholder o sin identidad)**
- `LessonViewer.tsx` — playlist sin animación, modal upgrade plano, sin empty states.

**⚫ Pantallas que aún no existen**
- "Cuenta verificada / Email confirmado" post-signup (Supabase email link).
- Detalle de usuario en admin (drill-down desde `AdminUsers`).
- Página pública `/planes` (hoy solo el acto del landing).

### 10.4 Sistemas transversales

**✅ Construidos (Fase 1 + Fase 2)**
- **Toaster global** — `src/components/ui/toaster.tsx` (sonner + brand). API: `import { toast } from "@/components/ui/toaster"`.
- **Skeleton primitives** — `src/components/ui/skeleton.tsx` con variantes `rect` / `circle` / `text` + `SkeletonText` (multiline) + `SkeletonCard` (compose). Shimmer dorado.
- **EmptyState** — `src/components/ui/empty-state.tsx` con icono lucide, halo gold, float infinito, action slot.
- **AuthSplash** — `src/components/feature/AuthSplash.tsx` (logo + halo + ring + mensaje).
- **AuthBootstrap provider** — `src/components/providers/AuthBootstrap.tsx`. En boot revalida sesión Supabase y refresca el store (loop fixeado usando `onAuthStateChange`).
- **ErrorBoundary** — `src/components/layout/ErrorBoundary.tsx` (clase + fallback default premium o custom).
- **404 catch-all** — ruta `path="*"` → `NotFound.tsx`.
- **Tests** — 11 (Skeleton + EmptyState) + 4 (ErrorBoundary) = 15/15 ✅.

**❌ Pendientes**
1. **Page transitions** — wrapper con `AnimatePresence` por route para fade/slide entre pantallas (Fase Cierre).
2. **Modal/Dialog premium** — backdrop blur + scale-in en lugar de radix defaults (Fase Cierre).
3. **Custom Stream player skin** — wrapper sobre `<Stream>` (solo para VOD, ya no para lives).

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

**🔜 Fase Cierre — Transitions globales + Modal premium**
- Wrapper con `AnimatePresence` en `routes.tsx` para fade/slide entre rutas.
- Wrapper sobre `Dialog` (radix) con backdrop blur + scale-in para reemplazar los defaults en toda la app.

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

### 10.10 Reglas operativas para retomar

- Después de cada módulo terminado: correr `npm run typecheck` + `npx vitest run <files>` antes de cerrar la tarea.
- Mantener el inventario de tareas vivo (`TaskCreate`/`TaskUpdate`) en cada sesión nueva.
- Cualquier nuevo primitivo va a `src/components/ui/` con un test al lado (`*.test.tsx`).
- No volver a meter keyframes CSS en `tailwind.config.js`: las animaciones se hacen con Framer Motion.
- Toda toast del proyecto entra por `import { toast } from "@/components/ui/toaster"` — NO importar sonner directo.

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
