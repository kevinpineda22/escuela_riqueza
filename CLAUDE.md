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
| Lenguaje | TypeScript | ❌ pendiente migración |
| Routing | React Router DOM 7 | ✅ instalado |
| Estilos | Tailwind CSS 4 (`@tailwindcss/vite`) | ✅ instalado |
| UI primitives | shadcn/ui | ❌ pendiente |
| Iconos | lucide-react | ✅ instalado |
| Forms + validación | react-hook-form + zod | ❌ pendiente |
| State cliente | zustand (mínimo) | ❌ pendiente |
| Server state | @tanstack/react-query | ❌ pendiente |
| Auth + DB + Realtime + Storage | Supabase | ❌ pendiente |
| VOD + Live | Cloudflare Stream | ❌ pendiente |
| Storage de recursos (PDFs) | Cloudflare R2 | ❌ pendiente |
| Pagos | Stripe (Subscriptions) | ❌ pendiente |
| Backend mínimo | Vercel Serverless Functions (`/api/*.ts`) | ❌ pendiente |
| SEO landing | vite-prerender-plugin | ❌ pendiente |
| Tests | Vitest + @testing-library/react | ❌ pendiente |
| Deploy | Vercel | ❌ pendiente |

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

## 10. Estado del proyecto (Actualizado)

**Implementado recientemente (Real Supabase + Cloudflare)**:
- **Gestión de Contenido (Admin)**: `AdminContentManager.tsx` migrado a CRUD real con Supabase. Soporta creación, edición, eliminación de Módulos y Lecciones.
- **Upload a Cloudflare Stream**: Implementado mediante Vercel Serverless Functions (`/api/stream/upload-url.ts`) para firmar la URL de subida y hacer fetch con FormData desde el cliente de manera segura sin exponer tokens.
- **Lógica de Planes (Arrays)**: Se migró la columna `required_plan` (string) a `allowed_plans` (array de strings) en las tablas `modules`, `lessons` y `lives` para soportar acceso múltiple a un mismo contenido usando checkboxes.
- **Filtrado para Alumnos**: `Dashboard.tsx` ahora filtra estrictamente los módulos y lecciones comparando `user.plan` contra el array `allowed_plans`. Usuarios *Free* no ven contenido *VIP* o *Individual*.
- **Publicidad Nativa (Plan Free)**: `LessonPlayer.tsx` reescrito con lógica profesional de pre-roll. Usa el componente nativo `<Stream>` de Cloudflare bloqueando controles y clics (pointer-events-none), cuenta con *pillarboxing* real (objectFit contain), botón de omitir a los 30s, e inicia la lección *solo* tras omitir/terminar el anuncio para cumplir con reglas de autoplay del navegador.
- **Gestor de Eventos en Vivo (Admin)**: `AdminLiveManager.tsx` convertido a CRUD funcional. Soporta listar, crear y eliminar salas. Permite asignar accesos (allowed_plans) e incluye un botón maestro "Forzar EN VIVO" que controla la columna `is_active` (forzando apagado en las demás salas).
- **Flujo de Lives**: Preparado para Cloudflare Live Inputs. El admin pega el *Live Input ID* y usa OBS Studio (vía RTMP+Key) para transmitir.

**Próximos pasos sugeridos** (en orden):
1. Auth real: reemplazar `Login.jsx` mock con `supabase.auth.signInWithPassword`. (Pendiente)
2. Setup shadcn/ui + react-hook-form + zod. (Pendiente)
3. Reproducción protegida (`/api/stream/playback-token.ts`) para evitar descargas o compartición de URLs en los planes premium.
4. Stripe Subscriptions + webhook `/api/stripe/webhook.ts` para cambiar el rol/plan automáticamente al pagar.
5. Prerender de la landing.

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
