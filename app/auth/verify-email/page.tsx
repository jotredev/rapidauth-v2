import { VerifyEmailForm } from "@/components/auth";

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

  return (
    <VerifyEmailForm email={email} delivery={delivery} sent={sent} />
  );
}
