import { getEnv } from '@/lib/env';
import { getClientIp } from '@/lib/rate-limit';
import {
  isTurnstileTestSecretKey,
  isTurnstileTestSiteKey,
} from '@/lib/turnstile-config';

const { secretKey, siteKey } = getEnv().config.turnstile;
const isEnabled = Boolean(secretKey && siteKey);

const isTestKey = Boolean(
  isTurnstileTestSiteKey(siteKey) || isTurnstileTestSecretKey(secretKey)
);

if (Boolean(secretKey) !== Boolean(siteKey)) {
  throw new Error(
    'TURNSTILE_SECRET_KEY and TURNSTILE_SITE_KEY must both be set to enable Turnstile.'
  );
}

if (isEnabled && isTestKey && process.env.NODE_ENV === 'production') {
  console.warn(
    'Using Cloudflare Turnstile test keys in production; set real keys from the Cloudflare dashboard.'
  );
}

type SiteverifyResponse = {
  success?: unknown;
  action?: unknown;
};

export async function verifyTurnstile(
  token: string | undefined,
  expectedAction: string
): Promise<boolean> {
  if (!isEnabled) return true;
  if (typeof token !== 'string' || !token || token.length > 2048 || !secretKey) {
    return false;
  }

  try {
    const remoteIp = await getClientIp();
    const response = await fetch(
      'https://challenges.cloudflare.com/turnstile/v0/siteverify',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          secret: secretKey,
          response: token,
          ...(remoteIp ? { remoteip: remoteIp } : {}),
        }),
        signal: AbortSignal.timeout(10_000),
      }
    );

    if (!response.ok) return false;

    const result = (await response.json()) as SiteverifyResponse;
    const actionMatches = isTestKey || result.action === expectedAction;

    return result.success === true && actionMatches;
  } catch {
    return false;
  }
}
