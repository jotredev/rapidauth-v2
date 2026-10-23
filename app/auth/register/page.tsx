import { redirectToFirstRunIfNoAdmin } from "@/lib/first-run-admin";
import { RegisterForm } from "@/components/auth";
import { getSession } from "@/lib/auth";
import { getEnv } from "@/lib/env";
import { redirect } from "next/navigation";

export default async function RegisterPage() {
  await redirectToFirstRunIfNoAdmin();
  const session = await getSession();
  if (session) redirect("/dashboard");
  const { google, github, turnstile } = getEnv().config;

  return (
    <RegisterForm
      googleEnabled={google.enabled}
      githubEnabled={github.enabled}
      turnstileSiteKey={turnstile.enabled ? turnstile.siteKey : undefined}
    />
  );
}
