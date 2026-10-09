# Configuración de OBS para los vivos

> Para quien opera la transmisión. Con esta configuración Cloudflare Stream acepta el video sin problemas, aunque la escena tenga mucho movimiento.
> Incidente que la originó: clase del 2026-10-03 (ver `docs/CHANGELOG.md`).

---

## 1. Configuración obligatoria

En OBS: **Ajustes → Salida → Modo de salida: `Avanzado` → pestaña `Emisión`**.

| Ajuste | Valor | Por qué |
|---|---|---|
| Control de tasa | **CBR** | Tasa de bits constante. Con VBR/CQP la tasa sube cuando hay movimiento o poca luz, y puede superar el límite de Cloudflare. |
| Tasa de bits | **6000 kbps** | La plataforma entrega como máximo 720p. Más bits no mejoran lo que ve el alumno y dejan menos margen si la red del lugar fluctúa. |
| Intervalo de fotogramas clave | **2** (segundos) | **El ajuste crítico.** En `0` (automático) OBS genera un keyframe cada 250 cuadros (~8,3 s a 30 fps) y los fragmentos se vuelven enormes. |
| B-frames | **0** | Requisito de Cloudflare para el modo "Baja latencia". |

⚠️ **Verificar que quede guardado en el perfil que se usa** (menú **Perfil** de OBS). Si se cambia en modo `Simple` o en otro perfil, no aplica.

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
tamaño del fragmento ≈ tasa de bits × intervalo de keyframes
```

| Keyframe | Tasa de bits | Fragmento | Resultado |
|---|---|---|---|
| automático (~8,3 s) | 10,8 Mbit/s | ~11 MB | ❌ rechazado (lo que pasó el 2026-10-03) |
| automático (~8,3 s) | 6 Mbit/s | ~6,2 MB | ⚠️ funciona, pero sin margen si se usa VBR |
| **2 s** | **6 Mbit/s** | **~1,5 MB** | ✅ configuración recomendada |

Con keyframe en 2 s el video además **arranca más rápido** para el alumno: el reproductor espera 2-3 fragmentos antes de empezar, y no es lo mismo esperar 3 × 2 s que 3 × 8 s.

---

## 3. Checklist antes de cada vivo

1. OBS: la configuración de la sección 1 está en el perfil activo.
2. Iniciar transmisión en OBS **antes** de la hora de inicio.
3. Cloudflare → Stream → Live Inputs → `escuela-riqueza-live`:
   - Estado **Connected**.
   - **Ingress bitrate** cerca de 6 Mbit/s (no 10+).
   - **GOP** muestra un valor (si dice `Unavailable`, el keyframe sigue en automático).
   - La **vista previa** muestra video (no se queda girando).
4. Panel de la escuela: la sala correcta está **activa** y su **Input ID** coincide con el Live Input al que transmite OBS.
5. Abrir el link de la sala en otra pestaña y confirmar que se ve.

---

## 4. Si algo falla

| Lo que ve el alumno | Causa probable | Qué hacer |
|---|---|---|
| "Error de reproducción" y Cloudflare dice **Disconnected** | OBS no transmite o usa otra clave/servidor | Revisar el botón "Iniciar transmisión" y la sección **Emisión** de OBS. |
| Se queda cargando y Cloudflare dice **Connected** pero la vista previa gira | Fragmentos de más de 10 MB | Detener transmisión → aplicar la sección 1 → iniciar de nuevo. |
| Funciona y de golpe se corta unos segundos | OBS se desconectó y reconectó (red del lugar) | Mirar en OBS los cuadros perdidos y el indicador de conexión. Si está amarillo/rojo, es internet. Los alumnos recargan. |
| "La repetición es para alumnos" en un link que debería estar en vivo | La sala se **finalizó** | En el panel: Eventos en Vivo → Finalizados → **Reactivar**. No crear una sala nueva: cambia el link y la gente queda afuera. |

Después de cualquier corrección, los alumnos que ya vieron "Error de reproducción" deben tocar **Reintentar** o recargar la página.
