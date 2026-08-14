// Prueba de humo del correo de bienvenida contra Resend (dominio de prueba).
// Uso:  npm run welcome:test
// Requiere RESEND_API_KEY en .env  (se carga con --env-file, ver package.json).
//
// OJO sandbox: con el dominio de prueba (onboarding@resend.dev) Resend SOLO
// deja enviar al correo con el que creaste la cuenta. Por eso TO está fijo.

import { readFile } from "node:fs/promises";
import { Resend } from "resend";

const apiKey = process.env.RESEND_API_KEY;
if (!apiKey) {
  console.error(
    "\n❌ Falta RESEND_API_KEY.\n   Agregala en .env  →  RESEND_API_KEY=re_...\n"
  );
  process.exit(1);
}

const FROM = "Escuela de la Riqueza <onboarding@resend.dev>";
const TO = "escueladelariquezaweb@gmail.com"; // único permitido en sandbox

const html = await readFile(
  new URL("../.emails-out/WelcomeEmail.html", import.meta.url),
  "utf8"
);

const resend = new Resend(apiKey);
const { data, error } = await resend.emails.send({
  from: FROM,
  to: TO,
  subject: "¡Bienvenido a la Escuela de la Riqueza!",
  html,
});

if (error) {
  console.error("\n❌ Error al enviar:", error, "\n");
  process.exit(1);
}

console.log(`\n✅ Enviado. id=${data?.id}\n   Revisá la bandeja de ${TO}\n`);
