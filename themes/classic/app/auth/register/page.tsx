import { RegisterForm } from "@/components/auth";
import { getSession } from "@/lib/auth";
import { getEnv } from "@/lib/env";
import { redirect } from "next/navigation";

export default async function RegisterPage() {
  const session = await getSession();
  if (session) redirect("/dashboard");
  const { google, github } = getEnv().config;

  return <RegisterForm googleEnabled={google.enabled} githubEnabled={github.enabled} />;
}
