# Handoff — Sistema de notificaciones por correo

Documento de continuidad. Recoge **en qué estado quedó** el sistema de correos y **qué falta hacer**, en orden, para que cualquiera lo retome sin el contexto de la conversación original. Empezá por "Próximos pasos".

**Estado en una frase:** la **bienvenida** funciona en producción (sandbox); el **recordatorio de live** está construido pero **falta desplegarlo y activar su cron**; hay **3 fixes de UX del registro** listos en código **sin commitear**.

> Documentos hermanos: [CORREOS_EVENTOS.md](CORREOS_EVENTOS.md) (catálogo de qué se envía y cuándo) · [CORREO_PRODUCCION.md](CORREO_PRODUCCION.md) (dominio + SMTP para salir del sandbox).

---

## Próximos pasos (en orden)

1. **Commitear y desplegar lo pendiente** (ver lista de archivos abajo). Nada de esto está en producción todavía.
2. **Activar el cron del recordatorio de live**: correr [sql/notifications-live-reminders.sql](../sql/notifications-live-reminders.sql) en Supabase → SQL Editor, reemplazando los 2 placeholders:
   - `__APP_WEBHOOK_URL__` → `https://escuela-riqueza.vercel.app/api/notifications/live-reminders`
   - `__WEBHOOK_SECRET__` → el valor de `NOTIFICATIONS_WEBHOOK_SECRET` que está en Vercel (sin comillas).
3. **Probar el recordatorio** (receta abajo).
4. **Salir del sandbox**: verificar el dominio en Resend siguiendo [CORREO_PRODUCCION.md](CORREO_PRODUCCION.md). Hasta que esto pase, **los correos solo llegan a `escueladelariquezaweb@gmail.com`**.
5. **Futuro**: correos de Stripe (subida de plan, pago) cuando se termine esa integración.

---

## Archivos pendientes de commitear + desplegar

**Modificados (fixes de UX del registro):**

| Archivo | Cambio |
|---|---|
| `src/pages/public/AuthPage.tsx` | Pantalla terminal "Revisa tu correo" tras registrarse (antes volvía al form con el botón activo) |
| `src/lib/api/auth.ts` | `signUp` ahora manda `emailRedirectTo` a `/cuenta-verificada` + campo `emailConfirmed` |
| `src/components/layout/RequireAuth.tsx` | El guard bloquea sesiones con email sin confirmar (solo si es `false`) |
| `src/types/user.ts` | Campo `emailConfirmed?: boolean` |

**Nuevos (recordatorio de live + docs):**

`api/notifications/live-reminders.ts` · `api/notifications/_live-reminder-template.ts` · `emails/LiveReminderEmail.tsx` · `sql/notifications-live-reminders.sql` · `docs/CORREOS_EVENTOS.md` · `docs/CORREO_PRODUCCION.md`

> El fix de UX #2 (`emailRedirectTo`) **requiere** que `/cuenta-verificada` esté en Supabase → Auth → URL Configuration → Redirect URLs. (Johan indicó que ya lo agregó — conviene confirmarlo.)

---

## Qué está hecho y funcionando

| Correo | Estado |
|---|---|
| **Bienvenida** (al confirmar email) | ✅ Funciona en producción (sandbox). Commiteado y desplegado. |
| **Recordatorio de live VIP** | 🟡 Construido. Falta desplegar + correr el SQL del cron. |
| **Fixes de UX del registro** | 🟡 Listos en código, typecheck verde. Sin commitear. |
| **Confirmar email / reset** (Supabase) | Activos, con plantilla default (branding pendiente, ver CORREO_PRODUCCION.md). |

---

## Cosas que tenés que saber (aprendidas a los golpes)

| Tema | Qué recordar |
|---|---|
| **Sandbox de Resend** | Hoy SOLO entrega a `escueladelariquezaweb@gmail.com`. Los usuarios reales no reciben nada hasta verificar el dominio. |
| **Secreto compartido** | El dispatcher valida `NOTIFICATIONS_WEBHOOK_SECRET`. Debe ser **idéntico** en Vercel y en el header de los SQL (trigger + cron). Sin comillas en ninguno. |
| **Env vars y deploy** | Las env vars de Vercel **solo aplican a deploys nuevos**. Si cambiás una, redeployá. |
| **URL en los SQL** | Usar siempre el **dominio estable** (`escuela-riqueza.vercel.app`), nunca una URL de deploy con hash — esas dan `DEPLOYMENT_NOT_FOUND`. |
| **Placeholders** | Los `.sql` traen `__PLACEHOLDER__` a propósito. Reemplazarlos SIEMPRE antes de correr, o pg_net revienta. |
| **Imports en Functions** | Las plantillas que se envían viven en `api/notifications/_*-template.ts` (no en `emails/*.tsx`) porque Vercel no empaqueta `emails/`. Importar con extensión `.js`. |
| **Gemelos de diseño** | `emails/*.tsx` (preview con `npm run email:dev`) y `api/notifications/_*-template.ts` (envío) son gemelos — si tocás uno, tocá el otro. |
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

**Recordatorio de live**: asegurar que el usuario de prueba tenga una suscripción **activa** con un plan incluido en `allowed_plans` de un live, crear un live `status='scheduled'`, `is_active=true`, con `starts_at` dentro de los próximos 30 min, y esperar el cron (≤5 min) o disparar el endpoint a mano con `curl` + el header `x-webhook-secret`. Verificar la fila `live_reminder` en `notification_log`.

---

## Referencia rápida de arquitectura

- **Dispatchers** (Vercel Functions): `api/notifications/welcome.ts`, `api/notifications/live-reminders.ts`. Validan el secreto, garantizan idempotencia con `notification_log`, envían con Resend.
- **Disparadores**: bienvenida = trigger Postgres sobre `auth.users` (`sql/notifications-welcome.sql`); recordatorio = pg_cron (`sql/notifications-live-reminders.sql`). Ambos usan `pg_net` para llamar al dispatcher.
- **Idempotencia**: tabla `notification_log`, única `(user_id, event_type, dedupe_key)`.
- **Env vars**: `RESEND_API_KEY`, `NOTIFICATIONS_WEBHOOK_SECRET`, `SUPABASE_SERVICE_ROLE_KEY` (ya seteadas); `EMAIL_FROM` y `APP_URL` (opcionales, cambian al pasar a producción); `LIVE_REMINDER_LEAD_MINUTES` (opcional, default 30).
