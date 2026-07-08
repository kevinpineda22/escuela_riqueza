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

---

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

**Archivos:** `src/lib/api/stream/content.ts`, `src/lib/api/admin/metrics.ts`, `api/stream/recording.ts`, migración SQL (columna `duration_seconds` en `lessons`).

---

## 4. Mejorar el header de la escuela ⚪

**Estado:** código sano (`src/components/layout/Header.tsx`). "Mejorar" es subjetivo — falta dirección concreta del cliente.

**Pendiente de definir:** ¿qué se quiere mejorar? (jerarquía visual, navegación, logo, responsive, sticky, etc.)

**Archivos:** `src/components/layout/Header.tsx`

---

## 5. Logo del inicio de sesión — que se vea correctamente ⚪

**Estado:** falta detalle del defecto visual.
- `AuthSplash.tsx` usa `LOGO_LIGHT` sobre fondo `#050505`.
- `AuthPage.tsx` usa `logoLight` (fallback imagedelivery) en mobile y `logoDark` sobre el overlay dorado.

**Pendiente de definir:** ¿qué se ve mal exactamente? (recortado, borroso, mal contraste, no carga, tamaño, versión equivocada).

**Archivos:** `src/components/feature/AuthSplash.tsx`, `src/pages/public/AuthPage.tsx`
