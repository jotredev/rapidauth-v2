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
import { Input } from '@/components/ui/input';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Loader2 } from 'lucide-react';
import { editUserAction } from '@/actions/users';
import { editUserSchema, type EditUserFormData } from '@/validations/users';
import type { User } from '@/actions/users';

interface EditUserDialogProps {
  user: User | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
  currentUserId: string;
}

export function EditUserDialog({
  user,
  open,
  onOpenChange,
  onSuccess,
  currentUserId,
}: EditUserDialogProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const isOtherAdmin = user?.role === 'admin' && user.id !== currentUserId;

  const form = useForm<EditUserFormData>({
    resolver: zodResolver(editUserSchema),
    defaultValues: {
      name: '',
      email: '',
    },
  });

  // Reset form when user changes or dialog opens
  useEffect(() => {
    if (user && open) {
      form.reset({
        name: user.name,
        email: user.email,
      });
    }
  }, [user, open, form]);

  const onSubmit = (values: EditUserFormData) => {
    if (!user) return;

    startTransition(async () => {
      const result = await editUserAction(user.id, values);

      if (result.response === 'error') {
        toast.error(result.message);
        return;
      }

      toast.success(result.message);
      onOpenChange(false);
      onSuccess?.();
      router.refresh();
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='sm:max-w-[425px] bg-card border-border'>
        <DialogHeader>
          <DialogTitle className='font-medium'>Edit User</DialogTitle>
          <DialogDescription className='text-muted-foreground'>
            Update user information. This will not affect their login credentials.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className='space-y-4 py-4'>
            <FormField
              control={form.control}
              name='name'
              render={({ field }) => (
                <FormItem>
                  <FormLabel className='text-sm font-normal'>
                    Full Name
                  </FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      className='bg-background border-border'
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name='email'
              render={({ field }) => (
                <FormItem>
                  <FormLabel className='text-sm font-normal'>
                    Email Address
                  </FormLabel>
                  {user?.provider !== 'email' && (
                    <p className='text-xs text-muted-foreground'>Managed by {user?.provider}. Cannot be changed.</p>
                  )}
                  {user?.provider === 'email' && isOtherAdmin && (
                    <p className='text-xs text-muted-foreground'>Admins can&apos;t change another admin&apos;s email.</p>
                  )}
                  <FormControl>
                    <Input
                      {...field}
                      type='email'
                      className='bg-background border-border'
                      disabled={user?.provider !== 'email' || isOtherAdmin}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter className='pt-4 flex flex-row gap-3 sm:justify-end'>
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
                    Saving...
                  </>
                ) : (
                  'Save Changes'
                )}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
