import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Section,
  Text,
} from "react-email";

interface PasswordResetCodeEmailProps {
  name: string;
  code: string;
}

export function PasswordResetCodeEmail({
  name,
  code,
}: PasswordResetCodeEmailProps) {
  return (
    <Html>
      <Head />
      <Preview>Your password reset code</Preview>
      <Body style={main}>
        <Container style={container}>
          <Section style={box}>
            <Heading style={heading}>R A P I D</Heading>
            <Text style={paragraph}>Hi {name},</Text>
            <Text style={paragraph}>
              We received a request to reset your password. Use the verification code below to reset your password:
            </Text>
            <Section style={codeBox}>
              <Text style={codeText}>{code}</Text>
            </Section>
            <Text style={paragraph}>
              This code expires in 10 minutes.
            </Text>
            <Text style={footer}>
              If you didn&apos;t ask to reset your password, you can ignore this email. Your password won&apos;t change.
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

const main = {
  backgroundColor: "#0a0a0a",
  fontFamily:
    '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Ubuntu, sans-serif',
};

const container = {
  backgroundColor: "#0a0a0a",
  margin: "0 auto",
  padding: "20px 0 48px",
  marginBottom: "64px",
};

const box = {
  padding: "0 48px",
};

const heading = {
  color: "#fafafa",
  fontSize: "24px",
  fontWeight: "600",
  textAlign: "center" as const,
  margin: "30px 0",
  letterSpacing: "0.5em",
};

const paragraph = {
  color: "#a1a1aa",
  fontSize: "16px",
  lineHeight: "24px",
  textAlign: "left" as const,
};

const codeBox = {
  backgroundColor: "#18181b",
  borderRadius: "4px",
  margin: "24px 0",
  padding: "16px",
  textAlign: "center" as const,
};

const codeText = {
  color: "#fafafa",
  fontFamily:
    'ui-monospace, Menlo, Monaco, "Cascadia Mono", "Segoe UI Mono", "Roboto Mono", "Courier New", monospace',
  fontSize: "32px",
  fontWeight: "700",
  letterSpacing: "0.3em",
  margin: "0",
  textAlign: "center" as const,
};

const footer = {
  color: "#52525b",
  fontSize: "12px",
  lineHeight: "16px",
  marginTop: "24px",
};

export default PasswordResetCodeEmail;
