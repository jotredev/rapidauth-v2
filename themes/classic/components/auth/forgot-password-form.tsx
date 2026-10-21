"use client";

import * as React from "react";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { Mail, Loader2, ArrowLeft } from "lucide-react";

import {
  forgotPasswordSchema,
  type ForgotPasswordFormData,
} from "@/validations/auth";
import { forgotPasswordAction } from "@/actions/auth";

import { AuthCard, AuthLink } from "./auth-card";
import { SupportLink } from "./support-link";
import {
  TurnstileWidget,
  isTurnstileEnabled,
} from "./turnstile-widget";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";

export function ForgotPasswordForm() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [captchaToken, setCaptchaToken] = React.useState<string | null>(null);
  const [captchaResetKey, setCaptchaResetKey] = React.useState(0);

  const form = useForm<ForgotPasswordFormData>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: {
      email: "",
    },
  });

  const onSubmit = (values: ForgotPasswordFormData) => {
    startTransition(async () => {
      const result = await forgotPasswordAction(
        values,
        captchaToken ?? undefined
      );
      setCaptchaToken(null);
      setCaptchaResetKey((key) => key + 1);

      if (result.response === "error") {
        toast.error(result.message);
        return;
      }

      const targetEmail = result.data?.email ?? values.email;
      router.push(
        `/auth/reset-password?email=${encodeURIComponent(targetEmail)}&sent=1`
      );
    });
  };

  return (
    <AuthCard
      title="Forgot password?"
      description="Enter your email and we'll send you a reset code"
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

          <TurnstileWidget
            action="forgot-password"
            onToken={setCaptchaToken}
            resetKey={captchaResetKey}
          />

          <Button
            type="submit"
            className="w-full"
            disabled={isPending || (isTurnstileEnabled && !captchaToken)}
          >
            {isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Sending code...
              </>
            ) : (
              "Send reset code"
            )}
          </Button>
        </form>
      </Form>
    </AuthCard>
  );
}
