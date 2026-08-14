// Plantilla HTML del correo de bienvenida, self-contained (sin importar
// emails/*.tsx — Vercel NO empaqueta esa carpeta dentro de la Function, y el
// import extensionless a un .tsx externo hacía crashear la Function al arrancar
// con ERR_MODULE_NOT_FOUND).
//
// GEMELO DE DISEÑO: emails/WelcomeEmail.tsx es la versión React Email, que sirve
// para iterar visualmente con `npm run email:dev`. Esta es la que se ENVÍA. Si
// tocás una, tocá la otra (misma paleta gold/dark, mismo texto).

interface WelcomeEmailArgs {
  firstName?: string;
  ctaUrl: string;
}

const C = {
  dark: '#121212',
  darker: '#0a0a0a',
  gold: '#CCA43B',
  textMain: '#E5E5E5',
  textMuted: '#A3A3A3',
  border: '#2a2a2a',
};

const BENEFITS = [
  'Contenido para transformar tu mentalidad financiera, a tu ritmo.',
  'Una comunidad que va en la misma dirección que tú.',
  'El acompañamiento de Iván Mazo en cada etapa del camino.',
];

// El nombre viene de datos del usuario: escapar para no romper el HTML ni abrir
// inyección en el correo.
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function welcomeEmailHtml({ firstName = '', ctaUrl }: WelcomeEmailArgs): string {
  const name = escapeHtml(firstName.trim());
  const greeting = name ? `¡Bienvenido, ${name}!` : '¡Bienvenido!';
  const safeCta = escapeHtml(ctaUrl);

  const bullets = BENEFITS.map(
    (b) =>
      `<p style="margin:0 0 10px;font-size:15px;line-height:24px;color:${C.textMain};">` +
      `<span style="color:${C.gold};font-weight:700;">&bull;&nbsp;&nbsp;</span>${b}</p>`,
  ).join('');

  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="color-scheme" content="dark">
<title>Bienvenido a la Escuela de la Riqueza</title>
</head>
<body style="margin:0;padding:24px 12px;background-color:${C.darker};font-family:Inter,-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:${C.darker};">
<tr><td align="center">
  <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background-color:${C.dark};border:1px solid ${C.border};border-radius:16px;overflow:hidden;">
    <tr><td style="padding:32px 40px 24px;text-align:center;border-bottom:1px solid ${C.border};">
      <p style="margin:0;font-size:17px;font-weight:700;letter-spacing:3px;color:${C.gold};text-transform:uppercase;">Escuela de la Riqueza</p>
    </td></tr>
    <tr><td style="padding:40px;">
      <h1 style="margin:0 0 20px;font-size:26px;line-height:34px;font-weight:700;color:${C.textMain};">${greeting}</h1>
      <p style="margin:0 0 16px;font-size:16px;line-height:26px;color:${C.textMain};">Acabas de dar un paso que muy pocos dan: decidir que tu relación con el dinero va a cambiar. Desde hoy eres parte de la Escuela de la Riqueza, y no vas a caminar esto solo.</p>
      <p style="margin:0 0 12px;font-size:15px;line-height:24px;color:${C.textMuted};">Aquí adentro te espera:</p>
      ${bullets}
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:28px 0 32px;"><tr><td align="center">
        <table role="presentation" cellpadding="0" cellspacing="0"><tr><td style="border-radius:10px;background-color:${C.gold};">
          <a href="${safeCta}" style="display:inline-block;padding:14px 34px;font-size:15px;font-weight:700;color:${C.darker};text-decoration:none;">Entrar a la plataforma</a>
        </td></tr></table>
      </td></tr></table>
      <p style="margin:0;font-size:15px;line-height:24px;color:${C.textMain};">Nos vemos adentro. Esto apenas empieza.</p>
      <p style="margin:4px 0 0;font-size:15px;line-height:24px;font-weight:700;color:${C.gold};">Iván Mazo</p>
    </td></tr>
    <tr><td style="border-top:1px solid ${C.border};padding:24px 40px;text-align:center;">
      <p style="margin:0;font-size:12px;line-height:20px;color:${C.textMuted};">Escuela de la Riqueza &middot; Iván Mazo</p>
      <p style="margin:6px 0 0;font-size:12px;line-height:18px;color:${C.textMuted};">Recibiste este correo porque tienes una cuenta en nuestra plataforma.</p>
    </td></tr>
  </table>
</td></tr>
</table>
</body>
</html>`;
}
