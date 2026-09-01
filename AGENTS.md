# AGENTS.md — Escuela de la Riqueza

> Plataforma educativa con planes Free / Individual / VIP para Iván Mazo.
> Landing pública + área de alumnos + lives en vivo + panel admin self-service.

> **Contexto extendido (cargar bajo demanda):**
> - Estado actual del proyecto, paneles, sistemas transversales y fases: `@docs/PROJECT_STATE.md`
> - Arquitectura del Modo Podcast (crítico — leer antes de tocar `PodcastEngine`, `LessonPlayer` o `player.store`): `@docs/PODCAST_ARCHITECTURE.md`
> - Historial cronológico de cambios: `@docs/CHANGELOG.md`

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
│   ├── _lib/
│   │   ├── auth.ts               # requireAuth, requireAdmin, applyCors
│   │   └── ratelimit.ts          # applyRateLimit con Upstash (fail-open si no hay env)
│   ├── stream/
│   │   ├── upload-url.ts         # Firma URL de upload directo a Cloudflare Stream (admin)
│   │   ├── live-input-status.ts  # Consulta estado del Live Input — OBS conectado? (any auth)
│   │   ├── recording.ts          # Obtiene grabación de un Live Input finalizado (admin)
│   │   └── download-status.ts    # Estado del MP4 download de una grabación (admin)
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
│   │       ├── client.ts         # ApiError + authedFetch (prepend JWT al header)
│   │       ├── auth.ts           # signIn, signUp, signOut, getCurrentUser reales
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
│   │   └── user.ts               # Plan, UserRole, User
│   ├── stores/                   # Zustand stores con persist
│   │   ├── auth.store.ts         # Sesión del usuario
│   │   ├── player.store.ts       # Modo podcast (track, isPlaying, volumen)
│   │   └── preferences.store.ts  # Animaciones toggle
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
│       ├── public/               # LandingPage, AuthPage, ResetPassword, EmailConfirmed, Plans, HistoryPage, TermsPage, PrivacyPage, ModulePreview, NotFound
│       ├── student/              # StudentDashboard, LessonViewer, VIPLiveRoom
│       └── admin/                # AdminMetrics, AdminContentManager, AdminLiveManager, AdminUsers, AdminUserDetail, AdminSettings
├── test/                         # Setup vitest
├── docs/
│   ├── ARCHITECTURE.md
│   ├── CHANGELOG.md               # Historial cronológico
│   ├── PROJECT_STATE.md           # Estado actual e inventario
│   ├── PODCAST_ARCHITECTURE.md    # Arquitectura del modo podcast (crítico)
│   ├── RECORDINGS_ARCHITECTURE.md # Archivado de grabaciones a R2 (crítico)
│   └── RESPONSIVE_AUDIT.md        # Auditoría responsive
├── sql/                           # Esquema de BD (Supabase, manual). Ver sql/README.md
├── scripts/                       # Scripts de mantenimiento (ej: configure-live-input.mjs)
├── worker/                        # Cloudflare Worker: archivado de grabaciones a R2
├── AGENTS.md
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

**Env vars server-side actuales** (configurar en Vercel dashboard):
| Variable | Para qué |
|---|---|
| `CLOUDFLARE_ACCOUNT_ID` | Cuenta Cloudflare para Stream API |
| `CLOUDFLARE_STREAM_API_TOKEN` | Token con permisos `Stream:Edit` |
| `ALLOWED_ORIGINS` | Allowlist CORS (comma-separated). Ej: `https://escuela-riqueza.vercel.app` |
| `UPSTASH_REDIS_REST_URL` | URL del Redis de Upstash para rate limit (tier gratis 10k cmds/día) |
| `UPSTASH_REDIS_REST_TOKEN` | Token del Redis de Upstash. Sin estas dos, el rate limit falla-abierto (no bloquea) |
| `SUPABASE_URL` *(opcional)* | Fallback a `VITE_SUPABASE_URL` si no está |
| `SUPABASE_ANON_KEY` *(opcional)* | Fallback a `VITE_SUPABASE_ANON_KEY`. Helper de auth respeta RLS, no requiere service role |
| `SUPABASE_SERVICE_ROLE_KEY` | **Solo** para `/api/stream/cloudflare-webhook.ts` (server-to-server, bypass RLS). NUNCA exponer al cliente |
| `CLOUDFLARE_WEBHOOK_SECRET` | Secret HMAC compartido con Cloudflare Stream para validar firma de webhooks de Live Inputs |

---

## 7. Patrones por feature

### 7.1 Auth con Supabase
- Cliente: `src/lib/supabase.ts` exporta `supabase` (singleton).
- Hook `useAuth()` envuelve `supabase.auth` y expone `user`, `session`, `signIn`, `signOut`, `loading`.
- Guard de ruta: componente `<RequireAuth>` y `<RequireRole role="admin">` que redirigen a `/login`.
- Plan del usuario se lee desde tabla `subscriptions` (no del JWT) — actualizada por webhook Stripe.

### 7.2 Subida de videos (admin)
1. Admin selecciona archivo en UI.
2. Cliente llama `POST /api/stream/upload-url` vía `authedFetch` (que prepend `Authorization: Bearer ${jwt}` desde la sesión de Supabase).
3. La Function ejecuta `requireAdmin(req, res)` — valida JWT contra Supabase, lee `profiles.role`, exige `'admin'`. Sino 401/403.
4. La Function valida body con `zod` (`size` int positivo max 5GB, `name` opcional max 200 chars).
5. La Function pide a Cloudflare Stream una "Direct Creator Upload URL" y la devuelve firmada.
6. Cliente sube el archivo directo a Cloudflare vía **TUS protocol** (`tus-js-client`) con chunks de 50MB. NO pasa por nuestro server.
7. Webhook de Cloudflare Stream avisa cuando el video terminó de procesar → guarda `stream_uid` en tabla `lessons`.

### 7.3 Reproducción protegida
- Para videos premium: cliente pide token a `POST /api/stream/playback-token` con `lesson_id`.
- Function chequea suscripción activa del usuario en Supabase, firma token de Cloudflare Stream con expiración corta (~5 min).
- Reproductor (`<Stream>` de `@cloudflare/stream-react`) consume el token.

### 7.4 Lives en vivo
- Iván desde el panel admin crea una sala (`AdminLiveManager`) con título, `starts_at`, `stream_live_input_id`, `background_image_url` y `allowed_plans`.
- Tabla `lives`: `id, title, description, starts_at (NOT NULL), duration_minutes, stream_live_input_id, required_plan, status (scheduled/live/ended), background_image_url, allowed_plans (text[]), is_active, recording_stream_uid, created_at`.
- Iván emite desde OBS apuntando al RTMP de Cloudflare (servidor `rtmps://live.cloudflare.com:443/live/`, clave = Input ID).
- **Reproducción**: en `VIPLiveRoom` se usa `<Stream>` de `@cloudflare/stream-react` (HLS estándar, latencia 5-10s). El iframe raw + SDK manual fue removido por causar `removeChild` errors en móviles — ver CHANGELOG 2026-05-16.
- Solo una sala `is_active = true` a la vez. Admin la elige con botón Activar/Inactivar.
- VIP ve countdown desde `starts_at` → intro cinemática → player.
- Auto-detección de OBS via `/api/stream/live-input-status` (polling 10s antes de starts_at) **+ webhook server-to-server** (ver abajo).
- Polling 3s como fallback de Realtime.
- Chat en `Supabase Realtime` (canal `live:{liveId}`) — broadcast con tabla `live_messages` y RLS por suscripción.
- Para baja latencia: OBS en CBR, keyframe 1s, 30fps. Para <1s real se requiere migrar OBS a WHIP (pendiente, ver CHANGELOG 2026-05-16).

#### 7.4.1 Webhook de Cloudflare Stream (sync OBS ↔ panel)

Endpoint `/api/stream/cloudflare-webhook.ts` recibe eventos de Cloudflare Stream Live Inputs y actualiza la tabla `lives` sin necesidad de polling. Funciona en cualquier entorno (DEV polling se apaga, webhook NO).

**Comportamiento:**
- `live_input.connected` → si hay sala `is_active=true` con ese `stream_live_input_id` en `scheduled`, pasa automáticamente a `status='live'`.
- `live_input.disconnected` → marca `is_paused=true` (NO finaliza; finalizar es decisión manual del admin para evitar perder la sesión por microcortes de OBS).
- `video.ready` con `liveInput` set → vincula `recording_stream_uid` a la sala correspondiente (solo si está vacío, no sobreescribe).

**Seguridad:**
- Valida firma HMAC-SHA256 con `CLOUDFLARE_WEBHOOK_SECRET`. Header `Webhook-Signature: time=<ts>,sig1=<hex>`. Rechaza eventos con `time` fuera de ±5 min (anti-replay).
- Body parser de Vercel está deshabilitado (`export const config = { api: { bodyParser: false } }`) para acceder al raw body — necesario para HMAC.
- Usa `SUPABASE_SERVICE_ROLE_KEY` para bypass RLS (el webhook no tiene contexto de usuario). **Nunca exponer esta key al cliente.**

**Setup en Cloudflare Dashboard:**
1. Stream → Live Inputs → seleccionar el Live Input (`950f6b77...` o el que use Iván).
2. Edit → "Webhook URL": `https://<dominio-vercel>/api/stream/cloudflare-webhook`.
3. Click en "Generate signing key" — copiar el secret a `CLOUDFLARE_WEBHOOK_SECRET` en Vercel envs.
4. (Opcional) Stream → Webhooks (notificación global) → mismo URL, mismo secret, para que también dispare `video.ready` cuando termina de procesar la grabación.

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
3. **Toda Vercel Function nueva** debe usar `requireAuth` o `requireAdmin` de `api/_lib/auth.ts` ANTES de tocar cualquier servicio externo. Patrón: `const user = await requireAdmin(req, res); if (!user) return;` arriba de todo (después del CORS).
4. **Toda Vercel Function** valida el body con `zod` antes de usarlo (`safeParse` → 400 con `issues` si falla).
5. **CORS por allowlist**: usar `applyCors(req, res)` al inicio del handler. Nunca usar `Access-Control-Allow-Origin: *`. El allowlist se configura en env `ALLOWED_ORIGINS` (separada por comas).
6. **Rate limit**: usar `applyRateLimit(req, res, user.id, { requests, window, prefix })` de `api/_lib/ratelimit.ts` después del auth. Cada endpoint con su propio `prefix` para no compartir bucket.
7. **Frontend llama Vercel Functions vía `authedFetch`** (`@/lib/api/client`), nunca con `fetch()` crudo. Esto garantiza que el JWT viaja en el header.
8. **Webhooks** validan firma (`stripe.webhooks.constructEvent`).
9. **No commitear** `.env.local`, `.env`, claves, ni archivos de Supabase generados con datos reales.
10. **Headers de seguridad** en `vercel.json` (X-Frame-Options DENY, nosniff, HSTS, etc.) — no remover sin entender por qué están.

---

## 9. Estilo de código (auto-resuelto desde skill registry)

- **react-19**: sin `useMemo`/`useCallback` salvo necesidad real (React Compiler optimiza).
- **typescript**: `strict: true`, sin `any`, `interface` para props.
- **tailwind-4**: `cn()` helper, sin `var()` en `className`, theme variables en config.
- **zod-4**: schemas como single source of truth, `z.infer<>` para tipos.
- **react-hook-form**: con `zodResolver` para validación.

---

## 10. Reglas operativas

- Después de cada módulo terminado: correr `npm run typecheck` + `npx vitest run <files>` antes de cerrar la tarea.
- Mantener el inventario de tareas vivo (`TaskCreate`/`TaskUpdate`) en cada sesión nueva.
- Cualquier nuevo primitivo va a `src/components/ui/` con un test al lado (`*.test.tsx`).
- No volver a meter keyframes CSS en `tailwind.config.js`: las animaciones se hacen con Framer Motion.
- Toda toast del proyecto entra por `import { toast } from "@/components/ui/toaster"` — NO importar sonner directo.
- Cualquier cambio de contenido relevante (feature nueva, fix de bug no trivial, migración SQL) se documenta en `docs/CHANGELOG.md` con fecha. El estado vivo va a `docs/PROJECT_STATE.md`.

---

## 11. Reglas para Codex / agentes en este repo

- Match del idioma del usuario (español rioplatense voseo si responde así, inglés si no).
- Respuestas cortas. No options menus salvo bifurcación real.
- **Nunca** agregar features ni refactors fuera del scope pedido.
- **Nunca** crear archivos `.md` extra sin pedido explícito.
- **Nunca** correr `npm run build` para verificar.
- Antes de tocar tabla nueva en Supabase: verificar que tiene RLS.
- Antes de exponer un endpoint: verificar que valida JWT y rol.
- Conservar la paleta gold/dark — el diseño actual es del cliente.
- **Antes de tocar `PodcastEngine`, `GlobalPodcastPlayer`, `LessonPlayer` o `player.store`**: leer `@docs/PODCAST_ARCHITECTURE.md`. Es el feature más frágil del repo.
- **SPA en Vercel**: cualquier ruta que no sea `/` requiere `vercel.json` con `rewrites: [{ "source": "/(.*)", "destination": "/index.html" }]`. Sin esto, recargar cualquier página devuelve 404. También afecta links con `<a href>` (navegación dura).
- **Grabaciones de lives**: columna `recording_stream_uid` en tabla `lives`. Al "Finalizar" se intenta vincular automáticamente desde Cloudflare via `/api/stream/recording.ts`. Pestaña "Finalizados" muestra iframe + descarga + Reactivar.
- **Footer enlaces funcionales**: navegación con rutas absolutas + hash (`/planes#planes`, `/planes#faq`, `/historia`). `useScrollToHash` hook escucha `pathname + hash` y hace smooth scroll con offset -100px tras 500ms (esperar AnimatePresence).
- **Selector de Input ID**: dropdown con preset `950f6b77844e5a369bbeea208b2c428e` + opción "Personalizado" (input libre). Estado `customInputId` controla el modo.
- **Progreso de lecciones**: tabla `user_lesson_progress` con RLS estricto (cada user solo su progreso). Auto-guardado cada 10s desde `LessonPlayer` Y `PodcastEngine`. Regla 90% para completado. Modal de retomo si progress >5s y no completado.
- **Nuevas páginas estáticas**: registrar en `routes.tsx` con `PageTransition` wrapper. Patrón: Header + main + Footer, con "Volver al inicio" y badge de sección.
