// Plantilla HTML del recordatorio de live VIP, self-contained (mismo criterio
// que _welcome-template.ts: sin importar emails/*.tsx, que Vercel no empaqueta).
//
// GEMELO DE DISEÑO: emails/LiveReminderEmail.tsx (preview con `npm run email:dev`).
// Si tocás una, tocá la otra.

interface LiveReminderArgs {
  firstName?: string;
  liveTitle: string;
  /** Fecha/hora ya formateada y localizada, ej. "hoy a las 8:00 p. m.". */
  startsAtLabel: string;
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

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function liveReminderHtml({
  firstName = '',
  liveTitle,
  startsAtLabel,
  ctaUrl,
}: LiveReminderArgs): string {
  const name = escapeHtml(firstName.trim());
  const hello = name ? `${name}, ` : '';
  const title = escapeHtml(liveTitle);
  const when = escapeHtml(startsAtLabel);
  const safeCta = escapeHtml(ctaUrl);

  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="color-scheme" content="dark">
<title>Tu live VIP empieza pronto</title>
</head>
<body style="margin:0;padding:24px 12px;background-color:${C.darker};font-family:Inter,-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:${C.darker};">
<tr><td align="center">
  <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background-color:${C.dark};border:1px solid ${C.border};border-radius:16px;overflow:hidden;">
    <tr><td style="padding:32px 40px 24px;text-align:center;border-bottom:1px solid ${C.border};">
      <p style="margin:0;font-size:17px;font-weight:700;letter-spacing:3px;color:${C.gold};text-transform:uppercase;">Escuela de la Riqueza</p>
    </td></tr>
    <tr><td style="padding:40px;">
      <p style="margin:0 0 8px;font-size:12px;font-weight:700;letter-spacing:2px;color:${C.gold};text-transform:uppercase;">En vivo · VIP</p>
      <h1 style="margin:0 0 20px;font-size:26px;line-height:34px;font-weight:700;color:${C.textMain};">Tu live empieza pronto</h1>
      <p style="margin:0 0 20px;font-size:16px;line-height:26px;color:${C.textMain};">${hello}en breve arranca el live en vivo con Iván. No te lo pierdas.</p>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 24px;background-color:${C.darker};border:1px solid ${C.border};border-radius:12px;">
        <tr><td style="padding:20px 24px;">
          <p style="margin:0 0 6px;font-size:18px;line-height:24px;font-weight:700;color:${C.gold};">${title}</p>
          <p style="margin:0;font-size:14px;line-height:20px;color:${C.textMuted};">Comienza ${when}</p>
        </td></tr>
      </table>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 28px;"><tr><td align="center">
        <table role="presentation" cellpadding="0" cellspacing="0"><tr><td style="border-radius:10px;background-color:${C.gold};">
          <a href="${safeCta}" style="display:inline-block;padding:14px 34px;font-size:15px;font-weight:700;color:${C.darker};text-decoration:none;">Entrar a la sala</a>
        </td></tr></table>
      </td></tr></table>
      <p style="margin:0;font-size:13px;line-height:20px;color:${C.textMuted};">Si el botón no abre, la sala está en tu panel, en la sección de lives.</p>
    </td></tr>
    <tr><td style="border-top:1px solid ${C.border};padding:24px 40px;text-align:center;">
      <p style="margin:0;font-size:12px;line-height:20px;color:${C.textMuted};">Escuela de la Riqueza &middot; Iván Mazo</p>
      <p style="margin:6px 0 0;font-size:12px;line-height:18px;color:${C.textMuted};">Recibiste este correo porque tu plan incluye acceso a los lives.</p>
    </td></tr>
  </table>
</td></tr>
</table>
</body>
</html>`;
}
