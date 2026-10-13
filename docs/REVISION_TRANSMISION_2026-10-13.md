# Revisión de cambios de transmisión — 2026-10-13

> Para: Johan. Revisión de los commits `090a46a` y `8d2d0ad` (PR #108 y #109).
> Correcciones en los commits `11de2b3` (código) y `85198a0` (documentación), rama `juan`.

## Resumen

Los cambios de transmisión están bien encaminados: se integraron sin romper los arreglos del reproductor del PR #107 y pasan los tests (520). La revisión encontró datos de la documentación que contradicen mediciones ya hechas en producción y cuatro bugs menores en el código nuevo. Todo quedó corregido:

| Commit | Qué corrige |
| --- | --- |
| `11de2b3` | Retroceso de a 10 s que nunca se guardaba, salto hacia adelante que caía en el filo, atajos con el menú abierto, tests faltantes |
| `85198a0` | `OBS_CONFIGURACION.md`, `PENDIENTES.md`, `PROJECT_STATE.md`, `LIVE_STABILITY_PLAN.md` y `CLAUDE.md` §7.4 con lo medido el 2026-10-10 |

Lo más importante para el ensayo de calidad: **el bitrate no es la palanca principal** (ver la sección siguiente).

## Calidad: el techo de 720p lo pone OBS, no el bitrate

Subir a 8000 o 10.000 kbps con OBS enviando 720p mejora poco: Cloudflare entrega como máximo la resolución que recibe. El 2026-10-10 la entrada de las tres grabaciones del vivo fue 1280×720 y el nivel más alto que recibieron los alumnos fue 720p.

| Dato medido el 2026-10-10 | Fuente | Implicación |
| --- | --- | --- |
| Entrada 1280×720 en las tres grabaciones | API de Cloudflare Stream | El techo de calidad es la salida de OBS |
| Nivel más alto entregado: 720p | Player en producción | No existe un nivel 1080p que el alumno pueda elegir |
| Segmentos de 8,33 s (`EXTINF`) | Manifiesto HLS en vivo | El perfil activo tenía el keyframe en automático, no en 2 s |
| `recording.timeoutSeconds` = 300 | API de Cloudflare (Live Input) | El 60 del script no es el valor desplegado |

Orden propuesto para el ensayo:

1. Corregir el perfil de OBS que se usa de verdad: keyframe 2 s, CBR, B-frames 0.
2. Si la cámara o la captura lo permiten, pasar la salida de OBS a 1080p.
3. Recién entonces comparar 6000 → 8000 → 10.000 kbps, con el plan de la sección 5 de `OBS_CONFIGURACION.md`.

Con keyframe de 2 s, 10.000 kbps da fragmentos de unos 2,5 MB, lejos del límite de 10 MB que causó el incidente del 2026-10-03.

## Correcciones a la documentación

Varias afirmaciones quedaron como «sin comprobar» cuando ya estaban medidas; se corrigieron sin quitar el plan de ensayo. Antes de marcar algo como pendiente, conviene buscar en `CHANGELOG.md` y en `RECORDINGS_ARCHITECTURE.md`: ahí están las mediciones del vivo del 2026-10-10.

| Documento | Decía | Ahora dice |
| --- | --- | --- |
| `OBS_CONFIGURACION.md` §1 y §5 | No hay un tope de 720p verificado | Verificado: entrada 1280×720 y 720p entregado; el techo es la salida de OBS |
| `OBS_CONFIGURACION.md` §5 | El script propone `timeoutSeconds` 60, valor desplegado sin demostrar | Desplegado: 300 s (verificado por API; cambiado el 2026-09-19) |
| `OBS_CONFIGURACION.md` §5 | Perfil activo de OBS sin comprobar | El 2026-10-10 enviaba segmentos de 8,33 s: keyframe automático |
| `OBS_CONFIGURACION.md` §5, plan de ensayo | Empezaba por el bitrate | Primer paso: salida de OBS en 1080p antes de evaluar 8000/10.000 kbps |
| `CLAUDE.md` §7.4 | Default «Fluidez»; Clase completa con ~14,6 s de atraso | Default «Clase completa» sin preferencia guardada; atraso según el keyframe (~6–14 s con 2 s; 25–39 s con 8,33 s) |
| `LIVE_STABILITY_PLAN.md` | Keyframe de 1 s, contrastar antes de cambiar la guía | La guía exige 2 s desde el incidente del 2026-10-03 |
| `PENDIENTES.md` §8 y `PROJECT_STATE.md` | Todo el perfil y la salida sin comprobar | Separado lo verificado de lo pendiente (prueba de salida 1080p) |

## Bugs en el código nuevo

Ninguno bloqueaba el merge; los cuatro quedaron arreglados en `11de2b3`, con tests que fallan contra el código anterior.

| Bug | Escenario | Arreglo |
| --- | --- | --- |
| Retroceder de a 10 s nunca se guardaba para retomar | `SEEK_STEP_S` = 10 y la condición era `> DELIBERATE_REWIND_MIN_S` (10): un salto de exactamente 10 s nunca cuenta, y el ancla se reiniciaba en cada salto. Seis veces −10 s y salir = sin «Retomamos donde lo dejaste» | Los retrocesos consecutivos se acumulan desde un ancla (`rewindAnchor`); un −10 s aislado sigue sin contar |
| +10 s cerca del vivo caía en el filo exacto | `clampToSeekable` llevaba al final de `seekable`, con buffer cero; se queda cargando y puede disparar una recarga | `seekBy` nunca pasa la posición de sync de hls.js (`getLiveSyncTarget`) |
| +10 s en pausa reanudaba el video | El primer arreglo reutilizaba `goLive()`, que llama a `play()` | El salto solo mueve la posición; no toca la pausa del usuario |
| Teclas k/m/f con el menú abierto en pantalla completa | Pausaban o silenciaban mientras el menú estaba abierto | Los atajos se ignoran si el foco está dentro de `[role="menu"]` |

También se agregaron los tests que faltaban: el nuevo default `dvr` de `preferences.store` (valores inválidos, valores guardados que se respetan) y `usePendingClass` (umbral de 45 s, modos que no son `dvr`).

## Recomendaciones para los próximos cambios

- **Mensajes de commit que describan el cambio.** «transmision en 1000kbps» no corresponde a nada del commit (no hay ningún perfil a 1000 kbps) y confunde a quien lea el historial. El repo usa commits convencionales: `fix(lives): …`, `feat(lives): …`, `docs(lives): …`.
- **Un commit por tema.** `090a46a` mezcla reproductor, comunidad y documentación en 33 archivos; separado se revisa y se revierte mucho más fácil.
- **Contrastar la documentación con lo ya medido** antes de marcar algo como «sin comprobar»: `CHANGELOG.md`, `RECORDINGS_ARCHITECTURE.md` y `OBS_CONFIGURACION.md` tienen las mediciones de producción.
- **Un test por cada caso nuevo del reproductor**, y comprobar que falle con el código anterior. Los dos bugs de `seekBy` habrían aparecido con un test de «−10 s varias veces» y otro de «+10 s cerca del vivo».
- **Constantes que se comparan entre sí, juntas.** `SEEK_STEP_S` y `DELIBERATE_REWIND_MIN_S` viven en archivos distintos con el mismo valor; ahí nació el bug del retroceso.

## Qué hacer ahora

- [ ] Leer las secciones de calidad y de correcciones; si algo de lo medido no coincide con lo observado, comentarlo en el PR.
- [ ] Revisar los commits `11de2b3` y `85198a0` antes de aprobar el PR de `juan` a `master`.
- [ ] Después del merge, actualizar la rama propia con `master` antes de seguir trabajando en el reproductor.
- [ ] Para el ensayo de calidad: verificar el perfil de OBS que se usa de verdad (keyframe 2 s) y probar la salida en 1080p antes de subir el bitrate.
