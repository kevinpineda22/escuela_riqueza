import { Button, Heading, Section, Text } from "@react-email/components";
import { BaseLayout, colors } from "./BaseLayout";

interface WelcomeEmailProps {
  /** Primer nombre del usuario. Si viene vacío, el saludo cae a "¡Bienvenido!". */
  firstName?: string;
  ctaUrl: string;
}

const benefits = [
  "Contenido para transformar tu mentalidad financiera, a tu ritmo.",
  "Una comunidad que va en la misma dirección que tú.",
  "El acompañamiento de Iván Mazo en cada etapa del camino.",
];

export default function WelcomeEmail({
  firstName = "",
  ctaUrl = "https://escuela-riqueza.vercel.app/dashboard",
}: WelcomeEmailProps) {
  const greeting = firstName.trim() ? `¡Bienvenido, ${firstName.trim()}!` : "¡Bienvenido!";

  return (
    <BaseLayout preview="Tu lugar en la Escuela de la Riqueza ya está listo.">
      <Heading
        as="h1"
        style={{
          margin: "0 0 20px",
          fontSize: 26,
          lineHeight: "34px",
          fontWeight: 700,
          color: colors.textMain,
        }}
      >
        {greeting}
      </Heading>

      <Text
        style={{
          margin: "0 0 16px",
          fontSize: 16,
          lineHeight: "26px",
          color: colors.textMain,
        }}
      >
        Acabas de dar un paso que muy pocos dan: decidir que tu relación con el
        dinero va a cambiar. Desde hoy eres parte de la Escuela de la Riqueza, y
        no vas a caminar esto solo.
      </Text>

      <Text
        style={{
          margin: "0 0 12px",
          fontSize: 15,
          lineHeight: "24px",
          color: colors.textMuted,
        }}
      >
        Aquí adentro te espera:
      </Text>

      <Section style={{ margin: "0 0 28px" }}>
        {benefits.map((benefit) => (
          <Text
            key={benefit}
            style={{
              margin: "0 0 10px",
              fontSize: 15,
              lineHeight: "24px",
              color: colors.textMain,
            }}
          >
            <span style={{ color: colors.gold, fontWeight: 700 }}>•&nbsp;&nbsp;</span>
            {benefit}
          </Text>
        ))}
      </Section>

      <Section style={{ textAlign: "center", margin: "0 0 32px" }}>
        <Button
          href={ctaUrl}
          style={{
            backgroundColor: colors.gold,
            color: colors.darker,
            fontSize: 15,
            fontWeight: 700,
            borderRadius: 10,
            padding: "14px 34px",
            textDecoration: "none",
            display: "inline-block",
          }}
        >
          Entrar a la plataforma
        </Button>
      </Section>

      <Text
        style={{
          margin: 0,
          fontSize: 15,
          lineHeight: "24px",
          color: colors.textMain,
        }}
      >
        Nos vemos adentro. Esto apenas empieza.
      </Text>
      <Text
        style={{
          margin: "4px 0 0",
          fontSize: 15,
          lineHeight: "24px",
          fontWeight: 700,
          color: colors.gold,
        }}
      >
        Iván Mazo
      </Text>
    </BaseLayout>
  );
}

WelcomeEmail.PreviewProps = {
  firstName: "Johan",
  ctaUrl: "https://escuela-riqueza.vercel.app/dashboard",
} satisfies WelcomeEmailProps;
