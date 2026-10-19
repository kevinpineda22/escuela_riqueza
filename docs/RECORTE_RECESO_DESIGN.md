# Recorte del receso antes de archivar — Diseño

> Quitar el receso (pantalla negra con logo, ~30 min) de la grabación del sábado **antes** de archivarla en R2, dejando **un único video**.
> Leer junto con `docs/RECORDINGS_ARCHITECTURE.md`: este diseño modifica el cron del Worker y el carril largo de GitHub Actions.

_Creado: 2026-10-19 · Estado: 🛠️ IMPLEMENTADO, sin desplegar ni probar con video real (ver §8)_

> **Detalles de la implementación que no estaban en el diseño:**
> - "Cambiar grabación" también vuelve la sala a `pending` con plazo nuevo: grabación nueva, revisión nueva. Si había un recorte en curso, la Action lo aborta porque el video vinculado ya no coincide.
> - El disparo del recorte lleva `mode: 'trim'` y la Action exige `trimming` en la base. Si la API devolvió la sala a `pending` porque se le perdió la respuesta del Worker, la Action aborta en vez de archivar completa.
> - Mientras la sala está `pending` o `trimming`, el botón "Archivar en R2" de la tarjeta se oculta: las acciones van en el panel de revisión (`RecordingReviewControl`).

---

## 1. Qué se quiere

Al terminar la clase, el admin revisa la grabación, marca dónde empieza y dónde termina el receso, y la repetición que se guarda en R2 es **un solo MP4 sin ese tramo**. Si nadie la revisa en **48 h**, se archiva completa, como hoy.

Descartado: los clips de Stream. La API de clip rechaza grabaciones de vivo, y además daría dos videos separados.

## 2. Hechos del sistema actual que condicionan el diseño

| Hecho | Dónde | Consecuencia |
|---|---|---|
| El cron archiva cada 10 min toda sala `ended` + `recording_stream_uid` + `archived_at` null | `worker/src/archive-helpers.ts` → `buildPendingLivesUrl` | Hay que frenarlo mientras la clase espera revisión |
| **No existe `ended_at`** en `lives` | comentario en `buildPendingLivesUrl` | El plazo de 48 h necesita columna propia |
| El carril largo ya baja el HLS de Stream con ffmpeg, verifica, sube a R2, registra y borra de Stream | `.github/workflows/archive-long-recording.yml` | El recorte es un paso más de ese carril, no infraestructura nueva |
| El HLS está disponible para cualquier duración (el MP4 de Stream no, >4 h) | idem | Toda clase recortada va por la Action, dure lo que dure |
| `replay_visibility` arranca en `'hidden'` | `sql/migrate-lives-replay-visibility.sql` | Mientras se revisa, ningún alumno ve la versión sin cortar |
| `handleFinalize` vincula la grabación al finalizar, y OBS puede seguir emitiendo | `AdminLiveManager.tsx` | El recorte exige el video en estado `ready` (la Action ya lo exige) |

## 3. Modelo de datos

Migración nueva `sql/migrate-lives-recording-review.sql`:

| Columna | Tipo | Significado |
|---|---|---|
| `recording_review` | `text` null, check en los valores de abajo | Estado de la revisión |
| `review_deadline_at` | `timestamptz` null | Hasta cuándo espera el cron. Se carga al finalizar: `now() + 48 h` |
| `trim_ranges` | `jsonb` null | Tramos a quitar, en segundos: `[{"start": 3600, "end": 5400}]` |

Estados de `recording_review`:

```
null        → sala vieja o sin revisión: el cron se comporta como hoy
pending     → esperando revisión (el cron NO la toca hasta review_deadline_at)
keep        → archivar completa (el admin eligió no recortar, o venció el plazo)
trimming    → recorte pedido; la Action es dueña de la sala (el cron NO la toca)
```

Cuando el archivado termina, el estado no se borra: queda como registro de lo que pasó. `trim_ranges` queda guardado como evidencia del corte.

v1 permite **un** tramo en la UI; la columna es una lista para no migrar si después se quiere cortar dos.

## 4. Flujo

```
Finalizar clase (AdminLiveManager)
  └─ status='ended', recording_review='pending', review_deadline_at=now()+48h
        │
        ├─ Admin abre "Revisar grabación" (pestaña Finalizados)
        │     ├─ "Archivar sin recortar" → recording_review='keep' → cron normal
        │     └─ "Recortar y archivar"   → api/stream/request-trim
        │            ├─ valida tramos contra la duración real (Stream)
        │            ├─ UPDATE condicional pending→trimming (+ trim_ranges)
        │            └─ Worker dispara la Action con live_id, video_uid, trim_ranges
        │                   └─ HLS → 2 tramos → 1 MP4 → verificar → R2 → registrar → borrar de Stream
        │
        └─ Nadie revisa en 48 h
              └─ cron: reclama pending→keep (condicional) y archiva completa como hoy
```

### 4.1 La carrera del minuto 47:59

El admin pide el recorte justo cuando vence el plazo y el cron toma la sala. Si los dos avanzan, el Worker copia el MP4 completo y **borra de Stream** mientras la Action intenta bajar el HLS.

Regla: **nadie trabaja sin reclamar antes la sala con un UPDATE condicional sobre `recording_review = 'pending'`**.

- Cron, plazo vencido: `PATCH ... recording_review=eq.pending` → `keep`. Si afecta 0 filas, la saltea.
- Pedido de recorte: `.eq('recording_review', 'pending').is('archived_at', null)` → `trimming`. Si afecta 0 filas: "La grabación ya se está archivando completa".

Exactamente uno gana. Es el mismo patrón que ya usa el webhook (condiciones repetidas en el UPDATE).

### 4.2 Filtro del cron

`buildPendingLivesUrl` suma:

```
&or=(recording_review.is.null,recording_review.eq.keep,and(recording_review.eq.pending,review_deadline_at.lt.<ahora ISO>))
```

`trimming` queda afuera siempre. `null` mantiene intactas las salas viejas.

El botón manual "Archivar en R2" equivale a "Archivar sin recortar": reclama `pending → keep` antes de llamar a `archiveOne()`.

## 5. El recorte en la Action

Se **generaliza** `archive-long-recording.yml` con un input opcional `trim_ranges` (JSON). Sin él, hace exactamente lo de hoy. Así hay un solo camino que sube a R2, registra y borra de Stream, sin duplicar esa lógica.

Pasos nuevos, entre "Pick the highest-resolution video stream" y "Verify the MP4":

1. **Validar `trim_ranges` en bash/jq**: `0 ≤ start < end ≤ duración`, tramos sin solaparse, y lo que queda dura al menos 60 s. Se re-valida aunque la API ya lo hizo: el workflow también se dispara a mano.
2. **Calcular los tramos que se conservan** (el complemento): `[0, start)` y `[end, duración)`.
3. **Extraer cada tramo sin re-encodear** a `.ts`:
   `ffmpeg -ss <ini> -to <fin> -i "$HLS_URL" -map 0:v -map 0:a -c copy -avoid_negative_ts make_zero parte_N.ts`
4. **Unir** con el concat demuxer en un MP4: `ffmpeg -f concat -safe 0 -i lista.txt -c copy -movflags +faststart "$LIVE_ID.mp4"`.

La clave en R2 no cambia (`recordings/<liveId>/<uid>.mp4`): la versión sin cortar nunca se sube, así que no hay nada que pisar. `buildRecordingKey` queda igual.

### 5.1 Precisión del corte

Con `-c copy` ffmpeg corta en el keyframe anterior. Con OBS en keyframe cada 2 s (`OBS_CONFIGURACION.md`), el corte cae hasta 2 s antes de lo marcado: la repetición puede mostrar un instante del logo en la unión. Para un receso es aceptable. Ojo: el 2026-10-10 el perfil activo seguía con keyframe automático (~8,3 s), y ahí el error sube a ~8 s. Sigue sirviendo, pero el perfil se verifica igual. Re-encodear para cortar al frame exacto cuesta horas de Action por clase: no.

### 5.2 Verificación (la lección del 2026-10-10)

"Verify the MP4" pasa a comprobar tres cosas:

- Duración total = duración original − tramos quitados, **±5 s** por tramo.
- Duración del **stream de audio** = duración del **stream de video**, ±1 s. Que ffmpeg decodifique sin errores NO detecta audio perdido.
- Que el MP4 tenga exactamente un stream de video y uno de audio.

Si algo falla, la Action termina con error **antes** de subir: Stream conserva el original y nada se borra. La sala queda en `trimming`, visible en el panel con "Reintentar" o "Archivar sin recortar".

## 6. Pantalla de revisión (admin)

En la pestaña Finalizados, una sala `pending` muestra **"Revisar grabación"** y cuánto falta para que se archive sola ("Se archiva completa en 31 h").

El modal:

- Reproductor con el HLS de Stream (`playback.hls`), con un `<video>` propio para leer `currentTime` directo. Si conviene reusar `LiveHLSPlayer` o `RecordingPlayer`, se decide al implementar.
- **"Marcar inicio del receso"** / **"Marcar fin del receso"**: toman el `currentTime` del reproductor. Al lado, campos `hh:mm:ss` editables para ajustar a mano.
- **"Ver el corte"**: salta 10 s antes del inicio y, al llegar, saltea al fin. Así se ve cómo va a quedar sin procesar nada.
- Resumen: "Duración original 4:05:12 → queda 3:33:40".
- Botones: **"Recortar y archivar"** (pide confirmación, no se deshace) y **"Archivar sin recortar"**.

El texto de la UI va en tú neutro (convención de la escuela, `scripts/voseo-scan.mjs`).

## 7. Piezas a tocar

| Pieza | Cambio |
|---|---|
| `sql/migrate-lives-recording-review.sql` | 3 columnas + check |
| `worker/src/archive-helpers.ts` | filtro del cron + helper puro para el reclamo condicional |
| `worker/src/index.ts` | reclamo `pending→keep` antes de `archiveOne()` cuando venció el plazo; endpoint que dispara la Action con `trim_ranges` (el `GITHUB_TOKEN` ya vive en el Worker) |
| `api/stream/request-trim.ts` (nuevo) | auth admin, validación de tramos, UPDATE condicional, llamada al Worker con el secreto compartido (mismo patrón que `archive-recording.ts`) |
| `.github/workflows/archive-long-recording.yml` | input `trim_ranges`, extracción + unión, verificación de audio |
| `src/pages/admin/AdminLiveManager.tsx` | `handleFinalize` carga `pending` + plazo; botón "Revisar grabación" |
| componente nuevo en `src/components/feature/admin-live/` | modal de revisión |
| `docs/RECORDINGS_ARCHITECTURE.md` | sección del recorte cuando esté hecho |

Tests: filtro del cron y reclamo condicional (`archive-helpers`), validación de tramos y cálculo del complemento (función pura compartida por la API), modal (marcar, editar, resumen, "Ver el corte").

## 8. Orden de deploy (importa)

1. **SQL primero.** Si sale el front antes, `handleFinalize` escribe columnas que no existen y **no se puede finalizar una clase**. Si sale el Worker antes, el filtro del cron da 400 y no se archiva nada.
2. Worker (`wrangler deploy` desde `worker/`).
3. Merge a master: API, Action y front.

### 8.1 Modo prueba (hacerlo ANTES de recortar una clase real)

La Action tiene un modo prueba: corta y une de verdad, pero sube a `recordings/_prueba/<video>-<modo>-<fecha>.mp4`, **no lee ni escribe la base y no borra de Stream**. Solo existe en el disparo manual: el Worker no puede pedir una prueba.

1. **Conseguir un video que siga en Stream.** Las clases archivadas ya no están ahí (se borran al pasar a R2). Lo más simple es subir un video desde el panel de Cloudflare Stream: por ejemplo, una clase bajada de R2. Ojo: Stream re-codifica lo que se sube, así que los keyframes pueden no ser los del vivo. La prueba más fiel es una transmisión corta de OBS con un tramo negro en el medio, pero hay que **finalizar antes la clase anterior y archivarla**: el webhook vincula una grabación nueva a la última sala `ended` sin archivar.
2. **La rama tiene que estar pusheada.** "Run workflow" usa el archivo de la rama que se elija en el desplegable.
3. GitHub → Actions → **Archive long recording** → **Run workflow**:
   - rama: la que tiene estos cambios
   - `live_id`: vacío
   - `video_uid`: el UID del video en Stream
   - `mode`: `trim`
   - `dry_run`: ✅
   - `trim_ranges`: el tramo a quitar en segundos, ej. `[{"start":600,"end":900}]`
4. El paso **Share the test recording** deja un link de 24 h. Revisar:
   - la unión: que no haya salto de audio ni imagen congelada;
   - que el audio siga sincronizado con la imagen **después** de la unión (lo que se rompió el 2026-10-10);
   - que la duración total sea la original menos el tramo, ±2 s.
5. Borrar el objeto de `recordings/_prueba/` desde el panel de R2.

Vale la pena correr también `mode: full` + `dry_run`: confirma que el carril de siempre sigue funcionando con los cambios.

## 9. Lo que se ahorra (sin inflarlo)

- **Para el alumno**: media hora menos de pantalla negra en cada repetición. Es la ganancia real.
- **R2**: ~30 min a 1080p son ~0,6 GB → centavos por mes.
- **Costo nuevo**: la clase espera en Stream hasta 48 h → ~240 min × 2 días ≈ USD 0,08 por clase. Y cada clase recortada usa ~30 min de Actions.

## 10. Decisiones (cerradas)

1. ✅ **Decidido 2026-10-19 (Johan): se borra de Stream apenas el recorte termina y se verifica**, igual que hoy. Sin respaldo ni barrido posterior. La red de seguridad es que la Action solo borra después de verificar duración, audio y streams, subir a R2 y registrar en la base.
2. ✅ **Decidido 2026-10-19 (Johan): toda clase arranca en `pending` al finalizar.** Si no hubo receso, "Archivar sin recortar" es un clic. Olvidarse de marcar era el error más probable.
