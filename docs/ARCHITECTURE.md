# Arquitectura — Escuela de la Riqueza

Documento de referencia técnica para entender cómo encajan las piezas. Para convenciones de código y comandos del día a día, ver `CLAUDE.md`.

---

## 1. Diagrama de alto nivel

```
                            ┌─────────────────┐
                            │   Vercel CDN    │
                            │  (HTML+JS+CSS)  │
                            └────────┬────────┘
                                     │
       ┌─────────────────────────────┼─────────────────────────────┐
       │                             │                             │
┌──────▼──────┐              ┌───────▼───────┐             ┌───────▼────────┐
│  Browser    │              │  Vercel       │             │  Cloudflare    │
│  (React SPA)│◄────────────►│  Functions    │             │  Stream + R2   │
└──┬──┬──┬────┘              │  (/api/*.ts)  │             └────────────────┘
   │  │  │                   └──────┬────────┘                      ▲
   │  │  │                          │                               │
   │  │  └─── Realtime WS ──┐       │                               │
   │  │                     │       │      (signed URLs)            │
   │  └─── Auth + queries ──┤       └───────────────────────────────┘
   │                        │
   │                        ▼
   │              ┌──────────────────┐         ┌──────────────────┐
   │              │  Supabase        │◄────────┤  Stripe          │
   │              │  (Postgres+RLS,  │ webhook │  (Subscriptions) │
   │              │   Auth, Realtime)│         └──────────────────┘
   │              └──────────────────┘
   │
   └─── Reproductor video ──► Cloudflare Stream (HLS + signed token)
```

---

## 2. Modelo de datos (Supabase)

### Tablas principales

```
profiles
├── id (uuid, PK, = auth.users.id)
├── full_name
├── avatar_url
├── role: 'student' | 'admin'
└── created_at

subscriptions
├── id
├── user_id → profiles.id
├── stripe_customer_id
├── stripe_subscription_id
├── plan: 'free' | 'individual' | 'vip'
├── status: 'active' | 'canceled' | 'past_due'
├── current_period_end
└── updated_at

modules
├── id, slug, title, description, order_index
└── icon, is_published

lessons
├── id, module_id → modules.id
├── slug, title, description, order_index
├── stream_uid (Cloudflare Stream)
├── duration_seconds, is_premium, is_published
└── created_at

lives
├── id, title, description
├── starts_at, duration_minutes
├── stream_live_input_id (Cloudflare)
├── required_plan: 'individual' | 'vip'
├── status: 'scheduled' | 'live' | 'ended'
└── created_at

live_messages
├── id, live_id → lives.id
├── user_id → profiles.id
├── content, created_at
└── (Realtime habilitado para INSERT)

resources                    # PDFs, descargables (R2)
├── id, lesson_id (nullable)
├── title, r2_key, mime_type, size_bytes
└── required_plan
```

### Políticas RLS (resumen)

| Tabla | SELECT | INSERT/UPDATE/DELETE |
|---|---|---|
| `profiles` | uid propio o admin | uid propio (campos limitados) o admin |
| `subscriptions` | uid propio o admin | solo service role (webhook Stripe) |
| `modules` | público (`is_published`) | admin |
| `lessons` | `is_premium=false` o suscripción activa con plan suficiente; admin todo | admin |
| `lives` | autenticado con plan suficiente; admin todo | admin |
| `live_messages` | autenticado con plan suficiente para ese live | autenticado con plan suficiente, INSERT |
| `resources` | mismas reglas que `lessons` | admin |

---

## 3. Flujos críticos

### 3.1 Onboarding de un usuario premium

1. Usuario clic en "Suscribirse" en `/` (landing).
2. Si no logueado → `/signup` (Supabase Auth, email + password o OAuth).
3. Tras login, frontend POSTea a `/api/stripe/checkout` con `priceId`.
4. Function crea Checkout Session de Stripe y devuelve URL.
5. Usuario completa pago en Stripe.
6. Stripe envía evento `customer.subscription.created` a `/api/stripe/webhook`.
7. Webhook valida firma, hace `upsert` en `subscriptions` (con `service_role_key`).
8. Usuario regresa a `/dashboard` — ya tiene plan activo (RLS lo deja entrar a contenido premium).

### 3.2 Iván sube una clase

1. Iván va a `/admin/lessons/new`, llena form (título, módulo, descripción), selecciona archivo MP4.
2. Cliente POST `/api/stream/upload-url` con `{ title, moduleId }` + JWT en header.
3. Function valida JWT con Supabase, chequea `role = 'admin'`.
4. Function llama a Cloudflare Stream API para "Direct Creator Upload" → recibe `uploadURL` + `uid`.
5. Function inserta fila en `lessons` con `stream_uid = uid`, `is_published = false`.
6. Function devuelve `{ uploadURL, lessonId }`.
7. Cliente sube el archivo directo con `tus-js-client` (resumable) → progreso en tiempo real.
8. Cuando termina, Cloudflare procesa el video. Webhook (opcional) o polling marca `is_published = true`.

### 3.3 Reproducción de lección premium

1. Estudiante navega a `/lecciones/{slug}`.
2. Cliente llama `GET /api/stream/playback-token?lessonId=xxx` con JWT.
3. Function valida JWT + chequea suscripción activa con plan suficiente.
4. Function pide a Cloudflare Stream un "Signed URL" con TTL de 5 min.
5. Cliente recibe `{ token }` y monta `<Stream src={token} />`.
6. Si el usuario no tiene plan, Function devuelve 403 → UI muestra paywall.

### 3.4 Live VIP en tiempo real

1. Iván desde `/admin/lives` crea un live → Function `POST /api/stream/lives` crea Live Input en Cloudflare → guarda RTMP key en DB.
2. Cuando llega la hora, Iván abre OBS, configura RTMP con la key, empieza a transmitir.
3. Cliente VIP entra a `/vip-live/{id}` — `<Stream src={liveInputUid} />` reproduce HLS.
4. Chat: cliente se suscribe al canal `realtime:public:live_messages:live_id=eq.{id}`.
5. Cada mensaje se inserta vía `supabase.from('live_messages').insert(...)` — RLS valida plan.
6. Otros clientes reciben el mensaje por broadcast en milisegundos.

---

## 4. Decisiones y tradeoffs

### Por qué Vite y no Next.js
- El dev domina React/Vite, no Next.js. Aprender Next en medio del proyecto produce código peor.
- SEO de la landing se resuelve con `vite-prerender-plugin` (HTML estático en build) — suficiente para una landing semi-estática.
- Server-side rendering no es necesario porque el resto de la app es post-login (no indexable de todas formas).

### Por qué Vercel Functions y no Express
- Supabase ya cubre auth/DB/realtime/storage. Express duplicaría infraestructura.
- Solo se necesitan 4-6 endpoints server-side (firmar URLs, webhooks). Functions serverless son ideales: cero servidor que mantener, escalan a cero.
- Sintaxis Node.js + handler con `req`/`res` — el dev se siente en casa.

### Por qué panel admin custom y no CMS headless
- Iván es no técnico pero el panel es muy específico (lives con RTMP, planes con Stripe, módulos con orden custom). Un CMS genérico (Sanity/Strapi) requiere configuración pesada y no maneja nativamente el flow de Cloudflare Stream + Stripe.
- Un panel custom con `shadcn/ui` + Supabase queries directas se hace en pocos días y queda perfectamente alineado al dominio.

### Por qué Cloudflare Stream y no S3 + reproductor propio
- Stream encodifica HLS automáticamente con múltiples bitrates.
- CDN global incluido, signed URLs nativas, soporte de live RTMP.
- Costo por minuto visto, no por almacenamiento — alineado con el uso real.

### Por qué Supabase Realtime y no Pusher / Ably
- Ya es parte de Supabase, sin tooling adicional.
- Suficiente para chats de lives (no esperamos miles de mensajes/segundo).
- Si en el futuro escala mal, migrar a Pusher es localizado a un módulo.

---

## 5. Limitaciones conocidas

- **Cloudflare Stream Live es unidireccional** (RTMP push de Iván → HLS pull de los viewers). Iván **NO** ve a los participantes en cámara. Si en el futuro se necesita interacción cara-a-cara con los VIP → migrar a Daily.co o LiveKit (es más caro, más complejo).
- **Anuncios cada 120s del plan Free**: la lógica actual está en cliente (`LessonPlayer.jsx`). Es saltable. Si los anunciantes pagan por impresiones reales, hay que mover la inserción a server-side ad insertion (SSAI) en Cloudflare.
- **Certificados digitales**: prometidos en plan Individual pero no implementados — definir alcance antes del MVP.

---

## 6. Roadmap MVP sugerido

| Sprint | Entregable |
|---|---|
| 1 | Migración a TS, estructura de carpetas, alias `@/`, ESLint actualizado |
| 2 | Supabase setup (proyecto, schema, RLS, types generados), auth real reemplazando mock |
| 3 | shadcn/ui + react-hook-form + zod; refactor de Login, Signup, Dashboard |
| 4 | Vercel Function `upload-url`, panel admin `/admin/lessons/new` funcional con Cloudflare Stream |
| 5 | Stripe Checkout + webhook + tabla `subscriptions` + paywall en `LessonViewer` |
| 6 | Cloudflare Stream Live + chat Realtime + `VIPLiveRoom` real |
| 7 | Panel admin completo: módulos, lives, usuarios, métricas básicas |
| 8 | Prerender landing + tests críticos + checklist de seguridad pre-lanzamiento |
