# Modo claro — dirección visual y especificación de implementación

**Fecha:** 18 de septiembre de 2026. **Base revisada:** commit `5ebd990`, árbol de trabajo inicialmente limpio. **Estado:** especificación; el modo claro NO está implementado.

El modo claro debe conservar la identidad dorada, la composición y la coreografía de la Escuela de la Riqueza. La implementación debe introducir superficies marfil, texto cálido oscuro y acentos accesibles, manteniendo el modo oscuro actual como referencia de regresión. No alcanza con invertir colores ni con cambiar seis valores de Tailwind: hay gradientes, canvas, gráficos, portales, formularios y escenas multimedia con estilos propios.

Este documento es el entregable de una revisión sin cambios de código. Define qué tocar, qué preservar y cómo comprobarlo. Las decisiones que siguen son la propuesta de implementación, no funcionalidades existentes ni una certificación visual del futuro tema.

## 1. Cómo usar esta especificación

1. Leer los límites y contratos de las secciones 2–4 antes de modificar archivos.
2. Implementar primero tokens, resolución del tema y componentes compartidos; después avanzar por los módulos de las secciones 5–9.
3. Conservar las animaciones descritas en la sección 10; validar ambos temas con la matriz de la sección 12.
4. No publicar el selector hasta que todas las rutas activas estén adaptadas. Una pantalla clara aislada no completa esta entrega.

| Índice | Contenido |
|---|---|
| [2. Evidencia y alcance](#2-evidencia-y-alcance) | Qué se revisó y límites de la verificación |
| [3. Dirección visual](#3-dirección-visual-y-contraste) | Paleta, roles, contraste y excepciones oscuras |
| [4. Arquitectura](#4-contrato-del-sistema-de-tema) | Persistencia, arranque, portales y archivos base |
| [5. Compartidos](#5-componentes-compartidos-y-primitivos) | Navegación, formularios, overlays y feedback |
| [6. Públicas](#6-páginas-públicas-y-edición-de-contenido) | Landing, autenticación, planes y contenido |
| [7. Alumnos](#7-área-de-alumnos-y-comunidad) | Catálogo, notas, certificados, perfil y foro |
| [8. Multimedia](#8-reproducción-lives-y-chat-contrato-de-no-regresión) | Video, podcast, grabaciones y controles |
| [9. Administración](#9-administración) | Todos los módulos y estados administrativos |
| [10. Movimiento](#10-animaciones-y-efectos-que-se-deben-conservar) | Coreografía y adaptación lumínica |
| [11. Ejecución](#11-orden-de-implementación-y-entregables) | Dependencias, puertas de revisión y reversión |
| [12. Aceptación](#12-matriz-de-aceptación-y-verificación) | Criterios verificables para cerrar |

## 2. Evidencia y alcance

### 2.1 Revisión efectuada

Se revisaron las rutas reales de `src/routes.tsx`, todas las páginas de `src/pages/public`, `src/pages/student` y `src/pages/admin`, los componentes visuales asociados, todos los primitivos de `src/components/ui`, la configuración de estilos, el arranque y las preferencias. Se contrastaron los flujos frágiles con `docs/PODCAST_ARCHITECTURE.md` y `docs/RECORDINGS_ARCHITECTURE.md`.

Se inspeccionó el sitio local existente en `http://localhost:5173`: landing y actos durante scroll, planes y FAQ abierto, login y transición a registro, historia, exploración del módulo 1 y menú móvil. Hubo observación de escritorio y de landing/formulario/exploración a 390 × 844. Se observaron composición, efectos y estados accesibles; no se generó un archivo de capturas ni se midió cada píxel de cada estado animado.

**Cobertura pendiente para la implementación:** pantallas autenticadas y sus estados se revisaron en código, no con una sesión de alumno/admin. No se ejecutaron operaciones comerciales, uploads, publicaciones, envíos de formularios ni una emisión de prueba. No se validaron dispositivos físicos, todos los breakpoints, todos los assets dinámicos ni reproducción completa. Las pruebas de la sección 12 son trabajo futuro obligatorio, no resultados aprobados.

### 2.2 Hallazgos que condicionan el trabajo

| Evidencia actual | Consecuencia para modo claro |
|---|---|
| `tailwind.config.js` define `dark`, `darker`, `gold`, `goldHover`, `textMain`, `textMuted`; `src/index.css` aplica oscuro al body. | Introducir roles semánticos; no intercambiar indiscriminadamente esos seis valores. |
| `text-darker` también es tinta de CTA dorados. | Su reemplazo es `on-brand`, fijo oscuro, no el fondo adaptable de la página. |
| Abundan `text-white`, `bg-black`, `border-white`, transparencias, hex y rgba inline. | Cada aparición requiere clasificación por función; una sustitución global rompería multimedia y legibilidad. |
| `LandingHeader`, `EditModeToggle`, `ScrollToTop` y varios Radix se portalean fuera de la pantalla. | Aplicar tema en `html`; tratar explícitamente portales de escenas oscuras. |
| Toaster fija `theme="dark"` y clases importantes; Recharts y canvas tienen colores propios. | Necesitan adaptadores de tema, además de CSS. |
| `PageTransition` actual solo anima opacidad. | No seguir comentarios antiguos que hablan de blur; no agregar transform/filter al wrapper de rutas. |
| Live actual usa `LiveHLSPlayer` + `LivePlayerControls`. | No planificar una migración de `<Stream>` para el live basándose en documentación antigua. |
| `StudentDashboard.tsx` concentra lección, notas, certificados, comunidad y perfil. | No asignar tareas a un supuesto `LessonViewer.tsx`: no existe en este checkout. |
| `AdminVideoUpload.tsx` existe, pero no está ruteado en `routes.tsx`. | Cubrirlo como componente latente; no crear una ruta para probar el tema. |

### 2.3 Fuera del cambio

No cambiar permisos, RLS, APIs, suscripciones, pagos simulados, reglas publicitarias, lógica de progreso, URLs firmadas ni contenido comercial/legal. No migrar librerías ni rehacer layouts. No modificar templates de correo: tienen renderizado y tematización propios. Esta tarea no requiere cambios de SQL, Worker, endpoints ni secretos.

## 3. Dirección visual y contraste

### 3.1 Identidad propuesta

Usar un claro **marfil y oro**, con superficies cálidas y contraste editorial. Mantener Inter, escalas tipográficas, cursivas de titulares, radios, espaciados, tamaños, jerarquía de planes, iconografía y proporciones actuales. Los fondos ambientales siguen existiendo: sobre claro funcionan como tintes suaves, no como focos amarillos saturados.

Conservar el dorado de marca `#CCA43B` para rellenos, marca y decoración. Separar el dorado de lectura para enlaces, texto pequeño e iconos funcionales. Evitar blanco puro en toda la página: reservarlo para tarjetas y controles elevados. La profundidad proviene de bordes cálidos, contraste de superficie y sombras suaves, no de oscurecer grandes regiones.

### 3.2 Contrato de tokens

Nombres propuestos; deben implementarse con una única fuente de valores. Los valores claros son una base concreta de diseño, sujeta a la validación de fondos compuestos. El oscuro debe reproducir sus valores actuales por contexto; si dos usos actuales son distintos, crear un rol adicional en vez de homogeneizarlos y alterar la referencia.

| Rol | Claro propuesto | Oscuro / regla |
|---|---|---|
| `surface-page` | `#F8F6F1` | `#0A0A0A` |
| `surface-panel` | `#FFFFFF` | `#121212` para paneles de ese tono |
| `surface-subtle` | `#F0ECE3` | Mantener el negro/blanco translúcido compuesto actual por contexto |
| `surface-input` | `#FFFFFF` | Variante existente de input, sin aplanar sus estados |
| `surface-popover` | Blanco con opacidad suficiente, base `#FFFFFF` | Panel oscuro actual; preservar blur y geometría |
| `foreground` | `#1C1A16` | `#E5E5E5`; títulos actualmente blancos usan rol `foreground-strong` |
| `foreground-strong` | `#1C1A16` | `#FFFFFF` |
| `foreground-muted` | `#625E56` | `#A3A3A3` donde corresponde |
| `foreground-placeholder` | `#747067` | Valor de placeholder actual, verificar contraste real |
| `border-subtle` | `#DED8CC` | Blanco con la opacidad actual según componente |
| `border-control` | `#8C877D` | Borde funcional actual; evaluar contraste |
| `brand-fill` / `brand-fill-hover` | `#CCA43B` / `#E1B846` | Invariables |
| `on-brand` | `#0A0A0A` | Invariable, incluso si cambia la superficie |
| `accent-foreground` | `#846313` | Dorado actual en texto/iconos |
| `accent-foreground-hover` | `#6B4E0B` | Dorado hover actual |
| `focus-ring` | `#846313` | Dorado actual; offset de la superficie local |
| `media-surface` / `media-foreground` | `#050505` o negro / `#FFFFFF` | Invariables, distinguir negro del lienzo y fondo del escenario |
| `media-muted` | `#A3A3A3` | Invariable; no heredar muted oscuro del tema claro |
| `scrim` | Negro translúcido calibrado por contexto | Nunca invertir automáticamente a blanco |
| `shadow-panel` | Sombra cálida de baja opacidad | Sombra actual, sin cambiar tamaño o elevación |

Definir también familias para `success`, `warning`, `danger`, `info`, planes y categorías. Cada familia necesita texto, superficie tintada, borde e icono. Base propuesta de texto claro: éxito `#166534`, advertencia `#854D0E`, peligro `#B91C1C`, información `#1E40AF`, violeta `#6B21A8`, sobre tintes pálidos de su familia. Validar cada pareja; no trasladar `*-200/300/400` automáticamente desde oscuro. Mantener el significado local de cada plan/categoría y sus etiquetas/iconos.

### 3.3 Contraste: mediciones y criterio

Ratios calculados con luminancia relativa sRGB sobre colores sólidos, sin transparencia, redondeados solo para presentación. **No son una auditoría completa del sitio.**

| Texto / fondo | Ratio aproximado | Decisión |
|---|---:|---|
| Oro `#CCA43B` / blanco `#FFFFFF` | 2,35:1 | No usar como texto ni como único icono funcional en claro. |
| Oro `#CCA43B` / marfil `#F8F6F1` | 2,17:1 | Mantener para marca/decoración; usar acento de lectura para información. |
| Gris actual `#A3A3A3` / blanco | 2,52:1 | No reutilizar como texto secundario claro. |
| Tinta `#0A0A0A` / oro `#CCA43B` | 8,43:1 | Conservar en CTA dorados. |
| Acento `#846313` / blanco | 5,56:1 | Base apta para texto normal sólido. |
| Acento `#846313` / marfil | 5,15:1 | Base apta para enlaces y énfasis. |
| Secundario `#625E56` / marfil | 5,97:1 | Base de párrafos secundarios. |
| Placeholder `#747067` / blanco | 4,93:1 | Usar sin reducir opacidad adicional. |
| Borde `#8C877D` / marfil | 3,31:1 | Base de límites funcionales, validar superficie vecina. |
| Principal `#1C1A16` / marfil | 16,09:1 | Base de lectura. |

Objetivo de aceptación: texto normal ≥4,5:1; texto grande ≥3:1 (24px regular o aproximadamente 18,67px en negrita). Medir el peor punto de gradientes, imágenes y efectos en movimiento; no solo sus extremos. [W3C: contraste de texto](https://www.w3.org/WAI/WCAG21/Understanding/contrast-minimum).

Iconos y señales visuales necesarias para reconocer controles/estados: ≥3:1 con colores adyacentes. No se exige ese ratio a cada separador puramente decorativo. Estados deben incluir etiqueta, icono, forma o indicador además del color. [W3C: contraste no textual](https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html).

### 3.4 Excepciones oscuras explícitas

| Región | Decisión |
|---|---|
| Video de lecciones, historia, grabaciones y anuncios | Lienzo, letterboxing, overlays de reproducción y controles permanecen oscuros. Marco, ficha y metadatos siguen el tema. |
| Escenario del live, countdown e intro | Conservar escena oscura para imagen, scanlines y legibilidad. Chat, lista de conectados y navegación exterior se adaptan. |
| Vitrina central 3D de certificados | Mantener vitrina oscura delimitada; títulos, filtros y galería exterior claros. Preserva iluminación/reflejos del objeto. |
| Medallón del logo sobre panel dorado de autenticación | Mantener medallón negro y tinta oscura del panel oro. |
| Logo con lettering blanco, sin variante clara | Usar soporte oscuro compacto e intencional. Preferir un asset oficial apto para claro cuando exista; nunca filtros invert/brightness para recolorear la marca. |

No dejar Header, Footer, formularios, dashboard o admin completos oscuros por omisión. Las excepciones deben ser reconocibles, acotadas y usar tokens propios. El negro de una máscara CSS no es un fondo: no invertir `mask-image` ni filtros de assets por búsquedas de hex.

## 4. Contrato del sistema de tema

### 4.1 Preferencia y comportamiento

Propuesta de producto: selector con **Oscuro, Claro y Sistema**; conservar **Oscuro como valor inicial** cuando no exista elección, para no cambiar la experiencia actual de los usuarios. Sistema solo sigue el sistema operativo cuando la persona lo selecciona. La preferencia es local al navegador, no una configuración global que el administrador impone a los alumnos.

Persistir la elección en `src/stores/preferences.store.ts`, conservando la clave `escuela-riqueza-preferences`, `animationsEnabled` y `liveLatencyMode`. Añadir el campo a `partialize` y tolerar registros antiguos sin tema. Tema efectivo es claro/oscuro; Sistema es una preferencia, no un tercer conjunto de colores. Valores desconocidos, JSON inválido o almacenamiento inaccesible deben caer a oscuro sin bloquear la app.

Aplicar `data-theme` en `document.documentElement` y `color-scheme` coherente antes del primer pintado. El arranque debe leer de forma defensiva el formato persistido de Zustand y compartir la misma política de resolución que React. No esperar sesión, consulta de settings ni un `useEffect` tardío para decidir el fondo inicial. Si hay política CSP, verificar que permita el mecanismo elegido; no debilitarla.

Sincronizar cambios explícitos y eventos de almacenamiento entre pestañas; escuchar cambios del SO únicamente mientras la preferencia sea Sistema. Gestionar correctamente limpieza de listeners y StrictMode. No escribir en Supabase para cambiar apariencia. Cerrar sesión no borra preferencias visuales.

### 4.2 Integración sin remontajes

El tema cambia variables y atributos, no la identidad de componentes. Prohibido `key={theme}` en la raíz, rutas, forms, players, canvas o charts. No recrear QueryClient, Router, canales Realtime, streams ni cargas TUS. No agregar tema a dependencias de inicialización de HLS/podcast/auth.

El contexto debe alcanzar splash y fallback de error. `PodcastEngine` permanece en su posición actual, fuera de Router/AuthBootstrap: no envolverlo en una rama condicional por tema. La sincronización temática debe ser pequeña e independiente del ciclo de vida multimedia.

No animar globalmente `*` ni usar una transición de página para cambiar tema. Base recomendada: cambio cromático inmediato y atómico; conservar transiciones locales actuales. Evita frames de texto claro sobre fondo claro y no añade movimiento al modo simple.

### 4.3 Archivos base y responsabilidad

| Archivo existente / pieza propuesta | Trabajo especificado |
|---|---|
| `index.html` | Resolver tema antes del render; actualizar `meta theme-color` de acuerdo con la superficie de app. Evitar destello oscuro en una elección clara persistida. |
| `src/index.css` | Definir variables por tema, body, scrollbars, selección, color-scheme y utilidades de efectos. Mantener reglas reduce-motion y Lenis/iframe. |
| `tailwind.config.js` | Exponer roles semánticos compatibles con Tailwind 4 cargado mediante `@config`. Preservar aliases antiguos durante la migración, sin invertir `dark/darker` globalmente. |
| `src/stores/preferences.store.ts` | Preferencia persistida, defaults compatibles, setters independientes de animaciones/latencia. |
| `src/main.tsx`, `src/App.tsx` | Integrar sincronización estable y tema del Toaster; conservar estructura de providers y montaje del motor de podcast. |
| `src/routes.tsx` | No requiere cambios de rutas/guards; mantener transición opacity 0,3s y claves actuales. |
| Nuevo control de apariencia compartido | Una sola implementación accesible para desktop/mobile/auth/footer, con estado seleccionado y etiqueta. Su ubicación final debe mantener espacios táctiles y no duplicar controles visibles. |
| Nuevo resolvedor/sincronizador de tema, si se necesita | Centralizar algoritmo; nombres/ubicación según convenciones existentes. No instalar otra librería para resolver tres preferencias. |

Usar clases semánticas estáticas, no hex ni `var()` en `className`. Variables CSS pueden alimentar estilos inline/SVG/canvas cuando esas APIs lo requieran. No construir nombres Tailwind dinámicos que el escáner no pueda detectar. Verificar estilos calculados mediante servidor dev, sin build. [Tailwind: variables de tema](https://tailwindcss.com/docs/theme).

Si se conservan variantes `dark:`, hacer que respondan al mismo selector `data-theme`, no a un media query independiente que contradiga la elección manual. No mezclar dos autoridades. [Tailwind: selección manual de tema](https://tailwindcss.com/docs/dark-mode).

### 4.4 Portales y contextos oscuros

El tema de app se hereda desde `html` para todos los portales normales. Una isla multimedia requiere además su paleta local completa. El menú portaleado de `LivePlayerControls` debe recibir explícitamente ese contexto oscuro en su contenido; no heredará variables del wrapper del video si se monta en `body`. Conservar container/portal y fullscreen que necesite cada control: no mover nodos para resolver solo el color.

### 4.5 Ubicación y accesibilidad del selector

En Header y LandingHeader, ubicarlo junto al control cinematográfico conservando acceso a sesión y logo. A 320/390px usar presentación compacta; en Header móvil incluirlo en el Sheet. Auth, recuperación, confirmación, mantenimiento y 404 necesitan acceso coherente aunque no monten Header; el Footer puede ofrecer una versión con texto. No depender exclusivamente de un menú de cuenta autenticada.

Nombre accesible “Apariencia”, opciones con selección anunciada y tooltip solo complementario. Teclado, foco visible, Escape y retorno del foco deben funcionar. Mantener tamaño táctil propuesto de 44px para el nuevo control. El icono sol/luna no puede ser la única explicación. No reutilizar AnimationToggle: apariencia y movimiento son preferencias independientes.

## 5. Componentes compartidos y primitivos

Para todas las filas: cubrir normal, hover, focus-visible, active/selected, disabled, loading y error cuando existan. Los bordes tenues decorativos y los límites de inputs no comparten necesariamente el mismo token.

### 5.1 Navegación, carga y errores

| Archivo | Adaptar | Preservar |
|---|---|---|
| `src/components/layout/LandingHeader.tsx` | Scrim `from-darker via-darker/80`, logo y sombra, nuevo selector. | Portal body; scrim z40/header z50; aparición de capa al scroll >24px, transición 500ms; contraste sobre hero y secciones. |
| `src/components/layout/Header.tsx` | Glass `bg-darker/85`, bordes, avatar, usuario, logout, Sheet móvil, item activo/inactivo, CTA. | Roles anon/free/individual/vip/admin, tabs, navegación, estado de sesión y foco del Sheet. |
| `src/components/layout/Footer.tsx` | Fondo, tagline gradiente, redes, headings, separadores y links. Debe ser claro en claro. | Datos dinámicos/fallbacks, SVG currentColor, rutas absolutas y hashes, control cinematográfico. |
| `src/components/feature/AnimationToggle.tsx` | Thumb, track y estado inactivo white/5–60; tooltip y acentos. | Semántica, aria-pressed y store; no cambiar preferencia al alternar tema. |
| `src/components/feature/ScrollToTop.tsx` | Sombra y tinta sobre oro. | Portal body, umbral 80% viewport, helper Lenis y posición sin colisión con edición/podcast. |
| `src/components/feature/AuthSplash.tsx` | Base #050505, grid #ffffff05, glow, logo, anillo y mensaje. Debe conocer tema antes de auth. | role=status, aria-live, aria-busy, z9999, tiempos de pulsos/carga. |
| `src/components/layout/ErrorBoundary.tsx` | Fondo radial, grid, card, textos, error, CTA secundario y bloque DEV. | Captura/retry/fallback, enlace inicio y condición DEV; estilo funciona aunque fallen providers internos. |
| `src/components/providers/AuthBootstrap.tsx`, `src/components/layout/RequireAuth.tsx` | Sin cambios funcionales; reciben presentación ya tematizada. | Timeout, hidratación, manejo de sesión, restricciones y returnTo. |

### 5.2 Primitivos: `src/components/ui/`

| Archivo | Especificación |
|---|---|
| `button-variants.ts` | Adaptar primary, secondary, outline, ghost, link y destructive; ring-offset según superficie. Primary conserva oro + `on-brand`; outline/link usan acento accesible. No perder foco en hover. |
| `button.tsx` | Conservar estructura, asChild, refs y tamaños. Revisar overrides de consumidores, no solo variants. |
| `dialog.tsx` | Panel claro, texto/cierre/borde/sombra claros; backdrop oscuro translúcido separado del panel. Preservar focus trap, Escape, portal, max-height, scroll y animación 300ms. |
| `sheet.tsx` | Panel, título, cierre y bordes claros; scrim independiente. Preservar cuatro lados, apertura 500ms/cierre 300ms, ancho y foco móvil. |
| `dropdown-menu.tsx` | Popover, separadores, focus, checked, disabled; preservar portal, teclado y animación por lado. Permitir contexto multimedia explícito. |
| `select.tsx` | Sustituir colores dudosos `*-oklch(...)` con espacios por tokens válidos, verificando CSS calculado. No asumir que sus `dark:` actuales constituyen tema terminado. Cubrir trigger, placeholder, contenido, ítems, check y scrolling. |
| `tooltip.tsx` | Fondo/texto/borde compatibles. Si se decide tooltip inverso, declararlo como variante intencional. Este archivo no añade Portal propio. Preservar sideOffset y delayed-open. |
| `accordion.tsx` | Trigger, borde, contenido y hover con tokens. Conservar rotación y alturas/animación de apertura y cierre. |
| `empty-state.tsx` | Superficie/borde visibles, título y halo; conservar composición, entrada .45s y flotación 4s. |
| `skeleton.tsx` | Base y highlight distinguibles sobre claro; oro/10 actual no basta por sí solo. Preservar dimensiones, aria-hidden y shimmer. |
| `toaster.tsx` | Recibir tema efectivo en lugar de `theme="dark"`; adaptar todas las clases importantes de toast/title/description/action/cancel/close/success/error/info/warning. Mantener export central `toast`, top-right, 4 visibles y duración 4500ms. |

### 5.3 Formularios transversales

La app tiene inputs/textarea/select nativos repetidos fuera de primitivos. Migrarlos en cada consumidor: labels, valores, placeholder, caret, selección, autofill, focus, errores, helper text, icono de contraseña, disabled y readonly. El tema claro no debe volver invisible una etiqueta ni depender del placeholder como nombre del campo.

Respetar contorno de foco, texto escrito, selección y borradores al cambiar tema. Sincronizar `color-scheme` de date/datetime-local y select nativo; remover el oscuro forzado solo donde corresponda. Validar menú nativo y autofill en navegador real. No alterar esquemas Zod, submit, validaciones ni estados de carga para resolver presentación.

## 6. Páginas públicas y edición de contenido

### 6.1 Landing y actos

| Archivo | Qué tocar para claro | Qué debe seguir igual |
|---|---|---|
| `src/pages/public/LandingPage.tsx` | Base, selección, grid #80808008 y glow fijo. | Orden de cinco actos, ids, stacking y efectos solo desktop. |
| `src/components/feature/HeroCinematic.tsx` | Blanco de h1/subtítulo, gradiente gold→amber100, drop-shadow y piso `from-darker`. Usar gradiente de oro profundo legible en todo su recorrido. | 100svh, foto original, orden responsive, parallax, reveals, flotación y cursivas sin recortes. El piso debe fundir con marfil sin banda negra. |
| `src/components/feature/AwakeningAct.tsx` | Pregunta white/55, respuesta degradada blanca, textShadow rgba, cifras y glows. | Tres frames, revelado por palabra/blur, count-up 1400ms es-CO y fallback estático; edición admin. |
| `src/components/feature/IntelligencesAct.tsx` | Cards white/4→1%, bordes white/8, títulos, Free badge, iconos, CTA y halo. | Desktop 260vh + sticky 100svh y recorrido horizontal; móvil/modo simple seis cards apiladas accesibles. No cambiar destinos por plan. |
| `src/components/feature/PathAct.tsx` | Círculos bg-darker, línea white/8, títulos, sombras y acentos. | Tres pasos, fill scaleY/origin-top, stagger y línea completa en movimiento reducido. |
| `src/components/feature/PlansAct.tsx` | Cards, precio, features white/90, botones secundarios, edición y destructivos. | Individual destacado, badge, elevación lg, precios/divisa/trial dinámicos, links `/registro?plan=...` y edición de features. |
| `src/components/feature/AuroraBackground.tsx` | Radiales oro/bronce, grid #ffffff08 y vignette; crear valores claros por efecto. | Tres luces desktop, orbe estático móvil, máscara radial. No invertir negro de máscara. |
| `src/components/feature/ParticleNetwork.tsx` | Resolver RGB/alpha/sombra por tema en canvas. En claro, puntos bronce discernibles y líneas discretas. | Densidad 90/40, DPR máximo 2, un rAF, pausa por IntersectionObserver, mouse desktop y cleanup; repintar también el frame estático al cambiar tema. |

### 6.2 Rutas públicas

Prefijo de archivos: `src/pages/public/`.

| Archivo / rutas | Trabajo visual y estados que cubrir | Restricciones |
|---|---|---|
| `AuthPage.tsx` — `/login`, `/registro`, `/recuperar-contrasena` | Fondo #050505, radial, ruido/mix-blend, viñeta, formularios black/40, labels, tabs, beam y tarjetas. Cubrir signin/signup/forgot, selección de plan, pago simulado, check-email, loading/error, registro pausado y mostrar contraseña. | Conservar card desktop 860×560, overlay dorado deslizante, crossfade móvil, formularios montados, plan/returnTo y medallón oscuro; no implementar pagos reales. |
| `ResetPassword.tsx` — `/restablecer-contrasena` | Radial #121212/#1a1710/#0a0a0a, grid, glass e inputs; comprobando sesión, enlace expirado, validación, envío y éxito. | Preservar flujo de recuperación y redirección. |
| `EmailConfirmed.tsx` — `/cuenta-verificada` | Fondo, halo, secundarios y estado rojo; checking/success/error con/sin sesión. | Icono spring, tiempos, links y configuración dinámica. |
| `Plans.tsx` — `/planes` | Hero, tabla black/30, divisores, headers, X atenuadas, celdas, FAQ y CTA. | Tabla con overflow horizontal, FAQ height/opacity .25s y anclas `#planes`/`#faq`. |
| `HistoryPage.tsx` — `/historia` | Texto, citas, badges, grid, glows y estilos prose, incluidos strong/listas/enlaces. | Contenido y edición inline; video negro original y aspect-video. |
| `TermsPage.tsx` — `/terminos` | Base, badge, headings, prose-invert, listas y contacto. | Texto legal, jerarquía, ancho de lectura y links. |
| `PrivacyPage.tsx` — `/privacidad` | Mismo tratamiento editorial, incluyendo bullets/strong heredados. | Contenido legal intacto. |
| `ModulePreview.tsx` — `/explorar/:intelligenceId` | Badge, invitación, tarjetas, lección disponible, bloqueos/candados, números, skeleton y vacío/error. | Permisos, primera lección, LessonPlayer como isla; banner column→md row, no flex-wrap incidental. |
| `MaintenancePage.tsx` — guard global, sin ruta propia | Base, radial, badge, texto, logo/contacto y giro Wrench; visitante/admin. | Allowlist de mantenimiento y escape del admin. |
| `NotFound.tsx` — `*` | 404 gradiente, grid, halos, líneas oblicuas y botones. | Secuencia de entrada y fondo móvil estático. Tiene logo constante: incluirlo en adaptación de marca. |

### 6.3 Editor y assets

`src/components/feature/EditableField.tsx`: migrar fondo, outline, caret y **`-webkit-text-fill-color:#fff`**. Cambiar solo `text-white` no resuelve los inputs dentro de titulares degradados. Preservar reset de tipografía, multiline, Escape para revertir campo, Enter/blur para cerrar sin guardar, undo y stopPropagation. Cambiar tema no guarda ni descarta contenido.

`src/components/feature/EditModeToggle.tsx`: adaptar banner glass, controles, estado pendiente amber y FAB; conservar portal body, z210/z200, guardar/descartar/cancelar y estados saving/error/parcial. Revisar convivencia móvil con selector, Header, ScrollToTop y podcast.

El logo observado tiene lettering claro; sobre marfil necesita variante oficial o soporte oscuro. Header/LandingHeader/Footer/Auth/EmailConfirmed/Maintenance usan settings con fallback; AuthSplash, NotFound y admin también requieren revisar sus referencias fijas. No sustituir `settings.logo_url` ni agregar campos de branding a la base sin un alcance separado. Revisar logos de sponsors, miniaturas, certificados y foto de Iván con fondos claros/oscuros y carga fallida. No modificar sus colores originales.

## 7. Área de alumnos y comunidad

### 7.1 `src/pages/student/StudentDashboard.tsx`

| Región / estado | Especificación |
|---|---|
| Shell, sidebar, navegación y usuario | Superficies claras, textos y estados activos accesibles; mantener sticky, scroll propio, `min-w-0`, overflow y rutas `?tab=`. |
| Aprendizaje | Tematizar tarjetas, badges por plan, búsqueda/filtros existentes, playlist, progreso, completado y bloqueado. Revisar 0%, parcial y 100%, carga/vacío/error y títulos extensos. |
| Lección seleccionada | Separar wrapper `bg-black` del lienzo de video: barra de plan/metadatos siguen tema; player conserva oscuridad. No cambiar selección al alternar. |
| Apuntes y libreta | Inputs/textarea, tarjetas, timestamps, tabs y vacíos claros; preservar nota escrita y selección tanto desktop como móvil. |
| Certificados | Vitrina central oscura explícita; galería/textos exteriores claros. Conservar conic-gradient, spotlight, reflejo y objeto 3D dentro del contexto oscuro. |
| Certificado bloqueado | Preservar diferencia con desbloqueado y seleccionado; no trasladar opacity .30/.35 + brightness .55/.6 + grayscale/sepia sobre blanco. Etiqueta y candado legibles. |
| Perfil, suscripción y modal de pagos | Tematizar campos, tarjetas, avisos, plan y botones sin cambiar datos ni borradores. El contenido de pagos simulado sigue simulado. |
| Banner live y padding inferior | Mantener navegación, prioridad de aviso y reserva de espacio para podcast; comprobar safe-area y teclado. |

### 7.2 Comunidad: `src/components/feature/community/`

| Archivo | Adaptación requerida | Preservar |
|---|---|---|
| `CommunityFeed.tsx` | Hero, textura puntos, glows, filtros sticky, stats, skeletons, vacíos y categorías. | Filtro/orden recent-popular, selección, realtime, sortPill layoutId y reordenamiento. |
| `PostCard.tsx` | Pin/no pin, card, avatar, admin badge, timestamps, body, acciones y menú propio. Su menú NO se arregla solo migrando Dropdown. | Permisos, propagación de clicks, truncado/expansión, imagen y hover. |
| `PostDetail.tsx` | Editor, reply banner, contadores, árbol/respuestas, líneas, avatar y destructivos. | Reply target, foco, draft, realtime y optimismo. |
| `NewPostDialog.tsx` | Gradiente, header/footer, inputs, contador y categorías. | Scroll interno/footer pegado, pin admin, catActive layoutId, loading y datos escritos. |
| `PostImageUploader.tsx` | Dropzone vacía, ayuda, borde/error y preview. Overlay eliminar sobre imagen conserva contraste multimedia. | Validación, tipos/tamaño, object URL y upload. |
| `LikeButton.tsx` | Neutro, activo, relleno, ring/shadow; acento claro contrastado. | aria-pressed, count, optimismo/reversión, spring y burst. |
| `community-utils.ts` | Crear equivalentes temáticos de CATEGORIES (texto/fondo/borde/acento); blue/purple/emerald 200/300 no son texto claro automáticamente. | IDs, orden, iconos, etiquetas y helpers. |

## 8. Reproducción, lives y chat: contrato de no regresión

Antes de trabajar en estos archivos, leer nuevamente las arquitecturas de [podcast](PODCAST_ARCHITECTURE.md) y [grabaciones](RECORDINGS_ARCHITECTURE.md), y contrastarlas con el código actual. Si difieren, no modificar comportamiento basándose solo en prosa histórica.

| Archivo | Qué cambia visualmente | Qué no puede cambiar por el tema |
|---|---|---|
| `src/components/feature/LessonPlayer.tsx` | Barra plan/podcast y modal retomar claros; lienzo, play, completado, anuncios, contador y overlays oscuros. | Identidad de Stream/UID, pendingSeek, progreso, mutex video/podcast, autoplay, frecuencia/omitir anuncio y callbacks. |
| `src/components/feature/GlobalPodcastPlayer.tsx` | Barra global clara, texto, sliders/tracks/thumb, volumen, play/pause y completado; play oscuro con icono claro o marca + tinta oscura. | Es UI, no motor. Scrubbing, ±10s, close/flush, z100, dos filas móvil y safe-area; sin reiniciar spring o audio. |
| `src/components/feature/PodcastEngine.tsx` | Ningún cambio visual requerido. | Montaje global estable, iframe 320×180 fuera de pantalla/opacity .01, watchdog, MediaSession, audio auxiliar y guardas ended. No suscribir al tema. |
| `src/stores/player.store.ts` | Ninguno: tema vive en preferencias. | Clave de persistencia, progreso/volumen e isPlaying/hasEnded efímeros. |
| `src/pages/student/VIPLiveRoom.tsx` | Exterior y lista de conectados claros; escenario, countdown, intro, scanlines y scrims oscuros; chat adaptado. | Layout móvil 50/50, 100dvh, presencia, unread, canales, polling y chat desktop montado aunque oculto. |
| `src/components/feature/LiveHLSPlayer.tsx` | Fondo negro permanece. | HLS nativo/hls.js, recuperación, watchdog, fullscreen, edge y dependencias de inicialización; tema no recarga manifest. |
| `src/components/feature/LivePlayerControls.tsx` | Controles blancos sobre scrim; menú calidad/latencia oscuro con scope explícito en portal. | Autohide 3s, spinner 1.5s, mute, calidad, latencia, gestos, z-index y fullscreen. |
| `src/components/feature/RecordingPlayer.tsx` | Marco claro, lienzo negro y mensajes coherentes con su superficie. | Fuente R2/legacy, URL firmada y src estable; CSS padre no controla interior del iframe. |
| `src/components/feature/LiveChat.tsx` | Shell/header/footer/input, timestamps y skeletons. Propio: oro + tinta oscura; ajeno: neutro; sistema: ámbar legible. | Draft, mensajes, suscripción única, callback ref, autoscroll, data-lenis-prevent y entrada .2s. |

**Publicidad fullscreen:** LessonPlayer utiliza Popover API sobre el mismo nodo. No crear un portal alternativo, duplicar iframe ni cambiar su key para aplicar tema. Preservar top-layer, Escape y scroll lock.

**Live en Android:** el fade de entrada es una capa separada del video. No animar opacity del video ni añadir filtros/transformaciones al contenedor como transición temática. Mantener la solución de estabilidad existente.

**Estado de retomo:** los tests actuales incluyen retomar una lección marcada completada y excluir una vista hasta el final. No reintroducir la regla documental simplificada “solo no completadas” al modificar el modal.

## 9. Administración

### 9.1 Shell y páginas

| Archivo | Adaptar | Preservar / comprobar |
|---|---|---|
| `src/components/layout/AdminLayout.tsx` | Radial #121212/#1a1710/#0a0a0a, grid #ffffff0a, sidebar/topbar, Sheet, avatar, halo del cursor, logo y sombras. | Sidebar .5s, nav activo/shimmer, orbes, navegación, breakpoints y scroll con data-lenis-prevent. |
| `src/pages/admin/AdminMetrics.tsx` | KPIs, selector periodo, vacíos y gráfico. Recharts: grid #ffffff10, eje #A3A3A3, serie Individual #E5E5E5, Tooltip #0a0a0a/white requieren tokens explícitos. | Filtros/datos, altura responsive de gráfico, diferenciación de series por leyenda y trazo; tooltip legible. No recrear chart por key temática. |
| `src/pages/admin/AdminContentManager.tsx` | Header, StatPill, skeletons locales, EmptyDetail y números. | Selección, CRUD, publicación y estados guardando/guardado. |
| `src/pages/admin/AdminLiveManager.tsx` | Form, salas, finalizados, badges OBS/pausa/estado, imagen, renombre y diálogo de grabaciones; date fuerza `[color-scheme:dark]`: adaptar. | scheduled/live/paused/ended, preset/personalizado, zona horaria, activación, webhook/polling, R2 y permisos. Video negro, marco temático. |
| `src/pages/admin/AdminUsers.tsx` | Search, filtros, tabla/cards, roles/planes, activo/suspendido y menú. Modal artesanal de cambio de plan requiere migración propia. | Búsqueda, contadores y confirmaciones; backdrop negro y panel claro separados, AnimatePresence scale .9→1. |
| `src/pages/admin/AdminUserDetail.tsx` | Perfil, tarjetas, progreso, historial, plan, destructivos y vacíos. | Datos/autorización, borrador del plan y entrada opacity/y. |
| `src/pages/admin/AdminSettings.tsx` | Tabs, InputRow, ToggleRow, InfoBox, ayuda, preview, avisos y bloque marca Stripe. | Dirty/save/discard, estados no conectado/pendiente y transiciones .2s. Tema NO es setting comercial global. |
| `src/pages/admin/AdminSponsors.tsx` | Selección, cards, preview logo, peso/activo, formularios, videos y progreso. | Logos originales, reglas de pauta, impressions, TUS y guardado. |
| `src/pages/admin/AdminVideoUpload.tsx` | Form, select overrides, dropzone, archivo y encoding/disabled. | Archivo latente no ruteado: no habilitar navegación nueva; conservar comportamiento si vuelve a usarse. |

### 9.2 Componentes de contenido y marca

Prefijo `src/components/feature/`.

| Archivo | Adaptación / contrato |
|---|---|
| `admin-content/ModulesSidebar.tsx` | Búsqueda/placeholder, superficie, hover/selección, orden/vacíos; preservar scroll y disabled mientras guarda. |
| `admin-content/ModuleDetail.tsx` | Divisores, publicación, planes, video/sin video, destructivos y drag; conservar Reorder, escala 1.015, handle, commit al soltar y orden optimista. |
| `admin-content/ModuleFormSheet.tsx` | Inputs, errores, separadores y footer; mantener dirty, crear/editar, validación, scroll y submit. |
| `admin-content/LessonFormSheet.tsx` | Dropzone normal/drag/archivo, video vinculado, progreso y footer; no reiniciar TUS ni selección de archivo por tema. |
| `admin-content/PlansSelector.tsx` | Variantes texto/fondo/borde/check de PLAN_STYLES y PLAN_BADGE_STYLES; conservar free verde, individual azul y VIP violeta de este selector, multiselección y etiqueta. |
| `admin/LogoUploader.tsx` | Preview, vacío, enlace, error y loader; no invertir imágenes, conservar validación/upload. Si logo claro pierde detalle, mostrar soporte contrastado. |

## 10. Animaciones y efectos que se deben conservar

La tematización modifica color, opacidad ambiental y sombra cuando sea necesario; no la duración, trayectoria, orden ni disparador del movimiento. Documentar cualquier excepción de accesibilidad detectada como corrección específica, no como excusa para rediseñar animaciones.

| Sistema | Contrato |
|---|---|
| `MotionProvider.tsx` | Mantener preferencia del usuario + prefers-reduced-motion; Lenis solo desktop y sin reduce, duración 1.1, cleanup y rAF actuales. |
| `useParallax.ts` | Mantener factor desktop 1, móvil .4 por defecto y reduce 0; spring móvil y MotionValues existentes. Cambiar tema no recrea progreso. |
| `routes.tsx` | Opacity .3s únicamente. Prohibido blur/transform de rutas por regresión de fixed/fullscreen. |
| Hero | Mantener parallax aurora +22%, texto +90px y foto −55px según factor; reveals, shimmer 6s, foto 6s, pulso 5s e indicador 1.8s. Adaptar el tramo claro del shimmer para que no desaparezca sobre marfil. |
| Aurora | Mantener luces desktop 18/26/30s y una luz estática móvil. La intensidad clara se calibra sin manchar texto ni convertir el fondo en amarillo. |
| Partículas | Mantener presupuesto actual, pausa fuera de viewport y frame estático. Color resuelto no implica reconstruir toda la simulación. |
| Awakening / inteligencias / camino | Mantener palabra por palabra, count-up, sticky y trayectoria horizontal, fill de timeline y alternativas estáticas. |
| Certificados | Mantener spotlight 40s, flotación/rotación 7s, reflejos y filtros de bloqueados dentro de vitrina oscura. |
| Comunidad / admin | Mantener layoutId, hover/tap, springs, stagger y drag. No cambiar keys por tema. |
| Skeletons / load / toasts | Mantener feedback; variante clara debe ser visible incluso con movimiento reducido, sin depender del brillo animado. |

En `src/index.css`, conservar `html[data-reduce-motion="true"]` y la protección de pointer-events de iframes durante Lenis. No agregar `transition: all` global. El shorthand de un nuevo fondo no debe sobrescribir máscaras, background-size o múltiples capas existentes.

Los MotionValues de scroll y los bucles canvas no quedan cubiertos automáticamente por MotionConfig; respetar sus guardas propias. Probar modo simple y preferencia SO: texto y acciones quedan disponibles aunque no se complete una animación.

## 11. Orden de implementación y entregables

| Fase | Responsable funcional | Entrega concreta | Puerta de salida |
|---|---|---|---|
| 0. Referencia | Diseño + QA | Capturas oscuras por ruta/estado y fixtures autorizados para alumno/admin; inventario de assets. | Registro de cobertura y problemas previos separado de regresiones. |
| 1. Fundaciones | Frontend de tema | Tokens semánticos con equivalentes oscuros fieles, resolución/persistencia/arranque y contrato multimedia. | Oscuro sin cambios visuales; storage viejo/dañado y primer paint aprobados. |
| 2. Compartidos | Frontend UI | Primitivos, Header/Footer, splash/error, controles y Toaster; selector todavía sin lanzamiento público. | Portales, teclado, inputs y estados claros/oscuros correctos. |
| 3. Públicas | Frontend de experiencia pública | Todos los actos, auth, editor y páginas públicas. | No quedan bandas negras accidentales ni gradientes ilegibles; coreografía preservada. |
| 4. Alumnos y multimedia | Frontend de aprendizaje | Dashboard, notas, certificados, comunidad, chat y envoltorios multimedia. | Cambio de tema sin perder reproducción, draft, scroll ni presencia. |
| 5. Administración | Frontend admin | Todas las páginas, CRUD visual, uploads, charts y estados. | Edición/upload sin interrupción y gráfico accesible. |
| 6. Cierre | QA + responsable del producto | Matriz completa, revisión visual y activación del selector. | Ninguna ruta activa incompleta; oscuro y claro aprobados. |

Cada fase entrega una unidad revisable con sus verificaciones y documentación vinculadas al cambio. Evitar una sustitución masiva de clases en un único paso. Si se usan PRs, dividir por estas dependencias y tamaño de revisión; no publicar una mezcla de rutas listas y pendientes.

**Reversión:** mientras se migra, la experiencia pública sigue oscura. La resolución debe poder fijarse temporalmente a oscuro sin borrar preferencias de animación/latencia ni datos. Si se detecta regresión tras habilitar, retirar la disponibilidad del selector y volver al oscuro validado; conservar el historial y la preferencia para recuperación posterior. No basar rollback en limpiar localStorage de todos los usuarios.

Cuando se implemente, actualizar `docs/CHANGELOG.md` y `docs/PROJECT_STATE.md` con lo efectivamente terminado y pruebas reales. Este documento no marca el modo claro como hecho.

## 12. Matriz de aceptación y verificación

### 12.1 Cobertura requerida

| Eje | Casos mínimos |
|---|---|
| Tema | Oscuro, claro, Sistema resolviendo ambos; arranque nuevo y elección persistida. |
| Viewport | 320, 390, 768, 1024 y 1440px; pantalla ancha y móvil horizontal como controles adicionales. |
| Sesión | Anónimo, free, individual, VIP y admin. No fabricar sesiones ni modificar roles para revisar UI. |
| Movimiento | Cinematográfico activo, toggle apagado y SO reduce; aplicar en landing, auth, alumnos y admin. |
| Estado | Loading, vacío, error, normal, hover, focus, seleccionado, disabled y operaciones en curso donde existan. |
| Navegación | Todas las rutas reales, navegación interna, recarga directa y anclas de planes/FAQ/camino. |
| Contenido | Textos largos, logos transparentes/opacos, imagen ausente, datos reales o fixtures autorizados. |

### 12.2 Escenarios bloqueantes

- [ ] Primer paint ya tiene el tema correcto: body, AuthSplash, error y barras del navegador coherentes; sin destello contrario.
- [ ] Registro viejo de preferencias conserva animaciones/latencia; JSON inválido y storage bloqueado no rompen arranque.
- [ ] Sistema sigue al SO; selección explícita lo ignora. Dos pestañas se sincronizan sin loops ni remontajes.
- [ ] Cambiar tema con FAQ abierto, editor pendiente, modal, menú, formulario y nota escrita conserva su estado, selección y foco.
- [ ] En scroll intermedio de inteligencias, cambiar tema mantiene posición y acceso a las seis tarjetas; móvil y modo simple no quedan atrapados en sticky.
- [ ] Header sobre cada fondo y durante scroll sigue legible; selector no colisiona con logo/login ni FABs a 320px.
- [ ] Dialog, Sheet, Select, Dropdown y Tooltip muestran la paleta correcta; menú de live conserva el contexto multimedia incluso al portalarse.
- [ ] Toast success/error/info/warning, descripción, acción y cierre legibles en ambos temas; ningún `!` retiene oscuro accidental.
- [ ] Input, caret, autofill, placeholder, error y disabled correctos; datetime-local y select nativo coherentes; editor de titulares no fuerza blanco en claro.
- [ ] Texto normal, enlaces, iconos funcionales, gráficos y foco cumplen contraste sobre el fondo compuesto; medir también durante shimmer/hover.
- [ ] Logo, foto y miniaturas conservan color; no hay filtros globales de inversión ni bordes/fondos oscuros residuales.
- [ ] Lección, podcast, anuncio normal/fullscreen, live y recording mantienen nodo/fuente, tiempo, volumen y estado al alternar; no hay reload causado por tema.
- [ ] Retomo, cambio video↔podcast, fin de lección y persistencia de progreso siguen funcionando.
- [ ] Live cubre cargando, sin evento, programado/countdown, intro, reproduciendo, buffering, pausa, finalizado y sin input; chat propio/ajeno/sistema, unread y conectados correctos.
- [ ] Certificados 0/parcial/100%, bloqueado/desbloqueado/seleccionado y sin imagen mantienen jerarquía y legibilidad.
- [ ] Comunidad cubre categorías, recent/popular, pin, imagen, post extenso, comentarios/respuestas, likes y permisos; draft no se pierde.
- [ ] Admin cubre gráfico/tooltip/vacío, filtros, tablas/cards móviles, cambio de plan, settings dirty, drag reorder, upload y archivado; no se ejecutan acciones reales solo para producir capturas.
- [ ] Scroll y teclado móvil no ocultan submit, chat ni controles; safe-area y barra podcast mantienen su reserva de espacio.
- [ ] Modo oscuro conserva diseño, geometría y coreografía de referencia; diferencias de color inesperadas bloquean entrega.
- [ ] No se modificaron reglas de negocio, seguridad, endpoints, contenido ni contrato de datos para tematizar.

### 12.3 Comprobaciones técnicas futuras

Después de cada unidad implementada: `npm run typecheck`, lint según archivos tocados y tests dirigidos con `npx vitest run <archivos>`. **Nunca usar `npm run build` como verificación.** Esta auditoría documental no ejecutó tests de la aplicación porque no modificó su código.

Reutilizar las regresiones existentes de `LessonPlayer.test.tsx`, `PodcastEngine.test.tsx`, `GlobalPodcastPlayer.test.tsx`, `LiveHLSPlayer.test.tsx`, `admin-content/ModuleDetail.test.tsx`, `ui/skeleton.test.tsx`, `ui/empty-state.test.tsx` y `layout/ErrorBoundary.test.tsx` según el área tocada. No afirmar que esos tests actuales verifican tema: protegen comportamientos existentes.

Añadir pruebas de comportamiento para resolución/persistencia y cambio de tema sin remontar ni perder draft/reproducción. Para nuevos primitivos, seguir el contrato del repo de test adyacente. Complementar con contraste calculado, foco/teclado y comparación visual en navegador; jsdom no certifica colores compuestos, canvas, transiciones ni controles nativos.

Revisar remanentes con `rg`: `text-white`, `bg-black`, `bg-dark`, `bg-darker`, `border-white`, `divide-white`, `ring-white`, hex/rgb/rgba/oklch, `color-scheme`, `theme="dark"`, gradientes, `text-fill-color`, `stroke`, `fill`, `stopColor`, `shadowColor`, `mix-blend` y `mask`. **No exigir cero coincidencias:** cada remanente debe ser un token, una excepción multimedia/asset justificada o un pendiente explícito. La búsqueda no sustituye la revisión visual.

### 12.4 Hallazgos previos que no deben mezclarse con el tema

Se detectó id `planes` duplicado entre wrapper y PlansAct; documentación histórica que todavía menciona blur/WebRTC; y botón eliminar imagen de comunidad dependiente de group-hover. Registrar y evaluar por separado. También existe shimmer en `tailwind.config.js` pese a la regla de no agregar keyframes nuevos: conservar lo actual y no ampliar ese patrón como parte del tema.

**Definición de terminado:** todas las rutas y estados activos de este inventario tienen decisión visual implementada y evidencia de revisión en ambos temas; las excepciones oscuras están delimitadas; las pruebas funcionales no muestran regresiones; el responsable del producto aprobó la composición clara. Lo que no pudo verificarse debe quedar identificado, nunca marcado como aprobado por inferencia.

## Referencias del proyecto

- [Arquitectura de podcast](PODCAST_ARCHITECTURE.md): invariantes del motor y reproducción.
- [Arquitectura de grabaciones](RECORDINGS_ARCHITECTURE.md): R2, legacy y permisos.
- [Auditoría responsive](RESPONSIVE_AUDIT.md): contexto histórico y pendientes de dispositivos; contrastar con código actual.
- [Estado del proyecto](PROJECT_STATE.md): inventario histórico; no reemplaza verificación del checkout.

La memoria Engram no estuvo disponible en esta sesión. Los hallazgos y decisiones de la revisión quedan persistidos en este documento, sin modificar configuración del entorno.
