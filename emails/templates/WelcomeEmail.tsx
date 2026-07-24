import {
  Html,
  Text,
  Button,
  Heading,
  Preview,
  Section,
  Container,
} from "react-email";

interface WelcomeEmailProps {
  username: string;
  appUrl: string;
}

export default function WelcomeEmail({ username, appUrl }: WelcomeEmailProps) {
  return (
    <Html>
      <Preview>Bienvenido a Pick Verso, {username}!</Preview>
      <Container
        style={{
          maxWidth: "580px",
          margin: "0 auto",
          fontFamily: "Arial, sans-serif",
        }}
      >
        <Section style={{ textAlign: "center", padding: "24px 0" }}>
          <Heading
            style={{
              fontSize: "24px",
              color: "#111827",
              margin: "0 0 16px",
            }}
          >
            Bienvenido a Pick Verso
          </Heading>
          <Text
            style={{
              fontSize: "16px",
              color: "#374151",
              lineHeight: "24px",
            }}
          >
            Hola <strong>{username}</strong>, gracias por unirte a la
            plataforma.
          </Text>
          <Text
            style={{
              fontSize: "16px",
              color: "#374151",
              lineHeight: "24px",
            }}
          >
            Explora tipsters, sigue tus picks y gestiona tus apuestas en un solo
            lugar.
          </Text>
          <Button
            href={appUrl}
            style={{
              backgroundColor: "#2563eb",
              color: "#ffffff",
              padding: "12px 24px",
              borderRadius: "6px",
              textDecoration: "none",
              fontWeight: "bold",
              display: "inline-block",
              marginTop: "16px",
            }}
          >
            Explorar la plataforma
          </Button>
        </Section>
        <Section
          style={{
            textAlign: "center",
            padding: "24px 0",
            fontSize: "12px",
            color: "#9ca3af",
          }}
        >
          <Text style={{ margin: 0 }}>
            Pick Verso Platform - La mejor plataforma de tips deportivos
          </Text>
        </Section>
      </Container>
    </Html>
  );
}
