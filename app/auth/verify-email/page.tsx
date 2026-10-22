import { VerifyEmailForm } from "@/components/auth";
import { getEnv } from "@/lib/env";

interface VerifyEmailPageProps {
  searchParams: Promise<{
    email?: string;
    delivery?: string;
    sent?: string;
  }>;
}

export default async function VerifyEmailPage({
  searchParams,
}: VerifyEmailPageProps) {
  const { email, delivery, sent } = await searchParams;

  const { turnstile } = getEnv().config;
  const turnstileSiteKey = turnstile.enabled ? turnstile.siteKey : undefined;

  return (
    <VerifyEmailForm
      email={email}
      delivery={delivery}
      sent={sent}
      turnstileSiteKey={turnstileSiteKey}
    />
  );
}
