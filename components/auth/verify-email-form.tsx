"use client";

import * as React from "react";
import { useTransition } from "react";
import { useRouter } from "nextjs-toploader/app";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { REGEXP_ONLY_DIGITS } from "input-otp";
import { Mail, Loader2, RefreshCw } from "lucide-react";

import { AuthCard, AuthLink } from "./auth-card";
import { SupportLink } from "./support-link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/components/ui/input-otp";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  TurnstileWidget,
} from "./turnstile-widget";
import {
  verifyEmailCodeAction,
  resendVerificationCodeAction,
} from "@/actions/auth";
import { VERIFICATION_CODE_POLICY } from "@/lib/verification-code-policy";

const verifyEmailFormSchema = z.object({
  email: z.string().trim().email("Please enter a valid email address"),
  code: z
    .string()
    .trim()
    .length(6, "Verification code must be 6 digits")
    .regex(/^\d{6}$/, "Code must contain only digits"),
});

type VerifyEmailFormData = z.infer<typeof verifyEmailFormSchema>;

interface VerifyEmailFormProps {
  email?: string;
  delivery?: string;
  sent?: string;
  turnstileSiteKey?: string;
}

export function VerifyEmailForm({
  email = "",
  delivery,
  sent,
  turnstileSiteKey,
}: VerifyEmailFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [isResending, setIsResending] = React.useState(false);
  const [resendCooldown, setResendCooldown] = React.useState<number>(() =>
    sent === "1" ? VERIFICATION_CODE_POLICY.resendCooldownSeconds : 0
  );
  const [resendNotice, setResendNotice] = React.useState<string | null>(null);
  const [formError, setFormError] = React.useState<string | null>(null);
  const [captchaToken, setCaptchaToken] = React.useState<string | null>(null);
  const [captchaResetKey, setCaptchaResetKey] = React.useState(0);

  React.useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setTimeout(() => {
      setResendCooldown((prev) => prev - 1);
    }, 1000);
    return () => clearTimeout(timer);
  }, [resendCooldown]);

  const form = useForm<VerifyEmailFormData>({
    resolver: zodResolver(verifyEmailFormSchema),
    defaultValues: {
      email,
      code: "",
    },
  });

  const onSubmit = (values: VerifyEmailFormData) => {
    setFormError(null);
    startTransition(async () => {
      const result = await verifyEmailCodeAction(values);
      if (result.response === "error") {
        setFormError(result.message);
        return;
      }
      router.push("/auth/login?notice=email-verified");
    });
  };

  const handleResend = async () => {
    const currentEmail = form.getValues("email")?.trim();
    const emailValidation = z.string().email().safeParse(currentEmail);
    if (!emailValidation.success) {
      setFormError("Please enter a valid email address to resend the code");
      return;
    }

    setIsResending(true);
    setFormError(null);

    const result = await resendVerificationCodeAction(
      currentEmail,
      captchaToken ?? undefined
    );
    setCaptchaToken(null);
    setCaptchaResetKey((key) => key + 1);
    setIsResending(false);

    if (result.response === "error") {
      setFormError(result.message);
    } else {
      setResendNotice(result.message);
      setResendCooldown(VERIFICATION_CODE_POLICY.resendCooldownSeconds);
    }
  };

  return (
    <AuthCard
      title="Verify your email"
      description="Enter the 6-digit code sent to your email"
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
      <div className="space-y-4">
        {delivery === "failed" && !resendNotice && (
          <Alert variant="destructive">
            <AlertDescription>
              We couldn&apos;t send the verification email. Try again in a few minutes or{" "}
              <AuthLink href="/support">contact support</AuthLink>.
            </AlertDescription>
          </Alert>
        )}

        {resendNotice && (
          <Alert>
            <AlertDescription>
              {resendNotice.includes("contact support") ? (
                <>
                  If an account exists for this email, we sent a code. If it doesn&apos;t arrive in a few minutes,{" "}
                  <AuthLink href="/support">contact support</AuthLink>.
                </>
              ) : (
                resendNotice
              )}
            </AlertDescription>
          </Alert>
        )}

        {formError && (
          <Alert variant="destructive">
            <AlertDescription>{formError}</AlertDescription>
          </Alert>
        )}

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <Mail
                        className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground"
                        strokeWidth={1.5}
                      />
                      <Input
                        type="email"
                        placeholder="name@example.com"
                        className="pl-10"
                        disabled={isPending}
                        {...field}
                      />
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="code"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Verification code</FormLabel>
                  <FormControl>
                    <div className="flex justify-center py-2">
                      <InputOTP
                        maxLength={6}
                        pattern={REGEXP_ONLY_DIGITS}
                        value={field.value}
                        onChange={field.onChange}
                        disabled={isPending}
                      >
                        <InputOTPGroup>
                          <InputOTPSlot index={0} />
                          <InputOTPSlot index={1} />
                          <InputOTPSlot index={2} />
                          <InputOTPSlot index={3} />
                          <InputOTPSlot index={4} />
                          <InputOTPSlot index={5} />
                        </InputOTPGroup>
                      </InputOTP>
                    </div>
                  </FormControl>
                  <FormMessage className="text-center" />
                </FormItem>
              )}
            />

            <Button type="submit" className="w-full" disabled={isPending}>
              {isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Verifying...
                </>
              ) : (
                "Verify email"
              )}
            </Button>

            <div className="space-y-3 pt-2">
              <TurnstileWidget
                siteKey={turnstileSiteKey}
                action="resend-verification"
                onToken={setCaptchaToken}
                resetKey={captchaResetKey}
              />
              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={handleResend}
                disabled={
                  isResending ||
                  resendCooldown > 0 ||
                  (Boolean(turnstileSiteKey) && !captchaToken)
                }
              >
                {isResending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Sending...
                  </>
                ) : resendCooldown > 0 ? (
                  <>
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Resend code in {resendCooldown}s
                  </>
                ) : (
                  <>
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Resend code
                  </>
                )}
              </Button>

              <Button
                type="button"
                variant="ghost"
                className="w-full"
                onClick={() => router.push("/auth/login")}
              >
                Back to sign in
              </Button>
            </div>
          </form>
        </Form>
      </div>
    </AuthCard>
  );
}
