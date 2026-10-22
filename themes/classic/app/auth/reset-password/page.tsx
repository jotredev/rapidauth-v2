import { ResetPasswordForm } from "@/components/auth";
import { getSession } from "@/lib/auth";
import { getEnv } from "@/lib/env";
import { redirect } from "next/navigation";

interface ResetPasswordPageProps {
  searchParams: Promise<{
    token?: string;
    email?: string;
    sent?: string;
  }>;
}

export default async function ResetPasswordPage({
  searchParams,
}: ResetPasswordPageProps) {
  const session = await getSession();
  if (session) redirect("/dashboard");

  const { token, email, sent } = await searchParams;

  if (token) {
    redirect("/auth/forgot-password");
  }

  const { turnstile } = getEnv().config;
  const turnstileSiteKey = turnstile.enabled ? turnstile.siteKey : undefined;

  return (
    <ResetPasswordForm email={email} sent={sent} turnstileSiteKey={turnstileSiteKey} />
  );
}
