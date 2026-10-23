"use client";

import { useState, useTransition } from "react";
import { useRouter } from "nextjs-toploader/app";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

import { registerSchema, type RegisterFormData } from "@/validations/auth";
import { createFirstAdminAction } from "@/actions/auth";
import {
  FIRST_RUN_ADMIN_EXISTS_MESSAGE,
  FIRST_RUN_CLOSED_MESSAGE,
} from "@/lib/first-run-admin-messages";

import { AuthCard, AuthLink } from "./auth-card";
import { RegisterFields } from "./register-fields";
import { TurnstileWidget } from "./turnstile-widget";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Form } from "@/components/ui/form";

export function FirstRunAdminForm({
  turnstileSiteKey,
}: {
  turnstileSiteKey?: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [captchaResetKey, setCaptchaResetKey] = useState(0);

  const form = useForm<RegisterFormData>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      name: "",
      email: "",
      password: "",
      confirmPassword: "",
      acceptTerms: false,
    },
  });

  const onSubmit = (values: RegisterFormData) => {
    startTransition(async () => {
      const result = await createFirstAdminAction(
        values,
        captchaToken ?? undefined
      );
      setCaptchaToken(null);
      setCaptchaResetKey((key) => key + 1);

      if (result.response === "error") {
        toast.error(result.message);
        // The window closed or someone else created the admin: re-render the page for its new state.
        if (
          result.message === FIRST_RUN_CLOSED_MESSAGE ||
          result.message === FIRST_RUN_ADMIN_EXISTS_MESSAGE
        ) {
          router.refresh();
        }
        return;
      }

      router.push("/auth/login?notice=admin-created");
    });
  };

  return (
    <AuthCard
      title="Create your admin account"
      description="This is the first run. The account you create here will manage the app."
    >
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <RegisterFields form={form} disabled={isPending} />

          <Button
            type="submit"
            className="w-full"
            disabled={isPending || (Boolean(turnstileSiteKey) && !captchaToken)}
          >
            {isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Creating account...
              </>
            ) : (
              "Create admin account"
            )}
          </Button>

          <TurnstileWidget
            siteKey={turnstileSiteKey}
            action="signup"
            onToken={setCaptchaToken}
            resetKey={captchaResetKey}
          />
        </form>
      </Form>
    </AuthCard>
  );
}

export function FirstRunClosed() {
  return (
    <AuthCard
      title="Setup window closed"
      description="The admin account was not created in time."
      footer={
        <AuthLink href="/auth/login">Go to sign in</AuthLink>
      }
    >
      <Alert>
        <AlertDescription>
          For security, this screen closes 15 minutes after the app starts.
          Restart the app to open it again, then reload this page.
        </AlertDescription>
      </Alert>
    </AuthCard>
  );
}
