export type SentryEnvironment = Record<string, string | undefined>;

export type SentryRuntimeConfig = {
  dsn?: string;
  enabled: boolean;
  environment: string;
  invalidDsn: boolean;
  tracesSampleRate: number;
};

export type SentryBuildConfig = {
  authToken?: string;
  enabled: boolean;
  org?: string;
  project?: string;
};

type SentryEnvKey =
  | 'NEXT_PUBLIC_SENTRY_DSN'
  | 'SENTRY_ORG'
  | 'SENTRY_PROJECT'
  | 'SENTRY_AUTH_TOKEN'
  | 'SENTRY_TRACES_SAMPLE_RATE';

function trimmed(value: string | undefined): string | undefined {
  const normalized = value?.trim();
  return normalized || undefined;
}

export function isValidSentryDsn(value: string | undefined): boolean {
  const dsn = trimmed(value);
  if (!dsn) return false;

  try {
    const url = new URL(dsn);
    const projectId = url.pathname.split('/').filter(Boolean).at(-1);
    return (
      ['http:', 'https:'].includes(url.protocol) &&
      Boolean(url.username) &&
      !url.password &&
      Boolean(url.hostname) &&
      Boolean(projectId) &&
      !url.search &&
      !url.hash
    );
  } catch {
    return false;
  }
}

export function getSentryEnvironment(env: SentryEnvironment): string {
  return trimmed(env.VERCEL_ENV) ??
    trimmed(env.NEXT_PUBLIC_SENTRY_ENVIRONMENT) ??
    (env.NODE_ENV === 'production' ? 'production' : 'development');
}

export function getSentryRuntimeConfig(
  env: SentryEnvironment,
): SentryRuntimeConfig {
  // Read through the env object so Next.js does not freeze the value at build time.
  const dsn = trimmed(env.NEXT_PUBLIC_SENTRY_DSN);
  const enabled = isValidSentryDsn(dsn);
  const parsedSampleRate = Number.parseFloat(
    trimmed(env.SENTRY_TRACES_SAMPLE_RATE) ?? '0',
  );
  const tracesSampleRate = Number.isFinite(parsedSampleRate) &&
    parsedSampleRate >= 0 &&
    parsedSampleRate <= 1
    ? parsedSampleRate
    : 0;

  return {
    dsn: enabled ? dsn : undefined,
    enabled,
    environment: getSentryEnvironment(env),
    invalidDsn: Boolean(dsn) && !enabled,
    tracesSampleRate,
  };
}

export function getSentryBuildConfig(
  env: SentryEnvironment,
): SentryBuildConfig {
  const org = trimmed(env.SENTRY_ORG);
  const project = trimmed(env.SENTRY_PROJECT);
  const authToken = trimmed(env.SENTRY_AUTH_TOKEN);
  const enabled = Boolean(org && project && authToken);

  return {
    authToken: enabled ? authToken : undefined,
    enabled,
    org: enabled ? org : undefined,
    project: enabled ? project : undefined,
  };
}

export function createSentryEnvValues(values: {
  authToken?: string;
  dsn?: string;
  org?: string;
  project?: string;
  tracesSampleRate?: string;
}): Record<SentryEnvKey, string> {
  return {
    NEXT_PUBLIC_SENTRY_DSN: trimmed(values.dsn) ?? '',
    SENTRY_ORG: trimmed(values.org) ?? '',
    SENTRY_PROJECT: trimmed(values.project) ?? '',
    SENTRY_AUTH_TOKEN: trimmed(values.authToken) ?? '',
    SENTRY_TRACES_SAMPLE_RATE: trimmed(values.tracesSampleRate) ?? '',
  };
}
