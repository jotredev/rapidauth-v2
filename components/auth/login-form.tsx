'use client';

import * as React from 'react';
import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { Mail, Lock, Loader2, Eye, EyeOff } from 'lucide-react';

import { loginSchema, type LoginFormData } from '@/validations/auth';
import {
  signInAction,
  signInWithGoogle,
  signInWithGithub,
} from '@/actions/auth';

import { AuthCard, AuthLink } from './auth-card';
import { SupportLink } from './support-link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';

const googleEnabled = process.env.NEXT_PUBLIC_GOOGLE_ENABLED === 'true';
const githubEnabled = process.env.NEXT_PUBLIC_GITHUB_ENABLED === 'true';
const hasOAuth = googleEnabled || githubEnabled;

export function LoginForm({
  oauthSignupDisabledProvider,
  notice,
}: {
  oauthSignupDisabledProvider?: 'Google' | 'GitHub';
  notice?: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [showPassword, setShowPassword] = React.useState(false);
  const [isSocialPending, setIsSocialPending] = React.useState(false);

  const form = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  });

  const onSubmit = (values: LoginFormData) => {
    startTransition(async () => {
      const result = await signInAction(values);

      if (result.response === 'error') {
        toast.error(result.message);
        if (result.data?.emailNotVerified) {
          router.push(`/auth/verify-email?email=${encodeURIComponent(values.email)}`);
        }
        return;
      }

      if (result.data?.twoFactorRequired) {
        router.push('/auth/two-factor');
        return;
      }

      router.push('/dashboard');
    });
  };

  const handleGoogleSignIn = async () => {
    setIsSocialPending(true);
    const result = await signInWithGoogle();
    if (result.response === 'error') toast.error(result.message);
    setIsSocialPending(false);
  };

  const handleGithubSignIn = async () => {
    setIsSocialPending(true);
    const result = await signInWithGithub();
    if (result.response === 'error') toast.error(result.message);
    setIsSocialPending(false);
  };

  return (
    <AuthCard
      title="Welcome back"
      description="Enter your credentials to access your account"
      footer={
        <div className="space-y-2">
          <div>
            Don&apos;t have an account?{' '}
            <AuthLink href="/auth/register">Sign up</AuthLink>
          </div>
          <SupportLink />
        </div>
      }
    >
      {notice && (
        <Alert className="mb-4">
          <AlertDescription>{notice}</AlertDescription>
        </Alert>
      )}
      {oauthSignupDisabledProvider && (
        <Alert className="mb-4">
          <AlertDescription>
            No account found for this {oauthSignupDisabledProvider} account.{' '}
            <AuthLink href="/auth/register">Create one first</AuthLink>.
          </AlertDescription>
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
            name="password"
            render={({ field }) => (
              <FormItem>
                <div className="flex items-center justify-between">
                  <FormLabel>Password</FormLabel>
                  <AuthLink href="/auth/forgot-password">
                    Forgot password?
                  </AuthLink>
                </div>
                <FormControl>
                  <div className="relative">
                    <Lock
                      className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground"
                      strokeWidth={1.5}
                    />
                    <Input
                      type={showPassword ? 'text' : 'password'}
                      placeholder="Enter your password"
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
                <FormMessage />
              </FormItem>
            )}
          />

          <Button type="submit" className="w-full" disabled={isPending}>
            {isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Signing in...
              </>
            ) : (
              'Sign in'
            )}
          </Button>

          {hasOAuth && (
            <>
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <Separator className="w-full" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-card px-2 text-muted-foreground">
                    Or continue with
                  </span>
                </div>
              </div>

              <div className={`grid gap-3 ${googleEnabled && githubEnabled ? 'grid-cols-2' : 'grid-cols-1'}`}>
                {googleEnabled && (
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full"
                    disabled={isPending || isSocialPending}
                    onClick={handleGoogleSignIn}
                  >
                    <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24">
                      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                    </svg>
                    Google
                  </Button>
                )}
                {githubEnabled && (
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full"
                    disabled={isPending || isSocialPending}
                    onClick={handleGithubSignIn}
                  >
                    <svg className="mr-2 h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
                    </svg>
                    GitHub
                  </Button>
                )}
              </div>
            </>
          )}
        </form>
      </Form>
    </AuthCard>
  );
}
