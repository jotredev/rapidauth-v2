import { ForgotPasswordForm } from "@/components/auth";
import { getSession } from "@/lib/auth";
import { getEnv } from "@/lib/env";
import { redirect } from "next/navigation";

export default async function ForgotPasswordPage() {
  const session = await getSession();
  if (session) redirect("/dashboard");

  const { turnstile } = getEnv().config;
  const turnstileSiteKey = turnstile.enabled ? turnstile.siteKey : undefined;

  return <ForgotPasswordForm turnstileSiteKey={turnstileSiteKey} />;
}
