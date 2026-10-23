import { FirstRunAdminForm, FirstRunClosed } from "@/components/auth";
import { getEnv } from "@/lib/env";
import { getFirstRunState } from "@/lib/first-run-admin";
import { redirect } from "next/navigation";
import { connection } from "next/server";

export default async function SetupPage() {
  await connection();
  const state = await getFirstRunState();
  if (state === "completed") redirect("/auth/login");
  if (state === "closed") return <FirstRunClosed />;

  const { turnstile } = getEnv().config;

  return (
    <FirstRunAdminForm
      turnstileSiteKey={turnstile.enabled ? turnstile.siteKey : undefined}
    />
  );
}
