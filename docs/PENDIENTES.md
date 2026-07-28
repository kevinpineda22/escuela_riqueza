# Pendientes — Tracker de tareas

> Lista viva de mejoras/verificaciones en curso. Actualizar estado a medida que se cierran.
> Estados: 🔴 pendiente · 🟡 en progreso · 🟢 hecho · ⚪ bloqueado (falta info)

_Última actualización: 2026-07-08_

---

## 1. Descargar grabación — verificar que funcione 🟢

**Resuelto (2026-07-08):**
- `api/stream/download-status.ts` ahora se auto-cura: si el MP4 nunca se pidió (`default` ausente), hace `POST /downloads` para habilitarlo y devuelve `status: 'inprogress'`. Antes solo consultaba (`GET`) y el video quedaba "preparando" para siempre.
- `AdminLiveManager.tsx`: el toast ahora dice "Cloudflare está generando el MP4… %" en vez del mensaje muerto; se maneja `status: 'error'`; el fallback directo (`openDownloadFallback`) ya no arma `https:///` roto cuando falta el subdominio — avisa con un error claro.
- `npm run typecheck` ✅

**Nota de config:** `VITE_CLOUDFLARE_STREAM_CUSTOMER_SUBDOMAIN` no está en ningún `env.example` (no existe ese archivo; sí está declarada en `src/vite-env.d.ts` y usada en `AdminLiveManager` y `VIPLiveRoom`). Con el fix, esa var solo hace falta para el fallback directo — el camino principal ahora va por la API. Igual conviene tenerla seteada en Vercel.

**Archivos:** `api/stream/download-status.ts`, `src/pages/admin/AdminLiveManager.tsx`

---ace

## 2. Finalizar en vivo — que guarde correctamente 🔴

**Estado:** el guardado principal funciona (`status: "ended"` + `recording_stream_uid` se persisten).

**Peros encontrados:**
- El Finalizar (`AdminLiveManager.tsx` ~648) **no setea `is_active: false`** → la sala queda `is_active = true` en la DB aunque ya esté finalizada.
- El botón Finalizar **solo se ve en estado `live`**. Si OBS se desconecta → `is_paused = true` → solo aparece "Reanudar". No se puede finalizar una sala pausada sin reanudarla primero.

**Fix propuesto:**
- Agregar `is_active: false` al `updateLive` del Finalizar.
- Mostrar "Finalizar" también cuando `is_paused === true`.

**Archivos:** `src/pages/admin/AdminLiveManager.tsx`, `src/lib/api/stream/lives.ts`

---

## 3. Análisis de minutos / costo Cloudflare 🔴

**Regla de negocio:** Cloudflare Stream cobra ~$5 por cada 1000 min **almacenados** + ~$1 por cada 1000 min **entregados**.

**Estado:** **no existe** ninguna agregación de minutos.
- Las lecciones (`content.ts`) no guardan duración.
- `lives.duration_minutes` es manual y casi siempre `null`.
- `recording.ts` recibe `video.duration` (segundos) de Cloudflare pero **no lo persiste**.

**Fix propuesto (feature nuevo):**
- Guardar la duración de cada video (lección + grabación) al vincularlo.
- Panel/KPI en admin que sume minutos totales y muestre costo estimado.

> Parcialmente cubierto por el punto 6 (archivado R2): las columnas `recording_bytes` y `recording_duration_seconds` habilitan el tracking de minutos/costo de las grabaciones.

**Archivos:** `src/lib/api/stream/content.ts`, `src/lib/api/admin/metrics.ts`, `api/stream/recording.ts`, migración SQL (columna `duration_seconds` en `lessons`).

---

## 6. Archivado de grabaciones en R2 (ahorro de costos) 🟡

**Objetivo:** mover las grabaciones de Cloudflare Stream (caro, acumulativo) a Cloudflare R2 (egress cero, storage barato) al finalizar el vivo, y borrar de Stream. Ver spec completa en **`docs/RECORDINGS_ARCHITECTURE.md`**.

**Hecho (2026-07-08):**
- 📄 `docs/RECORDINGS_ARCHITECTURE.md` — spec completa (problema, solución, flujo, costos, componentes).
- 🗄️ `sql/migrate-recordings-r2.sql` — columnas nuevas en `lives` (`recording_r2_key`, `recording_storage`, `recording_bytes`, `recording_duration_seconds`, `archived_at`) + backfill. **✅ Corrida en Supabase 2026-07-08 (5 columnas confirmadas).**
- 🧩 Tipo `LiveEvent` actualizado con los campos nuevos. `npm run typecheck` ✅.
- 🔐 `api/stream/recording-url.ts` — URL firmada de R2 (15 min), gateada por plan. Usa `aws4fetch` (instalado).
- 🌐 Bucket `escuela-recordings` creado + 4 env R2 en Vercel (cliente, 2026-07-08).
- ⚙️ `worker/` — Worker completo (copia Stream→R2 + borra de Stream + actualiza `lives`). Escrito, **falta deploy con wrangler**.
- 🔗 `api/stream/archive-recording.ts` — dispara el Worker (admin).
- 🖥️ Admin Finalizados: botón "Archivar en R2" + `RecordingPlayer` (video R2 firmado / iframe Stream legacy). `npm run typecheck` ✅ (frontend).

**Falta (acción cliente + un paso mío):**
- Deploy del Worker (`wrangler`) + env `ARCHIVE_WORKER_URL`/`ARCHIVE_SHARED_SECRET` en Vercel → ver sección 6b de `RECORDINGS_ARCHITECTURE.md`.
- Player de replay del lado del alumno (VIPLiveRoom) preferir R2 — pendiente de revisar si muestra replays.
- KPI de minutos/costo en admin (opcional, ya hay datos).

**Archivos:** `docs/RECORDINGS_ARCHITECTURE.md`, `sql/migrate-recordings-r2.sql`, `src/lib/api/stream/lives.ts`

---

## 4. Zona inicial de la landing (header + hero) — nueva vida 🟡

**Dirección elegida por el cliente (2026-07-09):** vibe "Aurora dorada envolvente" para toda la zona inicial.

**Hecho:**
- 🌌 `src/components/feature/AuroraBackground.tsx` — fondo ambiental reutilizable (luces doradas en movimiento, gateado a desktop, mobile con orbe estático).
- 🦸 `HeroCinematic.tsx` — aurora de fondo + glow pulsante y anillo detrás de la foto de Iván + flotado sutil de la imagen. Header height sincronizado (`5rem` desktop).
- 🎩 `Header.tsx` — más aire (`h-16 md:h-20`, padding `lg:px-8`) + scroll-aware (translúcido arriba → glass con borde y sombra al bajar).
- `npm run typecheck` ✅.

**Rework parallax (2026-07-09):** el cliente pidió que el header no parezca una barra separada, estilo web parallax, todo unido.
- 🎩 `src/components/layout/LandingHeader.tsx` — header dedicado de la landing: flota transparente sobre el hero, se condensa en píldora glass al scrollear, logo con más presencia, botón "Iniciar sesión" premium (gradiente + brillo que barre + flecha).
- 🌀 `HeroCinematic.tsx` — parallax con `useScroll`/`useTransform`: aurora lenta al fondo, foto sube, contenido baja y se desvanece. Hero a `100svh` con padding superior para el header flotante.
- 🔁 `Header.tsx` compartido REVERTIDO a su estado original (dashboard/admin lo quieren sólido). Solo la landing usa `LandingHeader`.
- `LandingPage.tsx` monta `LandingHeader` en vez de `Header`.
- `npm run typecheck` ✅.

**Falta:** aplicar la misma aurora al login (punto 5b) + validación visual del cliente.

**Archivos:** `src/components/layout/LandingHeader.tsx`, `src/components/feature/AuroraBackground.tsx`, `src/components/feature/HeroCinematic.tsx`, `src/pages/public/LandingPage.tsx`

---

## 5. Logo del inicio de sesión — que se vea correctamente 🟢

**Problema (confirmado con screenshot):** el logo dorado se camuflaba sobre el panel dorado del login (oro-sobre-oro, sin contraste).

**Resuelto (2026-07-09):**
- Medallón oscuro con glow detrás del logo en `WelcomePanel` (`AuthPage.tsx`) → el logo dorado resalta sobre fondo negro.
- Cambio a `logoLight` (logo dorado) en vez del `logoDark` que se perdía; se eliminó la constante `LOGO_DARK_OVERLAY` y la variable `logoDark` (quedaban muertas).
- Oro del panel profundizado a un degradé más rico (`#F0C959` → `gold` → `#7d5e18`).
- `npm run typecheck` ✅.

**Archivos:** `src/pages/public/AuthPage.tsx`

### 5b. Login "de otro nivel" (2026-07-09) 🟡

- 🌌 Aurora dorada viva en `AuthBackground` **presente también en mobile** (antes los blobs eran `hidden md:block` → mobile casi negro). Coherente con la landing sin acoplar código.
- ✨ **Signature: border-beam** — luz dorada giratoria en el borde de la tarjeta desktop (conic-gradient rotando, tapado por el `<article>` opaco → solo se ve el borde).
- 💛 Tarjeta mobile con borde dorado + glow suave (el beam no sirve sobre bg translúcido).
- `npm run typecheck` ✅.
- **Pendiente (opcional, si el cliente quiere más):** shine en botón primario, focus glow en inputs.

**Archivos:** `src/pages/public/AuthPage.tsx`
