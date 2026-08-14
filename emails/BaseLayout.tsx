import {
  Body,
  Container,
  Head,
  Hr,
  Html,
  Preview,
  Section,
  Text,
} from "@react-email/components";
import type { ReactNode } from "react";

/**
 * Design system del correo. Fuente única de la marca (paleta gold/dark de la
 * escuela). Todos los emails de la app envuelven su contenido acá para que
 * header y footer sean idénticos en los siete tipos de correo.
 *
 * La misma salida se puede renderizar a HTML (`render()`) y pegar en el editor
 * de plantillas de Supabase para que los mails de auth compartan este diseño.
 */

export const colors = {
  dark: "#121212",
  darker: "#0a0a0a",
  gold: "#CCA43B",
  goldHover: "#E1B846",
  textMain: "#E5E5E5",
  textMuted: "#A3A3A3",
  border: "#2a2a2a",
} as const;

const fontStack = "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif";

interface BaseLayoutProps {
  preview: string;
  children: ReactNode;
}

export function BaseLayout({ preview, children }: BaseLayoutProps) {
  return (
    <Html lang="es">
      <Head />
      <Preview>{preview}</Preview>
      <Body
        style={{
          backgroundColor: colors.darker,
          margin: 0,
          padding: "24px 12px",
          fontFamily: fontStack,
        }}
      >
        <Container
          style={{
            backgroundColor: colors.dark,
            borderRadius: 16,
            maxWidth: 560,
            margin: "0 auto",
            overflow: "hidden",
            border: `1px solid ${colors.border}`,
          }}
        >
          {/* Header — wordmark tipográfico (PNG del logo va acá cuando exista) */}
          <Section
            style={{
              padding: "32px 40px 24px",
              textAlign: "center",
              borderBottom: `1px solid ${colors.border}`,
            }}
          >
            <Text
              style={{
                margin: 0,
                fontSize: 17,
                fontWeight: 700,
                letterSpacing: "3px",
                color: colors.gold,
                textTransform: "uppercase",
              }}
            >
              Escuela de la Riqueza
            </Text>
          </Section>

          {/* Contenido */}
          <Section style={{ padding: "40px" }}>{children}</Section>

          {/* Footer */}
          <Hr style={{ borderColor: colors.border, margin: 0 }} />
          <Section style={{ padding: "24px 40px" }}>
            <Text
              style={{
                margin: 0,
                fontSize: 12,
                lineHeight: "20px",
                color: colors.textMuted,
                textAlign: "center",
              }}
            >
              Escuela de la Riqueza · Iván Mazo
            </Text>
            <Text
              style={{
                margin: "6px 0 0",
                fontSize: 12,
                lineHeight: "18px",
                color: colors.textMuted,
                textAlign: "center",
              }}
            >
              Recibiste este correo porque tienes una cuenta en nuestra plataforma.
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}
