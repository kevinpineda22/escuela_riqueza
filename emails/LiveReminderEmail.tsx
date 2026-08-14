import { Button, Heading, Section, Text } from "@react-email/components";
import { BaseLayout, colors } from "./BaseLayout";

interface LiveReminderEmailProps {
  firstName?: string;
  liveTitle: string;
  startsAtLabel: string;
  ctaUrl: string;
}

export default function LiveReminderEmail({
  firstName = "",
  liveTitle = "Cómo pensar en abundancia",
  startsAtLabel = "hoy a las 8:00 p. m.",
  ctaUrl = "https://escuela-riqueza.vercel.app/vip-live",
}: LiveReminderEmailProps) {
  const hello = firstName.trim() ? `${firstName.trim()}, ` : "";

  return (
    <BaseLayout preview="Tu live VIP con Iván empieza pronto.">
      <Text
        style={{
          margin: "0 0 8px",
          fontSize: 12,
          fontWeight: 700,
          letterSpacing: "2px",
          color: colors.gold,
          textTransform: "uppercase",
        }}
      >
        En vivo · VIP
      </Text>
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
        Tu live empieza pronto
      </Heading>

      <Text style={{ margin: "0 0 20px", fontSize: 16, lineHeight: "26px", color: colors.textMain }}>
        {hello}en breve arranca el live en vivo con Iván. No te lo pierdas.
      </Text>

      <Section
        style={{
          margin: "0 0 24px",
          backgroundColor: colors.darker,
          border: `1px solid ${colors.border}`,
          borderRadius: 12,
          padding: "20px 24px",
        }}
      >
        <Text style={{ margin: "0 0 6px", fontSize: 18, lineHeight: "24px", fontWeight: 700, color: colors.gold }}>
          {liveTitle}
        </Text>
        <Text style={{ margin: 0, fontSize: 14, lineHeight: "20px", color: colors.textMuted }}>
          Comienza {startsAtLabel}
        </Text>
      </Section>

      <Section style={{ textAlign: "center", margin: "0 0 28px" }}>
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
          Entrar a la sala
        </Button>
      </Section>

      <Text style={{ margin: 0, fontSize: 13, lineHeight: "20px", color: colors.textMuted }}>
        Si el botón no abre, la sala está en tu panel, en la sección de lives.
      </Text>
    </BaseLayout>
  );
}

LiveReminderEmail.PreviewProps = {
  firstName: "Johan",
  liveTitle: "Cómo pensar en abundancia",
  startsAtLabel: "hoy a las 8:00 p. m.",
  ctaUrl: "https://escuela-riqueza.vercel.app/vip-live",
} satisfies LiveReminderEmailProps;
