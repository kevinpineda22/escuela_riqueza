# Email Templates — Escuela de la Riqueza

Plantillas HTML branded para los correos transaccionales de Supabase Auth.

## Archivos

| Archivo | Plantilla Supabase | Estado |
|---|---|---|
| `confirm-signup.html` | **Confirm signup** | Lista |

## Cómo aplicarlas

1. Entrar al [Supabase Dashboard](https://supabase.com/dashboard) → tu proyecto.
2. Ir a **Authentication → Email Templates**.
3. Seleccionar la plantilla correspondiente (ej. *Confirm signup*).
4. **Subject** sugerido: `Confirmá tu cuenta en Escuela de la Riqueza`
5. Pegar el contenido completo del archivo `.html` en el editor (reemplaza el default).
6. Guardar.
7. Probar registrando un usuario nuevo y verificando que el mail llegue con el branding correcto en Gmail web, Gmail mobile y Outlook.

## Variables disponibles

Supabase usa templates Go. Variables exposicionadas en *Confirm signup*:

- `{{ .ConfirmationURL }}` — link único de confirmación.
- `{{ .Email }}` — email del usuario (opcional, usado en el footer del template).
- `{{ .Token }}` y `{{ .TokenHash }}` — disponibles si se prefiere flujo OTP/manual.
- `{{ .SiteURL }}` — URL configurada en Auth Settings.

Más detalle en la [doc oficial](https://supabase.com/docs/guides/auth/auth-email-templates).

## Compatibilidad

Las plantillas están diseñadas para:

- Gmail (web, iOS, Android)
- Outlook 2007+ (con conditional comments + VML para botón)
- Apple Mail
- Yahoo Mail
- Modo oscuro forzado (con `color-scheme: dark light`)

Reglas que respetan:

- Layout 100% basado en `<table>` (no flexbox, no grid).
- **Estilos inline** en cada elemento (no `<style>` externo salvo `@media` queries).
- Sin web fonts custom (fallback a Arial/Helvetica system).
- Imágenes con `alt`, `border="0"`, `style="display:block"`.
- Botón bulletproof con `<v:roundrect>` para Outlook.

## Limitaciones del free tier de Supabase

Supabase Auth en plan gratuito limita los emails a aproximadamente **3-4 por hora por proyecto** y los envía desde un dominio compartido (mayor riesgo de spam).

Para producción se recomienda configurar **SMTP propio** en *Project Settings → Auth → SMTP Settings*. Opciones probadas:

| Proveedor | Free tier | Nota |
|---|---|---|
| [Resend](https://resend.com) | 3.000/mes | DX moderna, dominio verificado por DNS. Recomendado. |
| [SendGrid](https://sendgrid.com) | 100/día | Veterano, panel completo. |
| [Postmark](https://postmarkapp.com) | 100 trial | Excelente entregabilidad transaccional. |
| AWS SES | 62.000/mes (desde EC2) | Más barato a escala, requiere salir de sandbox. |

Configuración mínima en Supabase tras elegir proveedor:

- `Sender email`: `noreply@escueladelariqueza.com` (o el dominio verificado).
- `Sender name`: `Escuela de la Riqueza`.
- Host, puerto, user, pass: del proveedor.

Sin SMTP custom no es viable lanzar a producción con muchos signups simultáneos.

## Próximas plantillas

- [ ] `magic-link.html`
- [ ] `recovery.html` (reset password)
- [ ] `change-email.html`
- [ ] `invite.html`
