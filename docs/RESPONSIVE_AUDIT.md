# Responsive Audit — Escuela de la Riqueza

> **Fecha del audit inicial**: 2026-05-14
> **Última actualización**: 2026-05-14 (7ª iteración — pantallas nuevas + cierre)
> **Alcance**: Sesión 100% frontend (sin tocar funcionalidad salvo necesario).
> **Objetivo**: Llevar TODAS las pantallas a un responsive excelente — desde 320px hasta 4K.

---

## 📋 Pendientes (priorizados)

### 🟡 Polish — quedan estos

#### R1. Indicador de tab activo en `StudentDashboard` mobile
- [ ] Ahora que se eliminó el nav inline mobile, el usuario no ve en qué pestaña está al hacer scroll.
- [ ] Cada tab ya tiene heading ("Tu Aprendizaje", "Libreta de Aprendizaje", "Mi Panel") — verificar si alcanza o si conviene agregar una pill chica fija que diga el tab actual.
- [ ] Decisión: solo agregar si testing real lo amerita.

#### R4. Estandarizar viewport units (`vh` / `svh` / `dvh`)
- [ ] Mezcla: VIPLiveRoom usa `100dvh`, AwakeningAct usa `100svh`, AuthPage `100dvh`. iOS Safari maneja distinto cada uno.
- [ ] Convención propuesta: **`dvh` para layouts full-screen interactivos**, **`svh` para hero sections fijas**.
- [ ] Documentar en `docs/ARCHITECTURE.md`.

#### R9. Orientación landscape mobile
- [ ] VIPLiveRoom: en landscape (≤500px de alto) el countdown puede quedar muy apretado.
- [ ] LessonPlayer: el video `aspect-video` ocupa toda la pantalla en landscape — verificar controles del Stream.
- [ ] AdminLayout: en landscape mobile el sidebar desktop debería entrar (revisar breakpoint).

---

### 🔧 Verificación final

#### R16. Test en devices reales
- [ ] Mobile chico (iPhone SE 1st gen, ~320px).
- [ ] Mobile estándar (iPhone 14, ~390px).
- [ ] Tablet vertical (iPad mini, ~768px).
- [ ] Desktop (1280px+).
- [ ] Foco: drawer chat VIPLiveRoom, Header mobile sheet, AdminUsers cards, hamburger del dashboard, página `/planes`, página `/cuenta-verificada`, página `/admin/users/:id`.

#### R17. Lighthouse mobile audit
- [ ] Performance score con orbes optimizados (deberían mejorar tras R5).
- [ ] LCP del landing — la imagen de Iván `loading="eager"` puede mejorar con `fetchpriority="high"` + preload.
- [ ] CLS en transiciones de tabs y carga de módulos.

#### R18. A11y mobile (pendiente menor)
- [x] Tap targets ≥44×44 en botones críticos mobile (FAB chat, cerrar drawer).
- [x] Audit completo de contraste (badges dorados, CTAs primarios sobre fondo).
- [x] Focus visible por teclado en el sheet del Header.
- [x] Revisar `p-1.5` en botones de iconos del admin UI (acceptable en uso profesional, mejorable).

---

## ✅ Hecho

### Iteración 7 (2026-05-14) — Pantallas nuevas + polish final
- ✅ **R12 — `/cuenta-verificada` (EmailConfirmed)**: nueva pantalla mobile-first con 3 estados (`checking`, `success`, `error`). Lee la sesión de Supabase del hash de la URL automáticamente, redirige a `/dashboard` tras éxito (2.2s) o muestra mensaje + CTAs en caso de error. Fondo cinemático con orbes optimizados para mobile.
- ✅ **R14 — `/planes` standalone (Plans)**: nueva ruta pública que reusa `<PlansAct />` + agrega:
  - Hero con badge "Planes y precios" + título cinemático + descripción.
  - Tabla **comparativa completa** con scroll horizontal en mobile (9 features × 3 planes).
  - **FAQ accordion** con 5 preguntas (animado con AnimatePresence).
  - CTA final con orbe gold + tagline.
  - Footer y Header actualizados para enlazar a `/planes` en lugar de `/#planes`.
- ✅ **R13 — `/admin/users/:id` (AdminUserDetail)**: nueva pantalla de detalle de usuario mobile-first con:
  - Card principal con avatar 80×80 (mobile) → 96×96 (desktop), nombre, email, badges (plan, rol, estado).
  - Bloque de suscripción (plan, estado, período actual).
  - Bloque de actividad (creado, última actualización, ID).
  - Acciones administrativas: modificar plan (radio inline), suspender/reactivar, eliminar.
  - Volver con `<ArrowLeft />` siempre visible.
  - Skeletons mientras carga.
  - Linkeado desde dropdown "Ver Detalles" tanto en cards mobile como tabla desktop de AdminUsers.
- ✅ **R15 — LessonViewer responsive (legacy)**: rediseñado layout mobile. Playlist colapsable con toggle "Contenido del módulo" en mobile (icono `ListVideo` + counter). Card de upgrade con `flex-col sm:flex-row` y `w-full sm:w-auto` en el CTA. Sizes responsivos en thumbnails (`w-24 h-16 sm:w-32 sm:h-20`). Mantengo mock data (decisión de producto futura sobre si se elimina o reescribe).
- ✅ **R18 (parcial) — Tap targets críticos**: subido a `p-2.5` el botón cerrar del chat drawer mobile (más expuesto al tap).

### Iteración 6 (2026-05-14) — Footer + perf + reduced-motion
- ✅ **Footer rework completo** — Eliminados CTAs duplicados de "Ingresar"/"Crear cuenta" (ya están en el Header). Nueva estructura:
  - **Tagline cinemático superior** con badge + cita "El conocimiento es la **moneda definitiva**".
  - **Línea dorada decorativa** en el borde superior + glow ambiental (solo desktop).
  - **3 columnas semánticas** (Plataforma / Ayuda / Legal) con separadores dorados sutiles.
  - **Brand column** con iconos sociales (Instagram + YouTube, SVG inline).
  - **Hover states**: underline dorado animado.
  - **Bottom bar limpio**: solo copyright + AnimationToggle.
- ✅ **R5 — Orbes decorativos**: todos los orbes grandes (`≥500px` con `blur-3xl`) ahora son `hidden md:block`. Mobile recibe orbe estático compacto donde el ambiente lo amerita (`NotFound`, `AuthPage`). `AuthSplash` responsive (`w-[360px] md:w-[700px]`).
- ✅ **R6 — `prefers-reduced-motion` audit**: infra ya estaba completa. Fix crítico: `IntelligencesAct` desktop con scroll horizontal dejaba cards 4–6 inaccesibles cuando reduce activo. Ahora cuando `prefersReducedMotion || !animationsEnabled`, renderiza stack vertical incluso en desktop.
- ✅ **R7/R11 — Z-index audit**: FAB chat bajado de `z-50` → `z-40` para no competir con `Sheet` (z-50). Capas oficiales documentadas (ver Patrones).
- ✅ **R8 — Skeletons + EmptyStates compactos**: `EmptyState` con `px-5 sm:px-6 py-8 sm:py-12`, ícono `w-16 sm:w-20`, título `text-base sm:text-xl`. `SkeletonCard` con `p-4 sm:p-5`, imagen placeholder `h-24 sm:h-32`.
- ✅ **R10 — Tooltips táctil**: verificado que `AnimationToggle` (único Tooltip del proyecto) ya tiene `aria-label` fallback para touch.

### Iteración 5 (2026-05-14) — Auth flow + tabs
- ✅ **R2 — `returnTo` tras redirect**: `RequireAuth` agrega `?returnTo=<path>`. `AuthPage` lo lee y valida que sea path interno seguro (`/^\/[^/\\]/`). Aplica a todas las rutas protegidas.
- ✅ **R3 — Sync `?tab=` bidireccional**: `StudentDashboard` usa `changeTab(id)` que hace `navigate(?tab=id)`. Hamburger refleja siempre el tab activo. Links como `/dashboard?tab=notas` abren directo.
- ✅ **Revert `/leccion` a pública** — anon y plan free ven clases con anuncios (control en `LessonPlayer` por `isPremium`).

### Iteración 4 (2026-05-14) — Producto + Header rework
- ✅ **Header sheet mobile — anon limpio**: removidos links de marketing (Nuestra historia, Explorar módulos, Planes y precios). Anon en mobile solo ve Ingresar/Crear cuenta para empujar el flujo cinemático.
- ✅ **Header sheet mobile — tabs del dashboard**: cuando estás en `/dashboard`, el hamburger muestra TODAS las pestañas + "Eventos en vivo" si VIP. Estado activo sincronizado con `?tab=`.
- ✅ **StudentDashboard mobile nav eliminado**: el carrusel horizontal que cortaba pestañas fue eliminado. Sin reemplazo inline para evitar redundancia con el hamburger sticky.

### Iteración 3 (2026-05-14) — Pulido fino
- ✅ ~~**#14 HeroCinematic**~~ — H1 `text-3xl sm:text-5xl md:text-6xl`. Imagen de Iván `w-[55%] sm:w-[50%]` con `max-w-[360px]` mobile.
- ✅ ~~**#16 PlansAct**~~ — Cards `p-6 sm:p-8`. Badge "Más Elegido" `text-[10px] sm:text-xs`. Card highlight con `mt-3 lg:mt-0`.

### Iteración 1-2 (2026-05-14) — Críticos + Importantes
- ✅ ~~**#1 Header mobile menu**~~, ~~**#2 AdminContentManager hover-only**~~, ~~**#3 VIPLiveRoom**~~, ~~**#4 AdminLiveManager**~~, ~~**#5 AdminUsers**~~.
- ✅ ~~**#6 LessonPlayer**~~, ~~**#7 LiveChat**~~, ~~**#8 Footer (v1)**~~, ~~**#9 AdminMetrics**~~, ~~**#10 AdminSettings**~~, ~~**#11 GlobalPodcastPlayer**~~, ~~**#12 IntelligencesAct**~~, ~~**#13 StudentDashboard**~~.
- ✅ ~~**#15 AwakeningAct**~~, ~~**#17 AuthPage**~~, ~~**#18 AdminVideoUpload**~~, ~~**#19 AdminLayout**~~.

### Verificación
- ✅ `npm run typecheck` sin errores en cada iteración.
- ✅ `npx vitest run` 15/15 tests pasan en cada iteración.

---

## Reglas operativas del audit

1. **No tocar funcionalidad** salvo que el responsive lo exija.
2. **Mobile-first**: clases base = mobile, `sm:` / `md:` / `lg:` escalan.
3. **Breakpoints de referencia**:
   - `< 360px` — devices más chicos.
   - `360–480px` — mobile estándar.
   - `481–767px` — phablet / tablet vertical pequeña.
   - `768–1023px` — `md:` — tablet.
   - `1024–1279px` — `lg:` — laptop.
   - `≥ 1280px` — `xl:` — desktop.
4. Hover-only que esconda acciones críticas debe tener `md:opacity-100` o estar siempre visible en `<md`.
5. Probar en DevTools: `320px`, `375px`, `768px`, `1024px`.
6. **Lenguaje del UI**: tuteo neutro (no voseo) en copy visible. Conversación dev puede ser rioplatense.
7. **Sin redundancia mobile**: el hamburger del Header sticky es el único nav. No duplicar con nav inline.

---

## Capas de z-index (oficial)

| z-index | Capa |
|--------:|------|
| `z-[2147483647]` (default sonner) | Toaster — siempre encima de todo. |
| `z-[10000]+` | AuthSplash (loading bloqueante). |
| `z-[100]` | GlobalPodcastPlayer, VIPLiveRoom cinematic intro. |
| `z-70` | Chat drawer mobile content. |
| `z-60` | Chat drawer mobile backdrop. |
| `z-50` | Header sticky, Sheets, Modals, AnimatePresence overlays. |
| `z-40` | FAB flotantes, badges sticky, overlays no-bloqueantes. |
| `z-30` | Headers internos overlay (VIPLiveRoom). |
| `z-20` | Player ad overlays. |
| `z-10` | Contenido principal sobre fondos. |
| `z-0` / `-z-10` | Fondos decorativos. |

---

## Patrones aprendidos

- Patrón hover-only `opacity-0 group-hover:opacity-100` rompe en táctil. Acompañar con `md:opacity-0 md:group-hover:opacity-100` + `opacity-100` por defecto.
- Para chats fullscreen mobile, **drawer overlay con FAB** > sidebar con altura `vh` que pisa el video.
- `h-[calc(100vh-NNpx)]` con hardcode rompe cuando el topbar mobile cambia. Preferir `flex-1 + min-h-0`.
- `grid grid-cols-12` siempre son 12 cols — para responsive usar `flex-col sm:grid sm:grid-cols-12`.
- Reusar componentes con prop `layout: "x" | "y"` evita duplicar (ej. `IntelligenceCard` carousel/stack).
- En sliders con scroll horizontal (tabs, period pickers): `overflow-x-auto custom-scrollbar -mx-1 px-1` + `shrink-0 whitespace-nowrap` en cada hijo.
- `text-balance` + `text-pretty` mejoran la legibilidad en titulares responsivos.
- **Navegación contextual en mobile**: el header sticky con hamburger es el único nav. NO duplicar con nav inline en cada pantalla.
- **Rutas protegidas con CTA estratégico**: `RequireAuth` con `?returnTo=<path>` mantiene el destino tras autenticar — patrón estándar para UX limpio.
- **Orbes decorativos**: siempre `hidden md:block` o variantes mobile estáticas/compactas. Son los principales culpables de bajo FPS en GPU mobile.
- **`prefers-reduced-motion`**: además de `MotionConfig`, considerar si la animación es la única forma de acceder al contenido (ej. scroll horizontal). En ese caso, ofrecer fallback estructural (stack vertical).
- **SVG inline para brand icons**: lucide-react en versiones viejas no incluye Instagram/YouTube/etc. Pequeños SVG inline son la solución más limpia (vs agregar otra dependencia).
- **`useSearchParams` para tabs**: hace que el estado sea linkable, sincroniza navegación cruzada (sheet + sidebar), permite back-button del navegador.
