"use client";

import { useTransition } from "react";
import { useRouter } from "nextjs-toploader/app";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { acceptInviteAction } from "@/actions/auth";
import { AuthCard, AuthLink } from "@/components/auth/auth-card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import {
  acceptInviteSchema,
  type AcceptInviteFormData,
} from "@/validations/auth";

export function AcceptInviteForm({ token }: { token: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const form = useForm<AcceptInviteFormData>({
    resolver: zodResolver(acceptInviteSchema),
    defaultValues: {
      password: "",
      confirmPassword: "",
      acceptTerms: false,
    },
  });
  const acceptedTerms = form.watch("acceptTerms");

  const onSubmit = (values: AcceptInviteFormData) => {
    startTransition(async () => {
      const result = await acceptInviteAction({ ...values, token });
      if (result.response === "error") {
        toast.error(result.message);
        return;
      }

      router.replace("/auth/login?notice=invitation-accepted");
      router.refresh();
    });
  };

  return (
    <AuthCard
      title="Accept your invitation"
      description="Set your password and accept the current terms to activate your account."
    >
      <Form {...form}>
        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="flex flex-col gap-4"
        >
          <FormField
            control={form.control}
            name="password"
            render={({ field, fieldState }) => (
              <FormItem data-invalid={fieldState.invalid || undefined}>
                <FormLabel>Password</FormLabel>
                <FormControl>
                  <Input
                    type="password"
                    autoComplete="new-password"
                    placeholder="Create a password"
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
                <FormLabel>Confirm password</FormLabel>
                <FormControl>
                  <Input
                    type="password"
                    autoComplete="new-password"
                    placeholder="Confirm your password"
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
            name="acceptTerms"
            render={({ field, fieldState }) => (
              <FormItem
                className="flex flex-row items-start gap-3"
                data-invalid={fieldState.invalid || undefined}
              >
                <FormControl>
                  <Checkbox
                    checked={field.value}
                    onCheckedChange={field.onChange}
                    disabled={isPending}
                    aria-invalid={fieldState.invalid}
                  />
                </FormControl>
                <div className="flex flex-col gap-1 leading-none">
                  <FormLabel className="inline cursor-pointer gap-0 text-sm font-normal">
                    I agree to the{" "}
                    <AuthLink href="/terms" target="_blank" rel="noopener noreferrer">
                      Terms of Service
                    </AuthLink>{" "}
                    and{" "}
                    <AuthLink href="/privacy" target="_blank" rel="noopener noreferrer">
                      Privacy Policy
                    </AuthLink>
                  </FormLabel>
                  <FormMessage />
                </div>
              </FormItem>
            )}
          />

          <Button type="submit" disabled={isPending || !acceptedTerms}>
            {isPending ? (
              <>
                <Spinner data-icon="inline-start" />
                Activating account...
              </>
            ) : (
              "Accept invitation"
            )}
          </Button>
        </form>
      </Form>
    </AuthCard>
  );
}
