"use client";

import { useTransition } from "react";
import { useRouter } from "nextjs-toploader/app";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { acceptTermsAction, signOut } from "@/actions/auth";
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
import { Spinner } from "@/components/ui/spinner";
import {
  acceptTermsSchema,
  type AcceptTermsFormData,
} from "@/validations/auth";

export function AcceptTermsForm() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const form = useForm<AcceptTermsFormData>({
    resolver: zodResolver(acceptTermsSchema),
    defaultValues: { acceptTerms: false },
  });
  const accepted = form.watch("acceptTerms");

  const onSubmit = (values: AcceptTermsFormData) => {
    startTransition(async () => {
      const result = await acceptTermsAction(values);

      if (result.response === "error") {
        toast.error(result.message);
        return;
      }

      router.push("/dashboard");
      router.refresh();
    });
  };

  return (
    <AuthCard
      title="Accept the terms"
      description="Review and accept the current terms before continuing to your account."
    >
      <Form {...form}>
        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="flex flex-col gap-6"
        >
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
                  <FormDescription>
                    You must accept the current version to use the dashboard.
                  </FormDescription>
                  <FormMessage />
                </div>
              </FormItem>
            )}
          />

          <div className="flex flex-col gap-3">
            <Button type="submit" disabled={isPending || !accepted}>
              {isPending ? (
                <>
                  <Spinner data-icon="inline-start" />
                  Saving...
                </>
              ) : (
                "Accept and continue"
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
