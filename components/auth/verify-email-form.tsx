"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { AuthCard, AuthLink } from "./auth-card";
import { SupportLink } from "./support-link";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Mail, Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { resendVerificationEmailAction } from '@/actions/auth';
import {
  TurnstileWidget,
  isTurnstileEnabled,
} from './turnstile-widget';

interface VerifyEmailFormProps {
  email?: string;
  delivery?: string;
}

export function VerifyEmailForm({
  email = "your email",
  delivery,
}: VerifyEmailFormProps) {
  const router = useRouter();
  const [isPending, setIsPending] = React.useState(false);
  const [resendCooldown, setResendCooldown] = React.useState(0);
  const [resendStatus, setResendStatus] = React.useState<'idle' | 'success'>('idle');
  const [captchaToken, setCaptchaToken] = React.useState<string | null>(null);
  const [captchaResetKey, setCaptchaResetKey] = React.useState(0);

  React.useEffect(() => {
    if (resendCooldown > 0) {
      const timer = setTimeout(
        () => setResendCooldown(resendCooldown - 1),
        1000
      );
      return () => clearTimeout(timer);
    }
  }, [resendCooldown]);

  const handleResend = async () => {
    if (!email || email === 'your email') return;

    setIsPending(true);

    const result = await resendVerificationEmailAction(
      email,
      captchaToken ?? undefined
    );
    setCaptchaToken(null);
    setCaptchaResetKey((key) => key + 1);

    if (result.response === 'error') {
      toast.error(result.message);
    } else {
      setResendStatus('success');
      setResendCooldown(60);
    }

    setIsPending(false);
  };

  return (
    <AuthCard
      title="Verify your email"
      description="We've sent a verification link to your email"
      footer={
        <div className="space-y-2">
          <div>
            Wrong email?{" "}
            <AuthLink href="/auth/register">Use a different email</AuthLink>
          </div>
          <SupportLink />
        </div>
      }
    >
      <div className="flex flex-col items-center py-4 space-y-6">
        {delivery === 'failed' && resendStatus !== 'success' && (
          <Alert variant="destructive" className="w-full">
            <AlertDescription>
              We couldn&apos;t send the verification email. Try again in a few minutes or{' '}
              <AuthLink href="/support">contact support</AuthLink>.
            </AlertDescription>
          </Alert>
        )}

        {resendStatus === 'success' && (
          <Alert className="w-full">
            <AlertDescription>
              If an account exists for this email, we sent you an email. If it doesn&apos;t arrive in a few minutes,{' '}
              <AuthLink href="/support">contact support</AuthLink>.
            </AlertDescription>
          </Alert>
        )}
        <div className="w-16 h-16 bg-primary/10 border border-primary/20 flex items-center justify-center">
          <Mail className="h-8 w-8 text-primary" strokeWidth={1.5} />
        </div>

        <div className="text-center space-y-2">
          <p className="text-sm text-muted-foreground">
            We sent a verification link to
          </p>
          <p className="font-medium">{email}</p>
          <p className="text-sm text-muted-foreground">
            Click the link in the email to verify your account.
          </p>
        </div>

        <div className="w-full space-y-3">
          <TurnstileWidget
            action="resend-verification"
            onToken={setCaptchaToken}
            resetKey={captchaResetKey}
          />
          <Button
            variant="outline"
            className="w-full"
            onClick={handleResend}
            disabled={
              isPending ||
              resendCooldown > 0 ||
              (isTurnstileEnabled && !captchaToken)
            }
          >
            {isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Sending...
              </>
            ) : resendCooldown > 0 ? (
              <>
                <RefreshCw className="mr-2 h-4 w-4" />
                Resend in {resendCooldown}s
              </>
            ) : (
              <>
                <RefreshCw className="mr-2 h-4 w-4" />
                Resend verification email
              </>
            )}
          </Button>

          <Button
            variant="ghost"
            className="w-full"
            onClick={() => router.push("/auth/login")}
          >
            Back to sign in
          </Button>
        </div>
      </div>
    </AuthCard>
  );
}
