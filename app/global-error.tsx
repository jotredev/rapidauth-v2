'use client';

import { useEffect } from 'react';
import * as Sentry from '@sentry/nextjs';
import { initializeSentryClient } from '@/lib/sentry-client';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import './globals.css';

export default function GlobalError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    void initializeSentryClient().then((enabled) => {
      if (enabled) Sentry.captureException(error);
    });
  }, [error]);

  return (
    <html lang="en" className="dark">
      <body className="min-h-dvh bg-background text-foreground antialiased">
        <title>Something went wrong | RapidAuth</title>
        <main className="flex min-h-dvh items-center justify-center px-4 py-12">
          <Card className="w-full max-w-md">
            <CardHeader>
              <p className="font-mono text-xs uppercase tracking-[0.2em] text-muted-foreground">
                RapidAuth · Error
              </p>
              <CardTitle>
                <h1 className="text-2xl">Something went wrong</h1>
              </CardTitle>
              <CardDescription className="text-base leading-relaxed">
                The application hit an unexpected problem. Try the request again;
                your account data has not been changed by this screen.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground" role="status">
                If the problem continues, contact the application administrator.
              </p>
            </CardContent>
            <CardFooter>
              <Button className="min-h-11 w-full" size="lg" onClick={retry}>
                Try again
              </Button>
            </CardFooter>
          </Card>
        </main>
      </body>
    </html>
  );
}
