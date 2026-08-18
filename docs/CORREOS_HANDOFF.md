# Handoff — Sistema de notificaciones por correo

Documento de continuidad. Recoge **en qué estado quedó** el sistema de correos y **qué falta hacer**, en orden, para que cualquiera lo retome sin el contexto de la conversación original. Empezá por "Próximos pasos".

_Última actualización: 2026-08-18._

**Estado en una frase:** la **bienvenida** y el **recordatorio de live** funcionan de punta a punta (sandbox, verificados 2026-08-18). Lo único que falta para usuarios reales es **verificar el dominio** en Resend.

> Documentos hermanos: [CORREOS_EVENTOS.md](CORREOS_EVENTOS.md) (catálogo de qué se envía y cuándo) · [CORREO_PRODUCCION.md](CORREO_PRODUCCION.md) (dominio + SMTP para salir del sandbox).

---

## Próximos pasos (en orden)

### 1. ✅ RESUELTO (2026-08-18) — el recordatorio anda

Verificado end-to-end: dio `{"ok":true,"lives":1,"sent":1}` y el correo llegó. El bug era doble: (a) `resend.batch.send` no funciona con el dominio de prueba → se cambió a `emails.send` de a uno; (b) los primeros tests corrían contra el código viejo porque el deploy de Vercel no había terminado. Ahora el dispatcher además expone en la respuesta un campo `errors` con el detalle de cada envío fallido (visible en `net._http_response`, sin escarbar logs). La guía de diagnóstico de abajo queda como referencia.

<details><summary>Diagnóstico original (referencia)</summary>

El job **existe y está activo** (verificado 2026-08-18):

```
jobid 1 · live-reminders · */5 * * * * · active=true · database=postgres
```

Pero en `net._http_response` **no hay ninguna respuesta del dispatcher de recordatorios**. Las últimas filas son del 2026-08-14 y pertenecen al test de bienvenida (ver "Cómo distinguir un dispatcher del otro").

Disparo manual para aislar el problema sin esperar el tick del cron — Supabase → SQL Editor:

```sql
select net.http_post(
  url     := 'https://escuela-riqueza.vercel.app/api/notifications/live-reminders',
  headers := jsonb_build_object(
    'Content-Type',     'application/json',
    'x-webhook-secret', 'EL_SECRETO_DE_VERCEL'
  )
);

-- esperar ~5 segundos
select status_code, content, created
from net._http_response order by created desc limit 3;
```

Cómo leer el resultado:

| Resultado | Significado | Qué hacer |
|---|---|---|
| `200` + `{"ok":true,"lives":0,"sent":0}` | Endpoint y secreto correctos. El sistema está sano. | Pasar al paso 2. |
| `401 Invalid secret` | El secreto del cron ≠ el de Vercel. | Re-correr `sql/notifications-live-reminders.sql` con el valor bueno. |
| `503 Not configured` | Falta una env var en el deploy actual. | Redeployar en Vercel (las envs solo aplican a deploys nuevos). |
| `404 DEPLOYMENT_NOT_FOUND` | La URL tiene hash de deploy. | Usar el dominio estable. |
| No aparece fila nueva | Worker de pg_net trabado. | `select net.worker_restart();` y reintentar. |

</details>

> **Nota:** los dos correos (bienvenida y recordatorio) ya están **verificados end-to-end en sandbox**. Lo de acá abajo es lo que falta, en orden de impacto.

### 2. Verificar el dominio en Resend — el desbloqueo grande

Hasta que esto pase, **todo llega solo a `escueladelariquezaweb@gmail.com`**; ningún usuario real recibe nada (enviar a otros da el error `You can only send testing emails to your own email address`, que es esperado, no un bug). Runbook completo: [CORREO_PRODUCCION.md](CORREO_PRODUCCION.md). Al terminar: cambiar la env `EMAIL_FROM` en Vercel a la dirección del dominio y **redeployar**.

### 3. Branding del correo de confirmación de Supabase (lo del "logo")

Hoy el "confirmá tu email" y el "reset de contraseña" salen con la plantilla **gris default de Supabase** — el usuario recibe la bienvenida linda y la confirmación fea, se ven de dos empresas distintas. Dos partes:

- **Diseño (se puede hacer YA, no depende del dominio):** Supabase → Authentication → Email Templates → "Confirm signup" (y también "Reset password"). Pegar HTML propio con la paleta gold/dark, **respetando la variable `{{ .ConfirmationURL }}`** (es el link del botón — si la borrás, el correo no confirma nada). Lo más rápido: reusar el header/footer de `api/notifications/_welcome-template.ts` y cambiar el cuerpo por "Confirmá tu cuenta" + un botón a `{{ .ConfirmationURL }}`.
- **Entrega (espera al dominio):** Supabase → Authentication → SMTP Settings → Custom SMTP apuntando a Resend (host `smtp.resend.com`, usuario `resend`, contraseña = una API key de Resend, remitente = la dirección del dominio). Sin esto, el correo sale del SMTP de prueba de Supabase, que es limitado (~3-4/hora) y cae en spam.

### 4. (Producto) Revisar el filtro `is_active` del recordatorio

El dispatcher solo avisa de lives con `status='scheduled'` **y** `is_active=true` — o sea, solo si el live está marcado como la "sala activa". Si Iván programa un live pero recién lo activa a último momento, el aviso de 30 min antes no sale. **Decidir con Iván:** ¿el recordatorio va para *cualquier* live programado, o solo para el activo? Si es lo primero, sacar el `.eq('is_active', true)` de `api/notifications/live-reminders.ts`.

### 5. Futuro: correos de Stripe

Subida de plan, pago confirmado, pago fallido — cuando se termine la integración de Stripe. El patrón ya está armado; seguir el checklist "al agregar un correo nuevo" de [CORREOS_EVENTOS.md](CORREOS_EVENTOS.md).

---

## Qué está hecho y funcionando

| Pieza | Estado |
|---|---|
| **Bienvenida** (al confirmar email) | ✅ Funciona en producción (sandbox). Verificada con `200` el 2026-08-14. |
| **Recordatorio de live VIP** | ✅ Verificado end-to-end (sandbox) el 2026-08-18: `{"lives":1,"sent":1}`. Envía de a uno con `emails.send` (el `batch.send` NO anda en sandbox). |
| **Cron `live-reminders`** | ✅ Agendado y activo (`jobid 1`, `*/5`). |
| **Fixes de UX del registro** | ✅ En `main`. |
| **Confirmar email / reset** (Supabase) | Activos, con plantilla default (branding pendiente, ver CORREO_PRODUCCION.md). |

Todo el código está commiteado y mergeado — **nada quedó pendiente de subir**:

- `c9c6f2e` (2026-08-14, PR #63) — recordatorio de live: dispatcher, plantilla, SQL del cron y docs.
- `33565a4` / `e7bc1ef` (PR #61, #62) — bienvenida: dispatcher y plantilla.

Los 3 fixes de UX del registro están verificados en HEAD: `emailRedirectTo` a `/cuenta-verificada` (`src/lib/api/auth.ts:91`), campo `emailConfirmed` (`src/types/user.ts:27`, `auth.ts:23,117`) y el guard que bloquea sesiones sin confirmar (`src/components/layout/RequireAuth.tsx:32`).

---

## Cosas que tenés que saber (aprendidas a los golpes)

| Tema | Qué recordar |
|---|---|
| **`cron.job_run_details` miente** | Dice `succeeded` aunque el endpoint haya devuelto 401. pg_net despacha el POST y se olvida, así que el job "tiene éxito" con solo mandarlo. **El status real vive en `net._http_response`.** |
| **Cómo distinguir un dispatcher del otro** | Por la forma del JSON. Bienvenida devuelve `{"ok":true,"action":"sent","id":"..."}` (`welcome.ts:113`); recordatorio devuelve `{"ok":true,"lives":N,"sent":N}` (`live-reminders.ts:104`). Si estás debuggeando el recordatorio y ves un `action`, estás mirando el correo equivocado. |
| **El secreto está escrito dos veces** | Una vez en el trigger de bienvenida y otra en el cron de recordatorios, en scripts SQL separados. **Que uno dé 200 no dice nada del otro.** |
| **Sandbox de Resend** | Hoy SOLO entrega a `escueladelariquezaweb@gmail.com`. Los usuarios reales no reciben nada hasta verificar el dominio. |
| **Secreto compartido** | El dispatcher valida `NOTIFICATIONS_WEBHOOK_SECRET`. Debe ser **idéntico** en Vercel y en el header de los SQL (trigger + cron). Sin comillas en ninguno. |
| **Env vars y deploy** | Las env vars de Vercel **solo aplican a deploys nuevos**. Si cambiás una, redeployá. |
| **URL en los SQL** | Usar siempre el **dominio estable** (`escuela-riqueza.vercel.app`), nunca una URL de deploy con hash — esas dan `DEPLOYMENT_NOT_FOUND`. |
| **Placeholders** | Los `.sql` traen `__PLACEHOLDER__` a propósito. Reemplazarlos SIEMPRE antes de correr, o pg_net revienta. |
| **Imports en Functions** | Las plantillas que se envían viven en `api/notifications/_*-template.ts` (no en `emails/*.tsx`) porque Vercel no empaqueta `emails/`. Importar con extensión `.js`. |
| **Gemelos de diseño** | `emails/*.tsx` (preview con `npm run email:dev`) y `api/notifications/_*-template.ts` (envío) son gemelos — si tocás uno, tocá el otro. |
| **Ventana del recordatorio** | El dispatcher solo mira lives en `status='scheduled'` **y** `is_active=true`. Si la sala ya pasó a `live` (por "Forzar EN VIVO" o por el webhook de Cloudflare) antes del `starts_at`, queda fuera de la consulta y nadie recibe aviso. |
| **Diagnóstico de envíos** | Supabase: tabla `notification_log` (una fila por envío) y `net._http_response` (respuestas de pg_net). Resend → Logs para la entrega real. |

---

## Recetas de prueba

Usuario de prueba: `escueladelariquezaweb@gmail.com` · id `e6c1762e-d000-4f5e-89a8-5c2743b83783`.

**Bienvenida** (re-disparar): en Supabase SQL Editor —

```sql
delete from notification_log where user_id = 'e6c1762e-d000-4f5e-89a8-5c2743b83783';
update auth.users set email_confirmed_at = null where email = 'escueladelariquezaweb@gmail.com';
update auth.users set email_confirmed_at = now()  where email = 'escueladelariquezaweb@gmail.com';
-- Verificar: select status_code, content from net._http_response order by created desc limit 3;  (esperar 200)
```

**Recordatorio de live**:

1. Confirmar que el usuario de prueba tiene suscripción **activa**:
   ```sql
   select plan, status from subscriptions
   where user_id = 'e6c1762e-d000-4f5e-89a8-5c2743b83783';
   ```
2. Crear un live con `status='scheduled'`, `is_active=true`, `allowed_plans` incluyendo el plan del usuario, y `starts_at` dentro de los próximos 30 min (`LIVE_REMINDER_LEAD_MINUTES`, default 30).
3. Esperar el cron (≤5 min) o disparar a mano (ver paso 1 de "Próximos pasos").
4. Verificar la fila:
   ```sql
   select * from notification_log where event_type = 'live_reminder';
   ```

**Re-disparar un recordatorio ya enviado**: borrar su fila de `notification_log` (`event_type='live_reminder'` y `dedupe_key = <live_id>`). Mientras la fila exista, el dispatcher lo saltea a propósito.

---

## Referencia rápida de arquitectura

- **Dispatchers** (Vercel Functions): `api/notifications/welcome.ts`, `api/notifications/live-reminders.ts`. Validan el secreto, garantizan idempotencia con `notification_log`, envían con Resend.
- **Disparadores**: bienvenida = trigger Postgres sobre `auth.users` (`sql/notifications-welcome.sql`); recordatorio = pg_cron cada 5 min (`sql/notifications-live-reminders.sql`). Ambos usan `pg_net` para llamar al dispatcher.
- **Idempotencia**: tabla `notification_log`, única `(user_id, event_type, dedupe_key)`. En el recordatorio la reserva se hace **antes** de enviar y se libera si Resend falla, para que el próximo cron reintente.
- **Fan-out del recordatorio**: un live → usuarios elegibles por `allowed_plans` → envío en lotes de 100 (batch de Resend).
- **Env vars**: `RESEND_API_KEY`, `NOTIFICATIONS_WEBHOOK_SECRET`, `SUPABASE_SERVICE_ROLE_KEY` (ya seteadas); `EMAIL_FROM` y `APP_URL` (opcionales, cambian al pasar a producción); `LIVE_REMINDER_LEAD_MINUTES` (opcional, default 30).
