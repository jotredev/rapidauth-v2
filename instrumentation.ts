import * as Sentry from '@sentry/nextjs';
import type { Instrumentation } from 'next';
import { getSentryRuntimeConfig } from '@/lib/sentry-config';
import { initializeSentry } from '@/lib/sentry-init';

let warnedAboutInvalidDsn = false;

export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const [
      { printEnvironmentSummary, validateEnvironment },
      { warnAboutTrustedProxyConfiguration },
    ] = await Promise.all([
      import('./instrumentation-node'),
      import('./lib/client-ip'),
    ]);
    validateEnvironment();
    printEnvironmentSummary();
    warnAboutTrustedProxyConfiguration();
  }

  const config = getSentryRuntimeConfig(process.env);

  if (!config.enabled) {
    if (
      config.invalidDsn &&
      process.env.NEXT_RUNTIME !== 'edge' &&
      !warnedAboutInvalidDsn
    ) {
      warnedAboutInvalidDsn = true;
      console.warn(
        'Sentry is disabled because SENTRY_DSN is not a valid DSN.',
      );
    }
    return;
  }

  initializeSentry(config, Sentry.init);
}

export const onRequestError: Instrumentation.onRequestError = (
  error,
  request,
  context,
) => {
  if (!getSentryRuntimeConfig(process.env).enabled) return;
  Sentry.captureRequestError(error, request, context);
};
