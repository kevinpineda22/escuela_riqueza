# Configuración de OBS para los vivos

> Para quien opera la transmisión. Con esta configuración Cloudflare Stream acepta el video sin problemas, aunque la escena tenga mucho movimiento.
> Incidente que la originó: clase del 2026-10-03 (ver `docs/CHANGELOG.md`).

> **Revisión documental: 2026-10-13.** 6000 kbps es la base recomendada del repositorio. Con mediciones del 2026-10-10 (API de Cloudflare y player durante el vivo de Iván) se corrigió que la resolución entregada está limitada por la que envía OBS: 1280×720 ese día. El ensayo a 8000/10.000 kbps de la sección 5 sigue pendiente y, para tener efecto en la resolución, requiere antes configurar la salida de OBS en 1080p. Esta entrega no cambia la configuración de transmisión.

---

## 1. Configuración obligatoria

En OBS: **Ajustes → Salida → Modo de salida: `Avanzado` → pestaña `Emisión`**.

| Ajuste | Valor | Por qué |
|---|---|---|
| Control de tasa | **CBR** | Tasa de bits constante. Con VBR/CQP la tasa sube cuando hay movimiento o poca luz, y puede superar el límite de Cloudflare. |
| Tasa de bits | **6000 kbps** como base conservadora | Deja margen ante variaciones de red. Medido el 2026-10-10: Cloudflare registró la entrada de las tres grabaciones de ese vivo en 1280×720 y el nivel más alto entregado a los alumnos fue 720p. **El techo de resolución es la que envía OBS**: subir a 8000/10.000 kbps sin subir la salida de OBS a 1080p aporta poco. Ver sección 5. |
| Intervalo de fotogramas clave | **2** (segundos) | **El ajuste crítico.** En `0` (automático) OBS genera un keyframe cada 250 cuadros (~8,3 s a 30 fps) y los fragmentos se vuelven enormes. El 2026-10-10 el perfil activo seguía enviando segmentos de 8,33 s (`EXTINF`), es decir, con el keyframe en automático pese a lo documentado: verificar el valor en el perfil que se usa. |
| B-frames | **0** | Requisito de Cloudflare para el modo "Baja latencia". |

⚠️ **Verificar que quede guardado en el perfil que se usa** (menú **Perfil** de OBS). Si se cambia en modo `Simple` o en otro perfil, no aplica.

### 1.1 Ajustes de estabilidad (agregados 2026-10-16)

Para que una clase de 3-4 horas no se corte:

| Dónde | Ajuste | Valor | Por qué |
|---|---|---|---|
| Salida → Emisión | Codificador | **Por hardware** si la PC lo tiene (NVIDIA NVENC H.264, Intel QuickSync H.264, Apple VT H.264); si no, x264 con preset `veryfast` | Codificar por hardware libera el procesador. Si el CPU se satura, OBS pierde cuadros y el video llega entrecortado a todos. |
| Salida → Audio | Tasa de bits de audio | **160 kbps**, AAC | Voz clara. Más no aporta en una clase. |
| Audio | Frecuencia de muestreo | **48 kHz** | La que espera Cloudflare. |
| Video | Resolución de salida / FPS | **1280×720, 30 fps** | Es lo que hoy entrega la plataforma (medido el 2026-10-10). Subir a 1080p queda para el ensayo de la sección 5. |
| Avanzado → Reconexión automática | Activada · Retraso **2 s** · Reintentos máximos **20** | Si el internet del lugar parpadea, OBS vuelve solo en segundos. Sin esto, alguien tiene que darle "Iniciar transmisión" a mano. |
| Avanzado → Red | **Cambiar la tasa de bits dinámicamente para gestionar la congestión**: activado | Ante congestión de red, OBS baja la calidad un momento en vez de cortar la transmisión. |

**Red y operación:**

- **Cable de red (Ethernet), no Wi-Fi.** Subida sostenida de al menos el **doble** de la tasa de bits: con 6000 kbps de video, mínimo **12 Mbps de subida estable**. Nadie más debe usar esa conexión para subir archivos o videollamadas durante la clase.
- **No detener la transmisión en los recesos.** Cada "Detener / Iniciar transmisión" corta el video a todos los alumnos y **parte la grabación en dos** (pasó el 2026-10-03). Para una pausa, mostrar una escena con el logo y dejar la transmisión corriendo.
- **Una sola sala por clase.** No finalizar la sala para crear otra durante la clase: cambia el link y los alumnos quedan afuera. Si hubo un problema, usar **Reactivar**.
- Durante la clase, mirar abajo a la derecha en OBS: el cuadrado de conexión en **verde** y "Cuadros perdidos" cerca de **0 %**. Amarillo o rojo = problema de internet del lugar, no de la plataforma.

**Modo del reproductor de los alumnos (automático desde el 2026-10-27):** el alumno ya no elige "modo". Todos miran en **Fluidez**, el más estable para clases largas; al retroceder en la barra (o con −10 s / flechas / doble toque) el reproductor pasa solo a **Clase completa** en ese punto, y "● EN VIVO" lo devuelve a Fluidez. Con el keyframe en **2 s** (decisión de Johan) la ventana DVR alcanza ~4 h (7.200 segmentos × 2 s); pasado eso, lo más viejo queda solo en la grabación. Cloudflare advierte degradación de Clase completa después de 3 h: con el modo automático solo la cargan quienes retroceden.

### 1.2 Audio: que se escuche bien (agregado 2026-10-28)

En una clase la voz manda: una imagen algo borrosa se tolera, un audio bajo, con eco o en un solo oído no. Casi todo lo que "se escucha mal" se arregla acá, en OBS, no en la web.

**Micrófono → clic derecho → Filtros**, en este orden (el orden importa: cada filtro recibe lo que deja el anterior):

| Orden | Filtro | Valores de partida | Para qué |
|---|---|---|---|
| 1 | Supresión de ruido | Método **RNNoise** | Quita ventilador, aire acondicionado y ruido de fondo. |
| 2 | Compresor | Relación **4:1** · Umbral **−18 dB** · Ataque **6 ms** · Liberación **60 ms** | Empareja la voz: lo que se dice bajito se oye y lo que se dice fuerte no aturde. |
| 3 | Limitador | Umbral **−1 dB** · Liberación **60 ms** | Tope de seguridad: un grito o un golpe al micrófono nunca distorsiona. |

Son valores de partida: ajustarlos de oído en el ensayo, con auriculares.

**Ajustes que suelen faltar:**

- **Mono en el micrófono.** Engranaje del mezclador → *Propiedades avanzadas de audio* → marcar **Mono** en el micrófono. Un micrófono es una sola fuente; sin esto, muchas interfaces lo mandan solo por el canal izquierdo y **el alumno con auriculares escucha la clase en un solo oído**.
- **Nivel.** Hablando normal, la barra del micrófono en el mezclador debe moverse en la **zona amarilla**; nunca tocar el rojo. Si se queda en verde, subir la ganancia en el micrófono o la interfaz (no en la web: allá cada alumno tiene su volumen).
- **Audio del escritorio silenciado** salvo que se muestre un video con sonido: si no, notificaciones y sonidos de la PC salen al aire.
- **Monitorear con auriculares**, nunca con parlantes cerca del micrófono: el sonido vuelve a entrar y se oye con eco.

**Del lado de los alumnos (desde el 2026-10-28):** la clase intenta arrancar **con sonido**; si el navegador lo bloquea (pasa en iPhone), arranca en silencio con el aviso "Activar sonido", y el primer toque en cualquier parte de la sala lo activa. El volumen que elige cada alumno se recuerda. En **Ajustes → Solo audio** la clase sigue sonando con el celular bloqueado, con la portada y el título en la pantalla de bloqueo (como Spotify).

En **Ajustes → Emisión**:

| Ajuste | Valor |
|---|---|
| Servicio | Personalizado |
| Servidor | `rtmps://live.cloudflare.com:443/live/` |
| Clave de retransmisión | La **RTMPS Key** del Live Input (Cloudflare → Stream → Live Inputs → `escuela-riqueza-live` → Broadcast). **No es el Live Input ID.** |

> 🔒 La clave de retransmisión es secreta: quien la tenga puede transmitir en el canal de la escuela. No compartirla por chat ni escribirla en documentos.

---

## 2. El límite que hay que respetar

Cloudflare rechaza cualquier fragmento de video de **más de 10 MB** (`segment size exceeds 10MB`). Cuando eso pasa, **nadie ve nada**, en ninguna calidad, aunque OBS diga que está transmitiendo y Cloudflare muestre "Connected".

```
tamaño del fragmento (MB) ≈ tasa de bits (Mbit/s) × duración (s) / 8
```

| Keyframe | Tasa de bits | Fragmento | Resultado |
|---|---|---|---|
| automático (~8,3 s) | 10,8 Mbit/s | ~11 MB | ❌ rechazado (lo que pasó el 2026-10-03) |
| automático (~8,3 s) | 6 Mbit/s | ~6,2 MB | ⚠️ funciona, pero sin margen si se usa VBR |
| **2 s** | **6 Mbit/s** | **~1,5 MB** | ✅ configuración recomendada |
| **2 s** | **10 Mbit/s** | **~2,5 MB** | Ensayo posible, pendiente de comprobar red, codificación y salida |

Son estimaciones del video, sin audio ni sobrecarga del contenedor; no garantizan el tamaño real. El error de 10 MB corresponde al incidente registrado, no al límite oficial de bitrate. Keyframes más frecuentes pueden reducir la espera, con menor eficiencia de compresión; el arranque depende también del manifiesto y el buffer del player.

---

## 3. Checklist antes de cada vivo

1. OBS: la configuración de la sección 1 está en el perfil activo.
2. Iniciar transmisión en OBS **antes** de la hora de inicio.
3. Cloudflare → Stream → Live Inputs → `escuela-riqueza-live`:
   - Estado **Connected**.
   - **Ingress bitrate** consistente con el perfil validado: cerca de 6 Mbit/s en la base; 8/10 Mbit/s únicamente durante el ensayo de la sección 5.
   - **GOP** muestra un valor (si dice `Unavailable`, el keyframe sigue en automático).
   - La **vista previa** muestra video (no se queda girando).
4. Panel de la escuela: la sala correcta está **activa** y su **Input ID** coincide con el Live Input al que transmite OBS.
5. Abrir el link de la sala en otra pestaña y confirmar que se ve.
6. **Audio:** hablar unos segundos con auriculares puestos en esa pestaña. Se escucha en **los dos oídos**, sin eco, y la barra del micrófono en OBS se mueve en amarillo (sección 1.2).

---

## 4. Si algo falla

| Lo que ve el alumno | Causa probable | Qué hacer |
|---|---|---|
| "Error de reproducción" y Cloudflare dice **Disconnected** | OBS no transmite o usa otra clave/servidor | Revisar el botón "Iniciar transmisión" y la sección **Emisión** de OBS. |
| Se queda cargando y Cloudflare dice **Connected** pero la vista previa gira | Fragmentos de más de 10 MB | Detener transmisión → aplicar la sección 1 → iniciar de nuevo. |
| Funciona y de golpe se corta unos segundos | OBS se desconectó y reconectó (red del lugar) | Mirar en OBS los cuadros perdidos y el indicador de conexión. Si está amarillo/rojo, es internet. Los alumnos recargan. |
| La voz se escucha en un solo oído | El micrófono no está en Mono | Sección 1.2: *Propiedades avanzadas de audio* → **Mono**. Se aplica al instante, sin cortar la transmisión. |
| La voz se escucha baja, o fuerte y distorsionada | Nivel o filtros del micrófono | Sección 1.2: barra en amarillo, compresor y limitador. |
| "La repetición es para alumnos" en un link que debería estar en vivo | La sala se **finalizó** | En el panel: Eventos en Vivo → Finalizados → **Reactivar**. No crear una sala nueva: cambia el link y la gente queda afuera. |

Después de cualquier corrección, los alumnos que ya vieron "Error de reproducción" deben tocar **Reintentar** o recargar la página.

---

## 5. Mejor calidad: ¿podemos transmitir a 10.000 kbps?

**Sí, es técnicamente viable como ensayo.** Cloudflare documenta una entrada combinada de video y audio entre **2 y 14 Mbps**, con recomendación habitual por debajo de 10 Mbps. 10.000 kbps de video + 160 kbps de audio son aproximadamente 10,16 Mbps: dentro del rango admitido, por encima de esa recomendación habitual. No implica que el alumno reciba ese bitrate ni que aumente la resolución. [Requisitos de Stream Live](https://developers.cloudflare.com/stream/stream-live/start-stream-live/).

### Qué está verificado y qué falta medir

| Evidencia | Conclusión |
|---|---|
| Guía y aviso del panel admin indican 6000 kbps | Es la recomendación del proyecto |
| 2026-10-10, API de Cloudflare: la entrada de las tres grabaciones de ese vivo fue 1280×720 y el nivel más alto entregado fue 720p | **Verificado**: el techo de resolución es la salida de OBS. Subir el bitrate sin subir la salida a 1080p aporta poco; una prueba a 1080p exige salida de OBS en 1080p (y ahí el bitrate mayor sí es relevante). Sigue sin probarse una salida de 1080p |
| 2026-10-10: el perfil de OBS activo enviaba segmentos de 8,33 s (`EXTINF`) | **Verificado**: keyframe en automático, no los 2 s documentados. Corregir el perfil antes de cualquier ensayo |
| 2026-10-10, mediciones del player durante el vivo | Fluidez con el sync fijo de 8 s anterior: 1-4 `waiting` por minuto con segmentos de 8,33 s. Clase completa: 0 stalls en 50 min, latencia 25-39 s con esos segmentos. Tras el commit 851c04e, Fluidez usa 3 segmentos (~6 s con segmentos de 2 s, ~25 s con 8,33 s) y la latencia de Clase completa depende de la duración del segmento (~6-14 s con 2 s; 25-39 s con 8,33 s) |
| El 2026-10-03 se registró entrada de 10,8 Mbps y fragmentos de 8,333 s rechazados | El fallo involucró bitrate **y** duración del fragmento. No demuestra que todo envío a 10 Mbps sea inválido |
| `LIVE_STABILITY_PLAN.md`, H5, registra un cambio histórico 480p → 1080p | Es un registro histórico; no certifica la salida actual (720p medido el 2026-10-10) |
| `LiveHLSPlayer.tsx` obtiene resoluciones del manifiesto y `LivePlayerControls.tsx` ordena esos niveles | El selector no crea una resolución que Cloudflare no entregue; no hay un límite fijo de 720p en estos componentes: el 720p observado viene de la entrada de OBS |
| Cloudflare transcodifica el live en varios niveles | Ingesta, niveles disponibles y nivel elegido por cada alumno son mediciones distintas. [ABR en Stream Live](https://developers.cloudflare.com/stream/stream-live/) |

**Comprobación necesaria (pendiente para 1080p):** capturar `RESOLUTION`, `BANDWIDTH`, codecs y fps del manifiesto maestro de una emisión controlada, tanto normal como DVR; contrastar con el nivel realmente reproducido. No guardar tokens, claves RTMPS ni URLs firmadas en el reporte. La [FAQ de Stream](https://developers.cloudflare.com/stream/faq/) recomienda 8 Mbps para **archivos subidos** a 1080p; esa tabla no demuestra un perfil live disponible en esta cuenta.

### Ensayo propuesto, con reversión

| Perfil | Video | Parámetros mantenidos | Uso propuesto |
|---|---|---|---|
| A — base | 6000 kbps | H.264, CBR, keyframe fijo 2 s, AAC, B-frames 0 | Referencia y reversión |
| B — primera comparación | 8000 kbps | Misma cámara, resolución, fps, escena y encoder que A | Comprobar si mejora texto y movimiento sin introducir cortes |
| C — comparación opcional | 10.000 kbps | Mismos parámetros que B | Solo si B es estable y todavía hay compresión visible |

1. Verificar perfil activo, resolución de captura/salida y encoder. **Configurar la salida de OBS en 1080p (si la cámara o captura lo soporta) antes de evaluar 8000/10.000 kbps**: con salida de 720p, como el 2026-10-10, más bitrate rinde poco. No ampliar artificialmente una fuente 720p. Mantener iluminación, foco, audio y tamaño legible de diapositivas: más bitrate no arregla esos problemas.
2. Medir subida sostenida por Ethernet en el lugar y horario de emisión. Como requisito inicial del ensayo, disponer de al menos 20 Mbps sostenidos y margen para otros usos; no alcanza un speedtest aislado. Cloudflare sugiere revisar ese umbral y un `Upload-to-Duration Ratio` por debajo de 90%. [Diagnóstico oficial](https://developers.cloudflare.com/stream/stream-live/troubleshooting/).
3. Ensayar cada perfil durante 30 minutos con la misma secuencia: rostro, diapositiva con letras pequeñas y movimiento. Registrar bitrate/GOP reales, bytes y duración de segmentos, cuadros perdidos por red, retrasos de codificación/renderizado, reconexiones y calidad recibida.
4. Comparar en escritorio y Safari/iPhone/Android, con Auto y calidad manual donde exista. Medir primer cuadro, tiempo en buffering, errores fatales, cambios ABR, nitidez y continuidad de DVR. Incluir una red móvil y una red limitada; forzar máxima calidad no será el default.
5. Hacer una sesión de duración real antes de adoptar el perfil. Para DVR, incluir más de tres horas si las clases pueden durar eso: Cloudflare advierte degradación en emisiones largas y un máximo de 7200 segmentos. [Límites de DVR](https://developers.cloudflare.com/stream/stream-live/dvr-for-live/).
6. Adoptar el menor bitrate que produzca una mejora visible y medible. Si no mejora, aparecen reconexiones/errores nuevos o aumenta el buffering respecto de A, volver al perfil base. No experimentar durante una clase de alumnos.

**Criterios propuestos de aceptación:** cero errores fatales nuevos en el ensayo, sin crecimiento sostenido de cuadros perdidos por red o codificación, ratio de subida estable por debajo de 90%, buffering no superior al perfil A y texto más legible a igual nivel de reproducción. Registrar resultados por dispositivo; estos criterios aún no fueron ejecutados.

### Tradeoffs que condicionan la decisión

- **6000 → 10.000:** aumenta cerca de 67% el bitrate de video enviado; puede reducir artefactos, pero exige más subida sostenida y trabajo de codificación. La transcodificación adaptativa determina lo que descarga cada alumno.
- **Keyframe:** mantener 2 s en este ensayo para aislar el efecto del bitrate y evitar repetir el incidente. La documentación general recomienda GOP de 4–8 s para HLS estándar y 2–4 s para LL-HLS: cambiar GOP sería otro ensayo, con compromiso entre compresión, tamaño de segmento y latencia.
- **Calidad vs interacción:** DVR prioriza repasar y retomar; baja latencia prioriza cercanía al vivo. Subir bitrate no elimina la latencia de captura/transcodificación/buffer. Mantener Auto y una salida a Fluidez para dispositivos o conexiones problemáticos.
- **Continuidad vs cierre:** revisar `recording.mode`, `timeoutSeconds` y Video ID de cada emisión antes de prometer retomo completo. Verificado por API el 2026-10-10: el Live Input tiene `recording.timeoutSeconds` = 300 (se cambió de 60 a 300 el 2026-09-19, según el CHANGELOG). El default de `scripts/configure-live-input.mjs` es ahora 300, el mismo valor desplegado (antes era 60 y correrlo sin argumentos lo bajaba).

**Pendiente de producción:** corregir el keyframe del perfil OBS (2 s), prueba con salida de OBS en 1080p y sus resoluciones en el manifiesto, métricas del Live Input durante el ensayo y permisos de reproducción. La ruta funcional y visual para el alumno se especifica en [la actualización de Clase completa y comunidad](./LIVE_UX_REDESIGN_AUDIT.md#actualización-2026-10-13--clase-completa-predeterminada-y-comunidad).
