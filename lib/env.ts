import { getSentryRuntimeConfig } from '@/lib/sentry-config';
import {
  getS3StorageConfigError,
  getStorageDriver,
  type StorageDriver,
} from '@/lib/storage/config';

export type EnvSource = Record<string, string | undefined>;

export type EmailProvider = 'resend' | 'mailpit' | 'outbox';

export type ResolvedEnv = {
  database: { docker: boolean };
  email: { provider: EmailProvider };
  storage: { driver: StorageDriver };
  turnstile: { enabled: boolean };
  google: { enabled: boolean };
  github: { enabled: boolean };
  sentry: { enabled: boolean };
};

export type EnvResolution = {
  config: ResolvedEnv;
  /** One line per problem, each listing every variable that is missing. */
  problems: string[];
  /** Single message with all problems, or null when the environment is complete. */
  error: string | null;
};

const PAIRS = [
  { name: 'Google', keys: ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET'] },
  { name: 'GitHub', keys: ['GITHUB_CLIENT_ID', 'GITHUB_CLIENT_SECRET'] },
  {
    name: 'Turnstile',
    keys: ['NEXT_PUBLIC_TURNSTILE_SITE_KEY', 'TURNSTILE_SECRET_KEY'],
  },
] as const;

// Pairs follow the same rule as lib/social-providers.ts and lib/turnstile.ts:
// any non-empty value counts as set, even one made only of spaces.
function isSet(env: EnvSource, key: string): boolean {
  return Boolean(env[key]);
}

/**
 * A pair is enabled when both variables exist, disabled when neither does,
 * and incomplete (an error) when only one of them is set.
 */
function resolvePair(env: EnvSource, keys: readonly [string, string]) {
  const missing = keys.filter((key) => !isSet(env, key));
  return {
    enabled: missing.length === 0,
    missing: missing.length === keys.length ? [] : missing,
  };
}

function resolveEmailProvider(env: EnvSource): EmailProvider {
  if (env.EMAIL_DELIVERY?.trim().toLowerCase() === 'outbox') return 'outbox';
  return env.RESEND_API_KEY?.trim() ? 'resend' : 'mailpit';
}

export function resolveEnv(env: EnvSource = process.env): EnvResolution {
  const problems: string[] = [];
  const enabled: Record<string, boolean> = {};

  for (const { name, keys } of PAIRS) {
    const pair = resolvePair(env, keys);
    enabled[name] = pair.enabled;
    if (pair.missing.length) {
      problems.push(`${name}: missing ${pair.missing.join(', ')}.`);
    }
  }

  let driver: StorageDriver = 'local';
  try {
    driver = getStorageDriver(env as NodeJS.ProcessEnv);
  } catch (error) {
    problems.push(error instanceof Error ? error.message : String(error));
  }
  const s3Error = getS3StorageConfigError(env as NodeJS.ProcessEnv);
  if (s3Error) problems.push(s3Error);

  const config: ResolvedEnv = {
    database: { docker: env.DOCKER_DATABASE === 'true' },
    email: { provider: resolveEmailProvider(env) },
    storage: { driver },
    turnstile: { enabled: enabled.Turnstile },
    google: { enabled: enabled.Google },
    github: { enabled: enabled.GitHub },
    sentry: { enabled: getSentryRuntimeConfig(env).enabled },
  };

  return {
    config,
    problems,
    error: problems.length
      ? `Incomplete environment configuration:\n${problems.map((line) => `- ${line}`).join('\n')}`
      : null,
  };
}

const EMAIL_LABELS: Record<EmailProvider, string> = {
  resend: 'Resend',
  mailpit: 'Mailpit',
  outbox: 'local outbox (testing)',
};

/** Short startup summary. Built only from resolved values: never keys, URLs or DSNs. */
export function formatEnvSummary(config: ResolvedEnv): string {
  const state = (enabled: boolean) => (enabled ? 'on' : 'off');
  return [
    'Environment:',
    `  Database:  ${config.database.docker ? 'Docker PostgreSQL' : 'external PostgreSQL'}`,
    `  Emails:    ${EMAIL_LABELS[config.email.provider]}`,
    `  Files:     ${config.storage.driver === 's3' ? 'S3' : 'local disk'}`,
    `  Turnstile: ${state(config.turnstile.enabled)}`,
    `  Google:    ${state(config.google.enabled)}`,
    `  GitHub:    ${state(config.github.enabled)}`,
    `  Sentry:    ${state(config.sentry.enabled)}`,
  ].join('\n');
}

let cached: EnvResolution | undefined;

/** Resolves `process.env` once and reuses the result for the rest of the process. */
export function getEnv(): EnvResolution {
  cached ??= resolveEnv(process.env);
  return cached;
}
