"use client";

import * as React from "react";
import { useTransition } from "react";
import { useRouter } from "nextjs-toploader/app";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { REGEXP_ONLY_DIGITS } from "input-otp";
import {
  Lock,
  Loader2,
  Mail,
  RefreshCw,
  Eye,
  EyeOff,
  ArrowLeft,
} from "lucide-react";

import {
  resetPasswordWithCodeSchema,
  type ResetPasswordWithCodeFormData,
} from "@/validations/auth";
import {
  forgotPasswordAction,
  resetPasswordWithCodeAction,
} from "@/actions/auth";
import { VERIFICATION_CODE_POLICY } from "@/lib/verification-code-policy";

import { AuthCard, AuthLink } from "./auth-card";
import { SupportLink } from "./support-link";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  FormDescription,
} from "@/components/ui/form";
import {
  TurnstileWidget,
} from "./turnstile-widget";

interface ResetPasswordFormProps {
  email?: string;
  sent?: string;
  turnstileSiteKey?: string;
}

export function ResetPasswordForm({
  email = "",
  sent,
  turnstileSiteKey,
}: ResetPasswordFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [isResending, setIsResending] = React.useState(false);
  const [resendCooldown, setResendCooldown] = React.useState<number>(() =>
    sent === "1" ? VERIFICATION_CODE_POLICY.resendCooldownSeconds : 0
  );
  const [resendNotice, setResendNotice] = React.useState<string | null>(null);
  const [formError, setFormError] = React.useState<string | null>(null);
  const [showPassword, setShowPassword] = React.useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = React.useState(false);
  const [captchaToken, setCaptchaToken] = React.useState<string | null>(null);
  const [captchaResetKey, setCaptchaResetKey] = React.useState(0);

  React.useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setTimeout(() => {
      setResendCooldown((prev) => prev - 1);
    }, 1000);
    return () => clearTimeout(timer);
  }, [resendCooldown]);

  const form = useForm<ResetPasswordWithCodeFormData>({
    resolver: zodResolver(resetPasswordWithCodeSchema),
    defaultValues: {
      email,
      code: "",
      password: "",
      confirmPassword: "",
    },
  });

  const onSubmit = (values: ResetPasswordWithCodeFormData) => {
    setFormError(null);
    startTransition(async () => {
      const result = await resetPasswordWithCodeAction(values);

      if (result.response === "error") {
        setFormError(result.message);
        return;
      }

      router.push("/auth/login?notice=password-reset");
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

    const result = await forgotPasswordAction(
      { email: currentEmail },
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
      title="Reset your password"
      description="Enter your email, verification code, and new password"
      footer={
        <div className="space-y-2">
          <div>
            <AuthLink href="/auth/login">
              <span className="inline-flex items-center gap-1">
                <ArrowLeft className="h-3 w-3" />
                Back to sign in
              </span>
            </AuthLink>
          </div>
          <SupportLink />
        </div>
      }
    >
      <div className="space-y-4">
        {(sent === "1" || resendNotice) && (
          <Alert>
            <AlertDescription>
              If an account exists for this email, we sent a code. If it doesn&apos;t arrive in a few minutes,{" "}
              <AuthLink href="/support">contact support</AuthLink>.
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

            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>New Password</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <Lock
                        className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground"
                        strokeWidth={1.5}
                      />
                      <Input
                        type={showPassword ? "text" : "password"}
                        placeholder="Enter new password"
                        className="pl-10 pr-10"
                        disabled={isPending}
                        {...field}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                        tabIndex={-1}
                      >
                        {showPassword ? (
                          <EyeOff className="h-4 w-4" strokeWidth={1.5} />
                        ) : (
                          <Eye className="h-4 w-4" strokeWidth={1.5} />
                        )}
                      </button>
                    </div>
                  </FormControl>
                  <FormDescription>
                    Must be at least 8 characters with uppercase and number
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="confirmPassword"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Confirm New Password</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <Lock
                        className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground"
                        strokeWidth={1.5}
                      />
                      <Input
                        type={showConfirmPassword ? "text" : "password"}
                        placeholder="Confirm new password"
                        className="pl-10 pr-10"
                        disabled={isPending}
                        {...field}
                      />
                      <button
                        type="button"
                        onClick={() =>
                          setShowConfirmPassword(!showConfirmPassword)
                        }
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                        tabIndex={-1}
                      >
                        {showConfirmPassword ? (
                          <EyeOff className="h-4 w-4" strokeWidth={1.5} />
                        ) : (
                          <Eye className="h-4 w-4" strokeWidth={1.5} />
                        )}
                      </button>
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Button type="submit" className="w-full" disabled={isPending}>
              {isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Resetting password...
                </>
              ) : (
                "Reset password"
              )}
            </Button>

            <div className="space-y-3 pt-2">
              <TurnstileWidget
                siteKey={turnstileSiteKey}
                action="forgot-password"
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
