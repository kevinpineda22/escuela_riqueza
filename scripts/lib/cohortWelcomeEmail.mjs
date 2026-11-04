// Correo de bienvenida de una cohorte (alta masiva): acceso con contraseña
// temporal. Misma paleta y estructura que api/notifications/_welcome-template.ts
// (la bienvenida de quien se registra solo). Si cambia el diseño de una, revisar
// la otra.

const C = {
  dark: "#121212",
  darker: "#0a0a0a",
  gold: "#CCA43B",
  textMain: "#E5E5E5",
  textMuted: "#A3A3A3",
  border: "#2a2a2a",
};

// Nombre, correo y contraseña van dentro del HTML: escapar siempre.
function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export const COHORT_WELCOME_SUBJECT = "Tu acceso a la Escuela de la Riqueza";

/**
 * @param {{ firstName?: string, email: string, tempPassword: string, loginUrl: string, cohortLabel?: string }} args
 */
export function cohortWelcomeEmail({ firstName = "", email, tempPassword, loginUrl, cohortLabel = "" }) {
  const name = escapeHtml(firstName.trim());
  // Saludo neutro: la cohorte es mixta.
  const greeting = name ? `¡Hola, ${name}!` : "¡Hola!";
  const safeEmail = escapeHtml(email);
  const safePassword = escapeHtml(tempPassword);
  const safeLogin = escapeHtml(loginUrl);
  const cohortLine = cohortLabel
    ? `<p style="margin:0 0 16px;font-size:15px;line-height:24px;color:${C.textMuted};">${escapeHtml(cohortLabel)}</p>`
    : "";

  const html = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="color-scheme" content="dark">
<title>${COHORT_WELCOME_SUBJECT}</title>
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
      ${cohortLine}
      <p style="margin:0 0 20px;font-size:16px;line-height:26px;color:${C.textMain};">Te damos la bienvenida a la plataforma de la Escuela de la Riqueza: tu cuenta ya está lista. Estos son tus datos para entrar:</p>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 24px;background-color:${C.darker};border:1px solid ${C.border};border-radius:12px;">
        <tr><td style="padding:18px 22px 6px;">
          <p style="margin:0;font-size:12px;letter-spacing:1px;text-transform:uppercase;color:${C.textMuted};">Correo</p>
          <p style="margin:4px 0 0;font-size:16px;font-weight:700;color:${C.textMain};word-break:break-all;">${safeEmail}</p>
        </td></tr>
        <tr><td style="padding:12px 22px 18px;">
          <p style="margin:0;font-size:12px;letter-spacing:1px;text-transform:uppercase;color:${C.textMuted};">Contraseña temporal</p>
          <p style="margin:4px 0 0;font-size:20px;font-weight:700;letter-spacing:1px;color:${C.gold};font-family:'SFMono-Regular',Consolas,'Liberation Mono',monospace;">${safePassword}</p>
        </td></tr>
      </table>
      <p style="margin:0 0 8px;font-size:15px;line-height:24px;color:${C.textMain};">Al entrar por primera vez te pediremos que <strong>crees tu propia contraseña</strong>. La temporal deja de servir en ese momento.</p>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:28px 0 32px;"><tr><td align="center">
        <table role="presentation" cellpadding="0" cellspacing="0"><tr><td style="border-radius:10px;background-color:${C.gold};">
          <a href="${safeLogin}" style="display:inline-block;padding:14px 34px;font-size:15px;font-weight:700;color:${C.darker};text-decoration:none;">Entrar a la plataforma</a>
        </td></tr></table>
      </td></tr></table>
      <p style="margin:0;font-size:15px;line-height:24px;color:${C.textMain};">Nos vemos adentro. Esto apenas empieza.</p>
      <p style="margin:4px 0 0;font-size:15px;line-height:24px;font-weight:700;color:${C.gold};">Iván Mazo</p>
    </td></tr>
    <tr><td style="border-top:1px solid ${C.border};padding:24px 40px;text-align:center;">
      <p style="margin:0;font-size:12px;line-height:20px;color:${C.textMuted};">Escuela de la Riqueza &middot; Iván Mazo</p>
      <p style="margin:6px 0 0;font-size:12px;line-height:18px;color:${C.textMuted};">Recibiste este correo porque la escuela creó una cuenta a tu nombre. No compartas tu contraseña.</p>
    </td></tr>
  </table>
</td></tr>
</table>
</body>
</html>`;

  // Versión de texto: la muestran algunos clientes y ayuda a no caer en spam.
  const text = [
    name ? `¡Hola, ${firstName.trim()}!` : "¡Hola!",
    cohortLabel,
    "",
    "Te damos la bienvenida a la plataforma de la Escuela de la Riqueza: tu cuenta ya está lista.",
    "",
    `Correo: ${email}`,
    `Contraseña temporal: ${tempPassword}`,
    "",
    "Al entrar por primera vez te pediremos que crees tu propia contraseña.",
    `Entra aquí: ${loginUrl}`,
    "",
    "Iván Mazo · Escuela de la Riqueza",
  ]
    .filter((line, i, all) => line !== "" || all[i - 1] !== "")
    .join("\n");

  return { subject: COHORT_WELCOME_SUBJECT, html, text };
}
