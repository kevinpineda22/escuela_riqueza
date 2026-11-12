# Plantillas de correo de Supabase

Los correos de **confirmar registro** y **restablecer contraseña** los manda Supabase Auth (por el SMTP de Resend), no nuestro código. Su diseño vive en el panel de Supabase; estos archivos son la fuente para copiarlo.

## ⚠️ Orden: primero el deploy, después las plantillas

Los botones de estas plantillas llevan un `token_hash` que solo entienden `/restablecer-contrasena` y `/cuenta-verificada` desde el cambio del 2026-11-04. Si se pegan las plantillas con la web anterior en producción, **los links fallan**. Primero se deploya, después se pegan.

## Cómo pegarlas

Supabase → **Authentication → Emails → Templates**:

| Plantilla de Supabase | Asunto | Cuerpo (Source) |
|---|---|---|
| **Confirm signup** | `Confirma tu correo · Escuela de la Riqueza` | `confirmar-registro.html` |
| **Reset Password** | `Restablece tu contraseña · Escuela de la Riqueza` | `restablecer-contrasena.html` |

Pegar el archivo completo en *Source* y guardar. Las demás (Magic Link, Invite, Change Email) la app no las usa.

**Site URL** (Authentication → URL Configuration) tiene que ser `https://www.escueladelariqueza.com`: los botones usan `{{ .SiteURL }}`.

## Por qué el link lleva a una página con botón

Outlook y Hotmail (Microsoft Defender "Safe Links") **abren los links del correo antes que la persona** para revisarlos. Los links de Supabase sirven una sola vez: con el link de siempre, el escáner lo gastaba y al alumno le salía "enlace vencido". Con `token_hash`, abrir la página no gasta nada; el enlace se usa recién cuando la persona toca **Continuar** / **Confirmar mi correo** (`verifyEmailLink` en `src/lib/api/auth.ts`).

Los links viejos (los que ya están en bandejas de entrada) siguen funcionando: las páginas aceptan los dos formatos.

## Diseño

Misma paleta que la bienvenida (`api/notifications/_welcome-template.ts`): gold `#CCA43B`, fondo `#121212` / `#0a0a0a`, texto `#E5E5E5` / `#A3A3A3`. Copy en español neutro con "tú".
