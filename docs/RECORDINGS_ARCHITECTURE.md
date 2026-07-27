# Arquitectura de Grabaciones — Archivado en R2

> Cómo se almacenan las grabaciones de los lives para que el costo sea sostenible.
> **Crítico:** leer antes de tocar `AdminLiveManager`, `VIPLiveRoom`, `api/stream/*` de grabaciones o el Worker de archivado.

_Creado: 2026-07-08 · Estado: 🟡 en implementación_

---

## 1. El problema

Cada sábado se emiten ~4 h de vivo (**~240 min**) por Cloudflare Stream. La grabación queda en Stream, y Stream cobra el **almacenamiento acumulado por mes**:

- **Storage:** $5 por cada 1.000 min almacenados / mes → **nunca dejás de pagar por lo viejo**.
- **Entrega:** $1 por cada 1.000 min entregados → cada replay que mira un VIP suma.

Proyección real (~960 min nuevos/mes):

| Momento | Min acumulados en Stream | Costo/mes solo storage |
|---|---|---|
| Mes 1 | 960 | ~$4.80 |
| Mes 6 | 5.760 | ~$29 |
| Mes 12 | 11.520 | ~$58 |
| Mes 24 | 23.040 | ~$115 |

El costo **crece para siempre**. Insostenible.

---

## 2. La solución

Mover la grabación de **Cloudflare Stream** (caro, acumulativo) a **Cloudflare R2** (object storage barato, **egress cero**) apenas termina el vivo, y **borrar el video de Stream** para cortar el cobro recurrente.

### Por qué R2
- **Egress $0** → la entrega de replays no cuesta nada.
- **Storage $0.015/GB-mes** → una grabación de 4 h (~5-8 GB) cuesta **~$0.10/mes**.
- Mismo ecosistema Cloudflare (mismo dashboard, ya figuraba como pendiente en `CLAUDE.md`).

### Comparativa de costo (1 año de sábados)

| | Cloudflare Stream | Cloudflare R2 |
|---|---|---|
| Storage mes 12 | ~$58/mes y subiendo | **~$4.5/mes** (~300 GB) |
| Entrega por replay masivo | $1/1000 min (paga siempre) | **$0** |
| Tendencia | crece lineal para siempre | prácticamente plana |

---

## 3. Qué cambia

| Capa | Antes | Después |
|---|---|---|
| Grabación tras el vivo | Se queda en Stream indefinidamente | Se copia a R2 y se **borra de Stream** |
| Fuente del replay | iframe de Cloudflare Stream (`recording_stream_uid`) | MP4 en R2 vía URL firmada (`recording_r2_key`) |
| Control de acceso | iframe público de Stream | URL firmada de vida corta, gateada por plan |
| Costo de entrega | $1/1000 min | $0 (egress R2) |
| Tabla `lives` | solo `recording_stream_uid` | + `recording_r2_key`, `recording_storage`, `recording_bytes`, `recording_duration_seconds`, `archived_at` |

---

## 4. Qué mejora

- **Costo plano** en vez de curva ascendente.
- **Entrega gratis** de replays (egress cero en R2).
- **Tracking de minutos/costo**: al guardar `recording_bytes` y `recording_duration_seconds` podemos sumar el total y estimar gasto (resuelve de paso el punto 3 de `PENDIENTES.md`).
- **Acceso controlado**: URL firmada de vida corta en vez de iframe público que se puede filtrar.

---

## 5. Cómo funciona (flujo)

```
1. Admin finaliza el vivo en AdminLiveManager
        │
        ▼
2. Stream tiene la grabación (temporal). Se habilita el MP4 (POST /downloads, ya existe).
        │
        ▼
3. Se dispara el archivado → Cloudflare Worker:
     a. Espera a que el MP4 esté 'ready'.
     b. Copia el MP4 de Stream → bucket R2 (server-to-server, dentro de Cloudflare, sin egress).
     c. Lee duración y tamaño.
     d. Actualiza `lives`: recording_r2_key, recording_bytes,
        recording_duration_seconds, recording_storage='r2', archived_at.
     e. DELETE del video en Cloudflare Stream → corta el cobro recurrente.
        │
        ▼
4. Replay: VIPLiveRoom pide POST /api/stream/recording-url
     → Vercel function valida plan del usuario
     → genera URL firmada S3 (presigned GET, ~15 min) del objeto en R2
     → el player reproduce el MP4.
```

### Archivado automático (Cron Trigger)

El paso 3 ya **no requiere el botón manual**. El Worker tiene un **Cron Trigger** (`crons = ["*/10 * * * *"]` en `wrangler.toml` → handler `scheduled()` en `worker/src/index.ts`). Cada 10 min:

1. Consulta `lives` donde `recording_stream_uid` está cargado y `archived_at` es null (grabado pero sin archivar).
2. Corre `archiveOne()` sobre cada una — la misma lógica que el botón manual.
3. Si el MP4 todavía se está generando, queda en `processing` y se reintenta en el próximo tick. Al archivar con éxito, `recording_stream_uid` pasa a null y la grabación deja de aparecer sola.

El **botón "Archivar en R2" sigue existiendo** para forzar el archivado on-demand; el cron es la red de seguridad que lo hace solo. Ambos comparten `archiveOne()`, así que no hay lógica duplicada.

### Por qué un Worker y no una Vercel Function para la copia
Un MP4 de 4 h pesa varios GB. Las Vercel Functions tienen límite de tiempo (10-60s) y memoria — no pueden hacer streaming de varios GB. El **Cloudflare Worker** hace la copia Stream→R2 **dentro de la red de Cloudflare**: sin egress y sin timeout de Vercel.

La **firma de URL** (paso 4) sí va en Vercel Function: es solo firmar (sin transferir datos), liviano y perfecto para serverless.

### Decisión de acceso: bucket privado + URL firmada
El contenido es VIP pago. Bucket **privado**; el frontend nunca ve la URL cruda de R2, solo una presigned URL de vida corta generada tras validar el plan. Evita que se filtren links.

---

## 6. Componentes nuevos

| Componente | Tipo | Estado | Bloqueado por Cloudflare |
|---|---|---|---|
| Migración SQL (columnas nuevas en `lives`) | SQL | 🟢 corrida | No |
| Tipo `LiveEvent` actualizado | TS | 🟢 | No |
| `api/stream/recording-url.ts` (presigned GET, gateado por plan) | Vercel Function | 🟢 escrita | Runtime: env R2 en Vercel |
| `worker/` (copia Stream→R2 + delete) | Cloudflare Worker | 🟢 escrito | **Deploy pendiente** (`wrangler`) |
| `api/stream/archive-recording.ts` (dispara el Worker) | Vercel Function | 🟢 escrita | env `ARCHIVE_WORKER_URL` + secret |
| Botón "Archivar en R2" + player R2 en admin | React | 🟢 | Depende del deploy |
| KPI de minutos/costo en admin | React | 🔴 | No (usa `recording_bytes`/`_duration_seconds`) |

**Costo puntual a tener en cuenta:** cuando el Worker descarga el MP4 desde Stream para copiarlo a R2, esa descarga cuenta como *entrega* de Stream ($1/1000 min) — **una sola vez** por grabación (~$0.24 por un vivo de 4 h). Es despreciable frente al ahorro de storage recurrente.

---

## 6b. Deploy del Worker (paso a paso)

Desde la carpeta `worker/`:

```bash
cd worker
npm install
npx wrangler login                 # abre el navegador para autorizar
```

Cargar los secrets (uno por uno; pide el valor por stdin):

```bash
npx wrangler secret put CF_ACCOUNT_ID
npx wrangler secret put CF_STREAM_API_TOKEN
npx wrangler secret put SUPABASE_URL
npx wrangler secret put SUPABASE_SERVICE_ROLE_KEY
npx wrangler secret put ARCHIVE_SHARED_SECRET   # inventá un string largo y aleatorio
```

Deploy:

```bash
npx wrangler deploy
```

`wrangler` imprime la URL del Worker (ej. `https://escuela-archive-recording.<subdominio>.workers.dev`).

Después, en **Vercel → Settings → Environment Variables**:

| Variable | Valor |
|---|---|
| `ARCHIVE_WORKER_URL` | la URL que imprimió `wrangler deploy` |
| `ARCHIVE_SHARED_SECRET` | **el mismo** string que pusiste en el secret del Worker |

Redeploy de Vercel para que tome las envs.

---

## 7. Qué necesito de Cloudflare (acción del cliente)

Para desbloquear los componentes 🔴:

1. **Crear un bucket R2** (ej. `escuela-recordings`). → Pasame el nombre.
2. **Credenciales S3 de R2**: R2 → *Manage R2 API Tokens* → crear token con *Object Read & Write*. Devuelve:
   - `R2_ACCESS_KEY_ID`
   - `R2_SECRET_ACCESS_KEY`
   - endpoint S3: `https://<ACCOUNT_ID>.r2.cloudflarestorage.com`
   → cargar en Vercel (server-side, **sin** prefijo `VITE_`).
3. **Confirmar que el token de Stream** (`CLOUDFLARE_STREAM_API_TOKEN`) tiene permiso de **borrado** (`Stream:Edit` lo cubre).
4. **Deploy del Worker** (cuando lo tenga escrito): se despliega con `wrangler` y un *binding* R2 al bucket del paso 1. Te paso el `wrangler.toml` listo.

Variables de entorno nuevas (Vercel):

| Variable | Para qué |
|---|---|
| `R2_ACCESS_KEY_ID` | Firmar URLs de descarga R2 |
| `R2_SECRET_ACCESS_KEY` | Idem (secret, nunca al cliente) |
| `R2_ACCOUNT_ID` | Endpoint S3 de R2 |
| `R2_BUCKET` | Nombre del bucket |

---

## 8. Rollout / consideraciones

- **Transición suave:** `recording_storage` (`'stream' | 'r2' | null`) indica dónde vive cada grabación. Los replays viejos que aún estén en Stream siguen funcionando por `recording_stream_uid`; los nuevos van por R2. Nada se rompe de golpe.
- **Borrado de Stream irreversible:** una vez en R2 y borrado de Stream, R2 es la única fuente. Por eso el Worker borra **solo después** de confirmar la copia exitosa en R2.
- **Sin ABR:** R2 sirve un MP4 plano (sin bitrate adaptativo). Para replay a audiencia VIP chica, un `<video>` con range requests alcanza. Si en el futuro se necesita HLS, se agrega — hoy sería sobre-ingeniería.
- **Grabaciones ya existentes en Stream:** se pueden migrar a R2 corriendo el Worker sobre cada `recording_stream_uid` viejo (tarea opcional posterior).
