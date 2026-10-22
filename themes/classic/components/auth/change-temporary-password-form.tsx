"use client";

import { useTransition } from "react";
import { useRouter } from "nextjs-toploader/app";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { changePasswordAction, signOut } from "@/actions/auth";
import { AuthCard } from "@/components/auth/auth-card";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { TEMPORARY_PASSWORD_EXPIRED_MESSAGE } from "@/lib/temporary-password";
import {
  changePasswordSchema,
  type ChangePasswordFormData,
} from "@/validations/auth";

export function ChangeTemporaryPasswordForm() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const form = useForm<ChangePasswordFormData>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: {
      currentPassword: "",
      newPassword: "",
      confirmPassword: "",
    },
  });

  const onSubmit = (values: ChangePasswordFormData) => {
    startTransition(async () => {
      const result = await changePasswordAction(values);

      if (result.response === "error") {
        if (result.message === TEMPORARY_PASSWORD_EXPIRED_MESSAGE) {
          router.replace("/auth/login?notice=temporary-password-expired");
          router.refresh();
          return;
        }

        toast.error(result.message);
        return;
      }

      toast.success(result.message);
      router.replace("/dashboard");
      router.refresh();
    });
  };

  return (
    <AuthCard
      title="Change your temporary password"
      description="Choose a permanent password before continuing to your account."
    >
      <Form {...form}>
        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="flex flex-col gap-4"
        >
          <FormField
            control={form.control}
            name="currentPassword"
            render={({ field, fieldState }) => (
              <FormItem data-invalid={fieldState.invalid || undefined}>
                <FormLabel>Temporary password</FormLabel>
                <FormControl>
                  <Input
                    type="password"
                    autoComplete="current-password"
                    placeholder="Enter temporary password"
                    disabled={isPending}
                    aria-invalid={fieldState.invalid}
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="newPassword"
            render={({ field, fieldState }) => (
              <FormItem data-invalid={fieldState.invalid || undefined}>
                <FormLabel>New password</FormLabel>
                <FormControl>
                  <Input
                    type="password"
                    autoComplete="new-password"
                    placeholder="Enter new password"
                    disabled={isPending}
                    aria-invalid={fieldState.invalid}
                    {...field}
                  />
                </FormControl>
                <FormDescription>
                  Must be at least 8 characters with uppercase and number.
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="confirmPassword"
            render={({ field, fieldState }) => (
              <FormItem data-invalid={fieldState.invalid || undefined}>
                <FormLabel>Confirm new password</FormLabel>
                <FormControl>
                  <Input
                    type="password"
                    autoComplete="new-password"
                    placeholder="Confirm new password"
                    disabled={isPending}
                    aria-invalid={fieldState.invalid}
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="flex flex-col gap-3 pt-2">
            <Button type="submit" disabled={isPending}>
              {isPending ? (
                <>
                  <Spinner data-icon="inline-start" />
                  Changing password...
                </>
              ) : (
                "Change password"
              )}
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={isPending}
              onClick={() => startTransition(async () => signOut())}
            >
              Sign out
            </Button>
          </div>
        </form>
      </Form>
    </AuthCard>
  );
}
