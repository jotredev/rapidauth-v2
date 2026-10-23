'use client';

import * as Sentry from '@sentry/nextjs';
import { getSentryRuntimeConfig } from '@/lib/sentry-config';
import { initializeSentry } from '@/lib/sentry-init';

let initialization: Promise<boolean> | undefined;

export function initializeSentryClient(): Promise<boolean> {
  initialization ??= fetch('/api/sentry-config', { cache: 'no-store' })
    .then(async (response) => {
      if (!response.ok) return false;

      const { dsn } = (await response.json()) as { dsn: string | null };
      const config = getSentryRuntimeConfig({
        NEXT_PUBLIC_SENTRY_DSN: dsn ?? undefined,
        NEXT_PUBLIC_SENTRY_ENVIRONMENT:
          process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT,
        NODE_ENV: process.env.NODE_ENV,
        SENTRY_TRACES_SAMPLE_RATE: process.env.SENTRY_TRACES_SAMPLE_RATE,
      });

      return initializeSentry(config, Sentry.init);
    })
    .catch(() => false);

  return initialization;
}
