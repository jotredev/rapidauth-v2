'use client';

import { useEffect, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
} from '@/components/ui/form';
import { Loader2, Mail, KeyRound, Copy, Check } from 'lucide-react';
import { adminResetPasswordAction } from '@/actions/users';
import {
  resetPasswordSchema,
  type ResetPasswordFormData,
} from '@/validations/users';
import type { User } from '@/actions/users';
import * as React from 'react';

interface ResetPasswordDialogProps {
  user: User | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function ResetPasswordDialog({
  user,
  open,
  onOpenChange,
  onSuccess,
}: ResetPasswordDialogProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [temporaryPassword, setTemporaryPassword] = React.useState<
    string | null
  >(null);
  const [copied, setCopied] = React.useState(false);

  const form = useForm<ResetPasswordFormData>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: {
      method: 'email',
    },
  });

  // Reset form when dialog closes
  useEffect(() => {
    if (!open) {
      form.reset({ method: 'email' });
      setTemporaryPassword(null);
      setCopied(false);
    }
  }, [open, form]);

  const onSubmit = (values: ResetPasswordFormData) => {
    if (!user) return;

    startTransition(async () => {
      const result = await adminResetPasswordAction(user.id, values);

      if (result.response === 'error') {
        toast.error(result.message);
        return;
      }

      if (result.data?.temporaryPassword) {
        setTemporaryPassword(result.data.temporaryPassword);
        toast.success(result.message);
      } else {
        toast.success(result.message);
        onOpenChange(false);
        onSuccess?.();
        router.refresh();
      }
    });
  };

  const handleCopyPassword = async () => {
    if (!temporaryPassword) return;
    await navigator.clipboard.writeText(temporaryPassword);
    setCopied(true);
    toast.success('Password copied to clipboard');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleClose = () => {
    onOpenChange(false);
    onSuccess?.();
    router.refresh();
  };

  const selectedMethod = form.watch('method');

  // Show temporary password result
  if (temporaryPassword) {
    return (
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className='sm:max-w-[425px] bg-card border-border'>
          <DialogHeader>
            <DialogTitle className='font-medium'>
              Temporary Password Generated
            </DialogTitle>
            <DialogDescription className='text-muted-foreground'>
              Share this password with {user?.name}. They must change it on
              first login, and it expires in 72 hours.
            </DialogDescription>
          </DialogHeader>

          <div className='py-4 space-y-4'>
            <div className='rounded-md border border-border bg-background p-4'>
              <div className='flex items-center justify-between gap-2'>
                <code className='text-lg font-mono tracking-wider'>
                  {temporaryPassword}
                </code>
                <Button
                  type='button'
                  variant='ghost'
                  size='icon'
                  onClick={handleCopyPassword}
                  className='shrink-0'
                >
                  {copied ? (
                    <Check className='h-4 w-4 text-green-500' />
                  ) : (
                    <Copy className='h-4 w-4' />
                  )}
                </Button>
              </div>
            </div>
            <p className='text-xs text-muted-foreground'>
              This password will not be shown again. Make sure to copy it now.
            </p>
          </div>

          <DialogFooter>
            <Button onClick={handleClose} className='w-full'>
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='sm:max-w-[425px] bg-card border-border'>
        <DialogHeader>
          <DialogTitle className='font-medium'>Reset Password</DialogTitle>
          <DialogDescription className='text-muted-foreground'>
            Choose how to reset the password for {user?.name}.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className='space-y-4 py-4'>
            <FormField
              control={form.control}
              name='method'
              render={({ field }) => (
                <FormItem>
                  <FormLabel className='text-sm font-normal'>
                    Reset Method
                  </FormLabel>
                  <FormControl>
                    <div className='space-y-3'>
                      <button
                        type='button'
                        onClick={() => field.onChange('email')}
                        className={`w-full p-4 rounded-md border text-left transition-colors ${
                          field.value === 'email'
                            ? 'border-primary bg-primary/5'
                            : 'border-border bg-background hover:bg-muted/50'
                        }`}
                      >
                        <div className='flex items-center gap-3'>
                          <div
                            className={`w-10 h-10 rounded-full flex items-center justify-center ${
                              field.value === 'email'
                                ? 'bg-primary/10 text-primary'
                                : 'bg-muted text-muted-foreground'
                            }`}
                          >
                            <Mail className='h-5 w-5' />
                          </div>
                          <div>
                            <p className='text-sm font-medium'>
                              Send Reset Email
                            </p>
                            <p className='text-xs text-muted-foreground'>
                              User will receive a link to reset their password
                            </p>
                          </div>
                        </div>
                      </button>

                      {user?.role !== 'admin' && (
                        <button
                          type='button'
                          onClick={() => field.onChange('manual')}
                          className={`w-full p-4 rounded-md border text-left transition-colors ${
                            field.value === 'manual'
                              ? 'border-primary bg-primary/5'
                              : 'border-border bg-background hover:bg-muted/50'
                          }`}
                        >
                          <div className='flex items-center gap-3'>
                            <div
                              className={`w-10 h-10 rounded-full flex items-center justify-center ${
                                field.value === 'manual'
                                  ? 'bg-primary/10 text-primary'
                                  : 'bg-muted text-muted-foreground'
                              }`}
                            >
                              <KeyRound className='h-5 w-5' />
                            </div>
                            <div>
                              <p className='text-sm font-medium'>
                                Generate Temporary Password
                              </p>
                              <p className='text-xs text-muted-foreground'>
                                Create a password that must be changed on login
                                and expires in 72 hours
                              </p>
                            </div>
                          </div>
                        </button>
                      )}

                      {user?.role === 'admin' && (
                        <p className='text-xs text-muted-foreground'>
                          Admin passwords can only be reset by email link.
                        </p>
                      )}
                    </div>
                  </FormControl>
                </FormItem>
              )}
            />

            <DialogFooter className='flex flex-row gap-3 sm:justify-end'>
              <Button
                type='button'
                variant='outline'
                onClick={() => onOpenChange(false)}
                disabled={isPending}
                className='flex-1 sm:flex-none sm:w-28'
              >
                Cancel
              </Button>
              <Button
                type='submit'
                disabled={isPending}
                className='flex-1 sm:flex-none sm:w-28'
              >
                {isPending ? (
                  <>
                    <Loader2 className='mr-2 h-4 w-4 animate-spin' />
                    {selectedMethod === 'email' ? 'Sending...' : 'Generating...'}
                  </>
                ) : selectedMethod === 'email' ? (
                  'Send Email'
                ) : (
                  'Generate'
                )}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
