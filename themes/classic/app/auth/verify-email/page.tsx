import { VerifyEmailForm } from "@/components/auth";

interface VerifyEmailPageProps {
  searchParams: Promise<{ email?: string; delivery?: string }>;
}

export default async function VerifyEmailPage({
  searchParams,
}: VerifyEmailPageProps) {
  const { email, delivery } = await searchParams;

  return <VerifyEmailForm email={email} delivery={delivery} />;
}
