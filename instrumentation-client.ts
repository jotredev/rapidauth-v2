import * as Sentry from '@sentry/nextjs';
import { initializeSentryClient } from '@/lib/sentry-client';

void initializeSentryClient();

export function onRouterTransitionStart(
  ...args: Parameters<typeof Sentry.captureRouterTransitionStart>
): void {
  void initializeSentryClient().then((enabled) => {
    if (enabled) Sentry.captureRouterTransitionStart(...args);
  });
}
