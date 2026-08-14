# Catálogo de correos: qué envía la app y cuándo

Mapa vivo de **todos los correos** que manda la plataforma, su disparador y a quién llegan. Sirve para saber de un vistazo qué comunica el sistema en cada momento. Actualizar esta tabla cada vez que se agrega o cambia un correo.

> **Hoy todo está en el sandbox de Resend:** solo se entrega a `escueladelariquezaweb@gmail.com`. Los usuarios reales empiezan a recibir cuando se verifique el dominio (ver [CORREO_PRODUCCION.md](CORREO_PRODUCCION.md)).

---

## Correos activos / construidos

| Correo | ¿Cuándo se dispara? | ¿A quién? | Quién lo manda | Estado |
|---|---|---|---|---|
| **Confirma tu email** | Al registrarse | El nuevo usuario | Supabase Auth | Activo (plantilla default, pendiente branding) |
| **Restablecer contraseña** | Al pedir "olvidé mi contraseña" | El usuario | Supabase Auth | Activo (plantilla default) |
| **Bienvenida** | Al **confirmar** el email (`email_confirmed_at`: null → fecha) | El usuario que confirma | Nuestro dispatcher + Resend | ✅ Funcionando (sandbox) |
| **Recordatorio de live VIP** | ~30 min antes de que empiece un live activo | Usuarios con plan permitido por ese live (`allowed_plans`) | Nuestro dispatcher + Resend | ✅ Construido (sandbox) |

## Correos planeados (aún no construidos)

| Correo | Disparador previsto | A quién |
|---|---|---|
| Subiste de plan | Cambio de suscripción (webhook Stripe) | El usuario que sube |
| Pago confirmado / renovación | Webhook Stripe | El usuario |
| Pago falló / por vencer | Webhook Stripe | El usuario |

> Los tres dependen de terminar la integración de Stripe, que hoy está parcial.

---

## Cómo funciona cada disparador

| Tipo | Mecanismo | Ejemplo |
|---|---|---|
| **Por evento** | Un cambio en la base dispara un trigger de Postgres → `pg_net` llama al dispatcher | Bienvenida (al confirmar email) |
| **Por tiempo** | `pg_cron` corre cada 5 min → llama al dispatcher, que decide qué toca enviar | Recordatorio de live |
| **De Supabase** | Los maneja Supabase Auth directamente | Confirmar email, reset de contraseña |

Reglas transversales de todos los correos nuestros:

- **Idempotencia:** la tabla `notification_log` (clave única `user_id + event_type + dedupe_key`) impide enviar dos veces lo mismo.
- **Autenticación:** el dispatcher solo responde si recibe el secreto `NOTIFICATIONS_WEBHOOK_SECRET` en el header.
- **Diseño:** paleta gold/dark de la escuela, wordmark tipográfico (no imagen todavía).

---

## Dónde vive cada cosa (para desarrollo)

| Pieza | Ubicación |
|---|---|
| Plantillas para preview | `emails/*.tsx` (`npm run email:dev`) |
| Plantillas que se envían | `api/notifications/_*-template.ts` |
| Dispatchers | `api/notifications/welcome.ts`, `api/notifications/live-reminders.ts` |
| Triggers y crons | `sql/notifications-*.sql` |
| Log de envíos / idempotencia | Tabla `notification_log` en Supabase |
| Auditoría de entregas | Resend → Emails / Logs |

## Checklist al agregar un correo nuevo

- [ ] Plantilla `emails/<Nombre>.tsx` (preview) + `api/notifications/_<nombre>-template.ts` (envío).
- [ ] Dispatcher o rama en un dispatcher existente, con verificación de secreto.
- [ ] Registro en `notification_log` con su `event_type` y `dedupe_key`.
- [ ] Disparador (trigger SQL o cron) apuntando al dispatcher.
- [ ] Fila nueva en la tabla de arriba de este documento.
