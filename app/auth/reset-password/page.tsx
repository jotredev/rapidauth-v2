import { ResetPasswordForm } from "@/components/auth";
import { getSession } from "@/lib/auth";
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

  return <ResetPasswordForm email={email} sent={sent} />;
}
