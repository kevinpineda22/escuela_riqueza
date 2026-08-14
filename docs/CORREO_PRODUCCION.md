# Poner el correo en producción: dominio + SMTP

El sistema de notificaciones por correo **ya funciona**, pero hoy está en el *sandbox* de Resend: solo entrega al correo de la cuenta (`escueladelariquezaweb@gmail.com`). **Los usuarios reales todavía no reciben nada.** Este documento es para quien administra el dominio/DNS: al completarlo, los correos empiezan a llegar a todos, con la marca de la escuela.

> Requiere acceso al **DNS del dominio**, al **dashboard de Resend** (`escueladelariquezaweb@gmail.com`), al **dashboard de Supabase** y a las **env vars de Vercel**.

---

## Ruta rápida

1. Tener un **dominio** (o subdominio, ej. `mail.escueladelariqueza.com`).
2. En **Resend → Domains → Add Domain**: cargar el dominio. Resend muestra unos **registros DNS**.
3. Copiar esos registros al **DNS del dominio** (donde esté comprado: Cloudflare, GoDaddy, etc.).
4. Volver a Resend y darle **Verify**. Esperar a que quede en verde (puede tardar minutos u horas por la propagación DNS).
5. Configurar **Custom SMTP en Supabase** (para que el "confirmá tu email" también salga con la marca).
6. Actualizar **2 env vars en Vercel** y **redeploy**.
7. Verificar: registrar un correo real y confirmar que llega la bienvenida.

---

## Detalle por área

| Área | Qué hacer / qué valor |
|---|---|
| **Dominio** | Un dominio propio o un subdominio dedicado a correo (recomendado: `mail.` o `notificaciones.`). El subdominio aísla la reputación de envío del dominio principal. |
| **Registros DNS** | Resend genera **los exactos** al agregar el dominio: un **SPF** (TXT), varias claves **DKIM** (CNAME/TXT) y, recomendado, un **DMARC** (TXT). Copiar *tal cual* los muestra Resend — son únicos por dominio. |
| **Remitente** | Elegir la dirección de envío, ej. `hola@escueladelariqueza.com`. En Vercel se configura como `EMAIL_FROM` con el formato: `Escuela de la Riqueza <hola@escueladelariqueza.com>`. |
| **Supabase SMTP** | Authentication → **SMTP Settings** → habilitar Custom SMTP. Host: `smtp.resend.com` · Puerto: `465` · Usuario: `resend` · Contraseña: **una API key de Resend** · Sender: la misma dirección del remitente. Esto hace que confirmación y reset de contraseña salgan de tu dominio y no caigan en spam. |
| **Env vars (Vercel)** | Ver tabla siguiente. Después de cambiarlas, **redeploy** (las env vars solo aplican a deploys nuevos). |

### Env vars en Vercel

| Variable | Antes (sandbox) | Después (producción) |
|---|---|---|
| `EMAIL_FROM` | *(sin setear → usa `onboarding@resend.dev`)* | `Escuela de la Riqueza <hola@TU-DOMINIO.com>` |
| `APP_URL` | `https://escuela-riqueza.vercel.app` | El dominio real del sitio (si cambia) — de acá sale el botón del correo |

> `RESEND_API_KEY` y `NOTIFICATIONS_WEBHOOK_SECRET` **ya están configuradas** y no se tocan.

---

## Checklist

- [ ] Dominio (o subdominio) elegido y disponible.
- [ ] Dominio agregado en Resend → Domains.
- [ ] Registros SPF + DKIM (+ DMARC) cargados en el DNS.
- [ ] Dominio en **verde** (verificado) en Resend.
- [ ] `EMAIL_FROM` actualizada en Vercel a la dirección del dominio.
- [ ] `APP_URL` apunta al dominio real del sitio.
- [ ] **Redeploy** hecho después de cambiar las env vars.
- [ ] Custom SMTP configurado en Supabase (host `smtp.resend.com`, user `resend`).
- [ ] Prueba real: registrar un correo cualquiera (no el de la cuenta de Resend) → llega la bienvenida.

---

## Cómo verificar que quedó

Registrar un usuario con **cualquier correo real** (uno distinto al de la cuenta de Resend) y confirmar el email. Si llega la bienvenida dorada, el sandbox quedó atrás y el sistema está en producción.

Para auditar envíos: **Resend → Emails/Logs** muestra cada correo (Delivered, Opened…). En Supabase, la tabla `notification_log` guarda una fila por cada bienvenida enviada.

## Contexto técnico (para quien lo necesite)

La arquitectura completa del sistema de correos está en el código: `api/notifications/`, `emails/`, `sql/notifications-welcome.sql`. Este documento cubre solo el paso de infraestructura (dominio + SMTP) que falta para producción.
