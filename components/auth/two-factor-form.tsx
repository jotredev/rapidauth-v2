'use client';

import * as React from 'react';
import { useTransition } from 'react';
import { useRouter } from 'nextjs-toploader/app';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { Shield, Loader2, ArrowLeft } from 'lucide-react';

import {
  twoFactorSchema,
  backupCodeSchema,
  type TwoFactorFormData,
  type BackupCodeFormData,
} from '@/validations/auth';
import { verifyTotpAction, verifyBackupCodeAction } from '@/actions/auth';

import { AuthCard, AuthLink } from './auth-card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
  InputOTPSeparator,
} from '@/components/ui/input-otp';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';

export function TwoFactorForm() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const form = useForm<TwoFactorFormData>({
    resolver: zodResolver(twoFactorSchema),
    defaultValues: {
      code: '',
    },
  });

  const onSubmit = (values: TwoFactorFormData) => {
    startTransition(async () => {
      const result = await verifyTotpAction(values);

      if (result.response === 'error') {
        toast.error(result.message);
        form.reset();
        return;
      }

      toast.success(result.message);
      router.push('/dashboard');
    });
  };

  const handleComplete = (value: string) => {
    form.setValue('code', value);
    if (value.length === 6) {
      form.handleSubmit(onSubmit)();
    }
  };

  return (
    <AuthCard
      title="Two-factor authentication"
      description="Enter the 6-digit code from your authenticator app"
      footer={
        <>
          <AuthLink href="/auth/login">
            <span className="inline-flex items-center gap-1">
              <ArrowLeft className="h-3 w-3" />
              Back to sign in
            </span>
          </AuthLink>
        </>
      }
    >
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <div className="flex flex-col items-center space-y-4">
            <div className="w-12 h-12 bg-primary/10 border border-primary/20 flex items-center justify-center">
              <Shield className="h-6 w-6 text-primary" strokeWidth={1.5} />
            </div>

            <FormField
              control={form.control}
              name="code"
              render={({ field }) => (
                <FormItem className="w-full">
                  <FormLabel className="sr-only">Verification code</FormLabel>
                  <FormControl>
                    <div className="flex justify-center">
                      <InputOTP
                        maxLength={6}
                        value={field.value}
                        onChange={field.onChange}
                        onComplete={handleComplete}
                        disabled={isPending}
                      >
                        <InputOTPGroup>
                          <InputOTPSlot index={0} />
                          <InputOTPSlot index={1} />
                          <InputOTPSlot index={2} />
                        </InputOTPGroup>
                        <InputOTPSeparator />
                        <InputOTPGroup>
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
          </div>

          <Button type="submit" className="w-full" disabled={isPending}>
            {isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Verifying...
              </>
            ) : (
              'Verify'
            )}
          </Button>

          <div className="text-center">
            <AuthLink href="/auth/two-factor/backup">
              Use a backup code instead
            </AuthLink>
          </div>
        </form>
      </Form>
    </AuthCard>
  );
}

export function TwoFactorBackupForm() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const form = useForm<BackupCodeFormData>({
    resolver: zodResolver(backupCodeSchema),
    defaultValues: {
      code: '',
    },
  });

  const onSubmit = (values: BackupCodeFormData) => {
    startTransition(async () => {
      const result = await verifyBackupCodeAction(values.code);

      if (result.response === 'error') {
        toast.error(result.message);
        return;
      }

      toast.success(result.message);
      router.push('/dashboard');
    });
  };

  return (
    <AuthCard
      title="Use backup code"
      description="Enter one of your backup codes to sign in"
      footer={
        <>
          <AuthLink href="/auth/two-factor">
            <span className="inline-flex items-center gap-1">
              <ArrowLeft className="h-3 w-3" />
              Use authenticator app
            </span>
          </AuthLink>
        </>
      }
    >
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <FormField
            control={form.control}
            name="code"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Backup Code</FormLabel>
                <FormControl>
                  <Input
                    type="text"
                    placeholder="XXXX-XXXX-XXXX"
                    className="text-center font-mono tracking-wider uppercase"
                    disabled={isPending}
                    {...field}
                  />
                </FormControl>
                <FormMessage />
                <p className="text-xs text-muted-foreground text-center">
                  Backup codes are single-use and cannot be reused.
                </p>
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
              'Verify backup code'
            )}
          </Button>
        </form>
      </Form>
    </AuthCard>
  );
}
