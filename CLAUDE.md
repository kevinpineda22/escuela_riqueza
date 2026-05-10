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
- Iván desde el panel admin crea un live → llamada a Cloudflare Stream Live (key RTMP).
- Iván emite desde OBS apuntando al RTMP de Cloudflare.
- Plataforma muestra el live embebido al rol `vip`.
- Chat en `Supabase Realtime` (canal `live:{liveId}`) — broadcast con tabla `live_messages` y RLS por suscripción.

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

## 10. Estado del proyecto (Actualizado 2026-05-10)

### 10.1 Funcionalidad implementada

**Auth (real, Supabase)**
- `AuthPage.tsx` unificado: 3 modos en la misma shell — `signin` / `signup` / `forgot`. Sin navegar entre rutas.
- Mecánica desktop: card 860×560 con dos formularios siempre montados + overlay dorado deslizante con Framer Motion. Mobile: tabs + crossfade.
- `forgot` se trata como `signin` para el overlay (queda a la derecha). El submit muestra estado "Revisa tu correo".
- Rutas: `/login`, `/registro`, `/recuperar-contrasena`, `/restablecer-contrasena` (esta última sigue como `ResetPassword.tsx` standalone para honrar el deep-link del email).
- Supabase Auth + RLS por plan. `useAuth` hook + `useAuthStore` (zustand).

**Contenido y reproducción**
- `AdminContentManager.tsx`: CRUD real de módulos y lecciones contra Supabase.
- `AdminVideoUpload.tsx`: drag & drop a Cloudflare Stream vía `/api/stream/upload-url.ts` (Vercel Function que firma el upload directo).
- `LessonPlayer.tsx`: pre-roll con `<Stream>` de Cloudflare, pillarboxing real, skip a los 30s, autoplay-friendly.
- `LessonViewer.tsx`: modo podcast + notas + playlist por módulo.
- Lógica de planes: columna `allowed_plans` (array) en `modules`, `lessons`, `lives`. Filtrado estricto en `StudentDashboard.tsx` por `user.plan`.

**Lives**
- `AdminLiveManager.tsx`: CRUD de salas, asignación de planes, botón "Forzar EN VIVO" (mutex en columna `is_active`).
- `VIPLiveRoom.tsx`: countdown + reproductor + chat realtime (Supabase Realtime channel `live:{liveId}`).
- `LiveChat.tsx`: chat funcional con scroll y broadcast en tiempo real.

**Admin shell**
- `AdminLayout.tsx`: sidebar premium con shimmer en item activo, profile card, mouse-tracking glow, animated orbs en fondo. Sheet en mobile.

**Animación / preferencias**
- `MotionProvider.tsx`: envuelve la app en `MotionConfig`, controla Lenis en desktop, respeta `prefers-reduced-motion` y el toggle global del usuario.
- `AnimationToggle.tsx`: control persistido en `preferences.store` (zustand).

### 10.2 Funcionalidad pendiente (la trabaja el compañero de equipo)
- `/api/stream/playback-token.ts` — token firmado para reproducir VOD premium sin que se filtre la URL.
- `/api/stripe/checkout.ts` + `/api/stripe/webhook.ts` — sincronización de plan vía suscripciones.
- Tabla `subscriptions` real (hoy el plan vive en `users.plan` mock).
- Generación de tipos `src/types/database.ts` con `supabase gen types`.
- Cloudflare R2 para PDFs / recursos descargables.
- Métricas / users / settings en admin (hoy son placeholders "coming soon").

### 10.3 Estado visual por panel (100% frontend — owner del proyecto)

**🟢 PREMIUM (no requieren trabajo de estilo)**
- `LandingPage.tsx` y todos sus actos (`HeroCinematic`, `AwakeningAct`, `IntelligencesAct`, `PathAct`, `PlansAct`).
- `AuthPage.tsx` (signin/signup/forgot) y `ResetPassword.tsx`.
- `NotFound.tsx` (404 cinemático), `ErrorBoundary` (UI premium con retry), `AuthSplash` (logo halo + ring).
- `AdminLayout.tsx` y `AdminVideoUpload.tsx`.
- `AdminMetrics.tsx`, `AdminUsers.tsx`, `AdminSettings.tsx` (Fase 3 completada con recharts y mocks).
- `StudentDashboard.tsx` (Fase 4 parcial: rediseño UX mobile-first, grid de módulos, drill-down, transiciones AnimatePresence).

**🟡 DECENT (gold/dark aplicado pero falta polish)**
- `VIPLiveRoom.tsx` — falta: transición cinemática countdown → live, parallax bg, chat con diseño.
- `Header.tsx` — falta: menú mobile funcional (botón existe pero no abre nada).
- `Footer.tsx` — falta: gradient sutil, separador animado, vida visual.
- `AdminContentManager.tsx` — falta: skeleton, focus-state animado, depth en upload zone.
- `AdminLiveManager.tsx` — falta: fade-in en preview imagen, depth en form, skeleton.
- `LessonPlayer.tsx` — falta: skeleton al cargar metadata, skin custom sobre `<Stream>`.
- `GlobalPodcastPlayer.tsx` — falta: thumb del slider custom, pulse en barras, expand/collapse mobile.

**🔴 BASIC / MISSING (placeholder o sin identidad)**
- `LessonViewer.tsx` — playlist sin animación, modal upgrade plano, sin empty states.
- `LiveChat.tsx` — mensajes sin entrance, input plano, sin skeleton, sin "está escribiendo".

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
2. **Custom Stream player skin** — wrapper sobre `<Stream>` con controles dorados (Fase 5).
3. **Modal/Dialog premium** — backdrop blur + scale-in en lugar de radix defaults (Fase Cierre).

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
- ⏳ `VIPLiveRoom.tsx` + `LiveChat.tsx`: transición cinemática countdown → live, parallax bg, rediseñar LiveChat.
- ⏳ `LessonViewer.tsx`: playlist animada, modal upgrade premium, empty states con `<EmptyState/>`.
- ⏳ `Header.tsx`: menú mobile funcional usando `<Sheet>` ya disponible.
- ⏳ `Footer.tsx`: gradient sutil + separador animado.

**🔜 Fase 5 — Player + Admin polish**
- Custom skin sobre `<Stream>` (Cloudflare) con controles dorados — para `LessonPlayer` y `VIPLiveRoom`.
- Pulir `GlobalPodcastPlayer` (thumb slider custom, pulse en barras durante playback, expand/collapse mobile).
- Pulir `AdminContentManager` y `AdminLiveManager` (skeleton, focus animado, depth en upload zones, fade-in preview imagen).

**🔜 Fase Cierre — Transitions globales + Modal premium**
- Wrapper con `AnimatePresence` en `routes.tsx` para fade/slide entre rutas.
- Wrapper sobre `Dialog` (radix) con backdrop blur + scale-in para reemplazar los defaults en toda la app.

### 10.6 Reglas operativas para retomar
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
