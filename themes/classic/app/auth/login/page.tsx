import { LoginForm } from "@/components/auth";
import { getSession } from "@/lib/auth";
import { getEnv } from "@/lib/env";
import { getLoginNotice } from "@/lib/login-notices";
import { redirect } from "next/navigation";

interface LoginPageProps {
  searchParams: Promise<{
    error?: string;
    provider?: string;
    notice?: string | string[];
  }>;
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const session = await getSession();
  if (session) redirect("/dashboard");
  const { google, github } = getEnv().config;

  const { error, provider, notice } = await searchParams;
  const normalizedError = error?.toLowerCase().replaceAll('_', ' ');
  const oauthSignupDisabled = normalizedError?.includes('signup disabled');
  const oauthSignupDisabledProvider = oauthSignupDisabled
    ? provider === 'github'
      ? 'GitHub'
      : provider === 'google'
        ? 'Google'
        : undefined
    : undefined;

  return (
    <LoginForm
      oauthSignupDisabledProvider={oauthSignupDisabledProvider}
      notice={getLoginNotice(notice)}
      googleEnabled={google.enabled}
      githubEnabled={github.enabled}
    />
  );
}
