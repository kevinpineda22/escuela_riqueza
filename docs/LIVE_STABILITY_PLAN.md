# Plan de estabilización de Lives

> Estado: **pendiente de ejecución**. Fecha de auditoría: 2026-09-12.
> Ejecutar con la plataforma inactiva (sin live en curso).
> Origen: auditoría externa del sistema de lives, contrastada contra el código del repo.

---

## 1. Resumen

Los cortes reportados en los lives tienen al menos tres fuentes internas confirmadas
(no atribuibles a OBS, Cloudflare ni a la red del alumno):

1. Interrupciones autogeneradas por el reproductor (cambio de calidad, cambio de modo de latencia, desmontaje al pausar).
2. Sincronización de estado defectuosa entre Cloudflare y la sala (polling y webhook mal parseados).
3. Una política RLS que permite a cualquier usuario autenticado modificar los lives.

Estrategia acordada: **corregir defectos comprobados → medir una transmisión real → decidir cuánto rediseñar**.
No construir dashboards de salud ni reestructurar la arquitectura antes de medir.

---

## 2. Hallazgos verificados

| # | Hallazgo | Ubicación | Severidad | Verificado |
|---|---|---|---|---|
| H1 | Policy `FOR ALL TO authenticated USING (true) WITH CHECK (true)` sobre `lives`. Cualquier alumno logueado puede pausar, finalizar, editar o borrar un live. | `sql/migrate-lives-schema.sql:10` | 🔴 Crítico | En SQL del repo. **No confirmado** que esté desplegada así en Supabase. |
| H2 | El webhook evalúa `event.includes('connected')` antes que `'disconnected'`. `"live_input.disconnected"` contiene `"connected"` → un evento de desconexión se clasifica como conexión. | `api/stream/cloudflare-webhook.ts:82` | 🔴 Alto | Sí |
| H3 | El webhook lee `payload.event`, `payload.notificationName`, `payload.liveInput`, `payload.meta.liveInputUid`. El formato documentado de Live Notifications de Cloudflare usa `data.event_type` y `data.input_id`. Con el formato real, el parser devuelve `unknown` y no hace nada. | `api/stream/cloudflare-webhook.ts:57-92` | 🔴 Alto | Parcial: hay que capturar un payload real para confirmar el formato. |
| H4 | `live-input-status` evalúa `input?.status?.connected === true`. La documentación del endpoint describe `result.status` de otra forma (posiblemente texto `"connected"`, o un objeto con `current.state`). En cualquiera de los dos casos el campo `status.connected` no existe → `connected` es siempre `false`. | `api/stream/live-input-status.ts:56` | 🟠 Medio | Sí (el campo no existe). **Formato real de la respuesta: pendiente de confirmar** con una llamada a la API desde nuestra cuenta. |
| H5 | Cambio de calidad usa `hls.currentLevel = index`, que vacía el buffer. `nextLevel` cambia sin vaciar. | `src/components/feature/LiveHLSPlayer.tsx:106` | 🟠 Medio | Sí |
| H6 | `latencyMode` está dentro de la config de `Hls`. Cambiar de modo destruye y recrea el reproductor (reinicia reproducción). | `src/components/feature/LiveHLSPlayer.tsx:129-160` | 🟠 Medio | Sí |
| H7 | `showIframe = !isPaused && ...` desmonta el reproductor cuando `is_paused = true`. Se pierde buffer, volumen y contexto; al volver puede requerir otra interacción para audio. | `src/pages/student/VIPLiveRoom.tsx:129` | 🟠 Medio | Sí |
| H8 | Recuperación ante errores repite recargas completas con protección de 4 s pero sin límite total ni backoff progresivo. Puede entrar en ciclo de recarga. | `src/components/feature/LiveHLSPlayer.tsx` (handler de `Hls.Events.ERROR`) | 🟠 Medio | Reportado por auditoría; confirmar leyendo el handler completo antes de tocar. |
| H9 | "Activar audio" oculta el aviso antes de confirmar el resultado de `play()` y descarta errores. Puede quedar sin sonido sin explicación ni reintento. | `src/components/feature/LivePlayerControls.tsx` / `LiveHLSPlayer.tsx` | 🟠 Medio | Reportado por auditoría; confirmar. |
| H10 | Botón "EN VIVO" siempre busca `liveEdge - 8`, aunque el modo `low` apunta a 3 s. Pulsarlo en modo `low` aumenta el retraso. | `src/components/feature/LivePlayerControls.tsx:114` | 🟡 Bajo | Sí |
| H11 | Chat: carga todo el historial sin paginación; una query a `profiles` por cada mensaje entrante; fuerza scroll al final aunque el usuario esté leyendo arriba; borra el borrador antes de confirmar el envío. | `src/components/feature/LiveChat.tsx:71-130` | 🟡 Bajo | Sí (queries y scroll). Resto reportado. |
| H12 | Polling (3 s sala, 10 s Cloudflare) + Realtime sin protección contra respuestas antiguas. Una respuesta lenta puede pisar un estado más nuevo. | `src/pages/student/VIPLiveRoom.tsx` | 🟡 Bajo | Reportado por auditoría; confirmar. |
| H13 | Camino nativo de Safari/iPhone (sin hls.js) no tiene la lógica de recuperación. | `src/components/feature/LiveHLSPlayer.tsx` | 🟡 Bajo | Reportado por auditoría; confirmar. |
| H14 | En móvil, tocar el video para mostrar controles también alterna play/pause. | `src/components/feature/LivePlayerControls.tsx` | 🟡 Bajo | Reportado por auditoría; confirmar. |

---

## 3. Plan de trabajo por paquetes

### Paquete 0 — Verificaciones previas (sin cambiar código)

- [ ] **RLS desplegada**: en Supabase → Authentication → Policies → `lives`. Confirmar si existe `"Allow all for authenticated on lives"`.
- [ ] **Respuesta real de Cloudflare**: llamar a `GET /accounts/{id}/stream/live_inputs/{input_id}` con el token de la cuenta y guardar el JSON de `result.status` con OBS conectado y con OBS desconectado. Esto define el fix de H4.
- [ ] **Payload real del webhook**: apuntar temporalmente el webhook del Live Input a un endpoint de captura (o loguear `rawBody` en el handler actual) y conectar/desconectar OBS. Esto define el fix de H3.
- [ ] **Autenticación del webhook**: confirmar que el header y el formato de firma que valida `cloudflare-webhook.ts` coinciden con lo que Cloudflare envía para Live Notifications (puede diferir del webhook de `video.ready`).

### Paquete 1 — Seguridad (H1)

- [ ] Reemplazar la policy de `lives` por:
  - `SELECT` para `authenticated` (o `public` si la landing lo requiere).
  - `INSERT / UPDATE / DELETE` solo si `profiles.role = 'admin'` para `auth.uid()`.
- [ ] Revisar con el mismo criterio las policies de `storage.objects` (`backgrounds`) y `live_messages`.
- [ ] Aplicar en Supabase y actualizar `sql/migrate-lives-schema.sql` para que el repo refleje lo desplegado.
- [ ] Verificar desde una cuenta no-admin que no puede modificar `lives`.

### Paquete 2 — Sincronización Cloudflare ↔ sala (H2, H3, H4)

- [ ] `live-input-status.ts`: parsear el formato real capturado en Paquete 0.
- [ ] `cloudflare-webhook.ts`: reescribir `parseEvent` contra el payload real. Comparar nombres completos de evento (`=== 'live_input.connected'`), no substrings. Cubrir con tests unitarios de `parseEvent` usando payloads reales.
- [ ] Antes de activar el webhook corregido: asegurarse de que H7 esté resuelto. Un webhook que empieza a funcionar bien va a marcar `is_paused = true` en cada microcorte de OBS, y hoy eso desmonta el reproductor de todos los alumnos.

### Paquete 3 — Reproductor: eliminar interrupciones autogeneradas (H5–H10)

- [ ] H5: `currentLevel` → `nextLevel`.
- [ ] H10: "EN VIVO" debe usar el `liveSyncDuration` del modo activo (3 u 8), no un 8 fijo.
- [ ] H7: al pausar, mantener el `<video>` montado. Mostrar overlay "Transmisión pausada" y **pausar el elemento de video explícitamente** (no solo taparlo: si se tapa visualmente, el audio sigue sonando). Distinguir dos casos:
  - Pausa deliberada del admin → video pausado + overlay.
  - Reconexión / microcorte → overlay "Reconectando…" conservando buffer, sin pausar.
- [ ] H8: límite total de recargas y backoff progresivo (ej. 1 s, 2 s, 4 s, 8 s, tope). Al agotar, mostrar estado de error con botón de reintento manual.
- [ ] H9: "Activar audio" debe esperar el resultado de `video.play()`; si rechaza, mantener el aviso y ofrecer reintento.
- [ ] H6: evaluar si el cambio de modo de latencia se puede hacer sin recrear `Hls`. Si no, aceptarlo y documentarlo como operación disruptiva en la UI (o quitar el selector del alumno).
- [ ] Respetar la intención del alumno: ninguna recuperación debe reanudar un video que el alumno pausó a propósito.
- [ ] Tests: ampliar los tests existentes del reproductor para cubrir estas transiciones.

### Paquete 4 — Medición (antes de decidir cualquier rediseño)

No hace falta un dashboard. Alcanza con registrar en consola o en un endpoint mínimo:

- Tiempo hasta el primer frame.
- Cantidad y duración de eventos de buffering.
- Recargas por sesión y su motivo.
- Latencia estimada (`liveEdge - currentTime`).
- Errores de `Hls.Events.ERROR` con `type` y `details`.

Hacer una transmisión de prueba antes y otra después de los Paquetes 1–3, en Chrome/Android y Safari/iPhone, y comparar.

### Paquete 5 — Chat y estados (H11–H14) — solo si la medición lo justifica

- Chat: paginación del historial, caché de autores, scroll condicionado a "estaba abajo", envíos con estado pendiente/fallido, recuperación de mensajes perdidos tras reconectar.
- Separar los estados: decisión del admin (publicada / pausada / finalizada), conexión de OBS, reproducción del alumno. Que un microcorte de OBS no equivalga a una pausa editorial.
- Guardas contra respuestas antiguas en polling (token de secuencia o timestamp).
- Recuperación para el camino nativo de Safari.
- Tap en móvil: primer toque revela controles, no alterna play/pause.

---

## 4. Fuera de alcance (por ahora)

- Panel de "salud de transmisión" con porcentajes, bitrate, alumnos conectados, buffering promedio. Requiere telemetría que no existe; se decide después del Paquete 4.
- Migrar OBS a WHIP para latencia sub-segundo. Primero estabilidad, después latencia.
- Revisar el keyframe de OBS (el repo recomienda 1 s; Cloudflare sugiere 2–8 s, empezando por 4 para diagnosticar). Contrastar con métricas reales antes de cambiar la guía.

---

## 5. Advertencias

- Nada de lo anterior demuestra qué porcentaje de los cortes viene del código vs. OBS / Cloudflare / red del alumno. Eso solo lo dice la medición del Paquete 4.
- Las estimaciones de esfuerzo ("pocas líneas") aplican a los fixes puntuales, no a la validación. Cada cambio en el reproductor necesita prueba en Safari/iPhone además de Chrome.
- El antecedente de errores HTTP 413 sigue sin causa confirmada.
- Antes de tocar `LiveHLSPlayer`, `VIPLiveRoom` o `LivePlayerControls`: leer `docs/CHANGELOG.md` (entradas de lives) y `docs/PODCAST_ARCHITECTURE.md` si hay interacción con el player global.
