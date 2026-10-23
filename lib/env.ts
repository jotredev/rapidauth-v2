import { getSentryRuntimeConfig } from '@/lib/sentry-config';
export type StorageDriver = 'local' | 's3';

export interface S3StorageConfig {
  endpoint?: string;
  region: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
  publicUrl: string;
  forcePathStyle: boolean;
}

export type EnvSource = Record<string, string | undefined>;

export type EmailProvider = 'resend' | 'mailpit';

export type ResolvedEnv = {
  database: { docker: boolean };
  email: {
    provider: EmailProvider;
    resendApiKey?: string;
    /** Internal (set by docker/app.dev.yaml, not documented): where Mailpit listens, as host:port. */
    mailpitSmtpAddress: string;
    /** True when emails go to Mailpit but BETTER_AUTH_URL points to a non-local host. */
    mailpitOnRemoteHost: boolean;
    from: string;
  };
  storage: {
    driver: StorageDriver;
    /** Set when STORAGE_DRIVER is not "local" or "s3". */
    driverError: string | null;
    /** S3 settings when they are complete and valid, whatever the driver. */
    s3: S3StorageConfig | null;
    /** Why `s3` is null (or invalid), whatever the driver. */
    s3Problem: string | null;
  };
  turnstile: { enabled: boolean; siteKey?: string; secretKey?: string };
  google: { enabled: boolean; clientId?: string; clientSecret?: string };
  github: { enabled: boolean; clientId?: string; clientSecret?: string };
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
  return env.RESEND_API_KEY?.trim() ? 'resend' : 'mailpit';
}

const LOCAL_HOSTS = ['localhost', '127.0.0.1'];
const EXAMPLE_BETTER_AUTH_SECRET = 'replace-with-a-unique-random-64-character-hex-secret';

/**
 * True when DATABASE_URL is the PostgreSQL defined in docker/db.yaml: a local
 * host, the same user, password and database, and the port Docker publishes
 * (DB_PORT, default 5432). Any other URL, such as Neon, is an external database.
 */
export function isDockerDatabaseUrl(databaseUrl: string | undefined, dbPort?: string): boolean {
  if (!databaseUrl?.trim()) return false;
  try {
    const url = new URL(databaseUrl);
    return (
      ['postgresql:', 'postgres:'].includes(url.protocol) &&
      [...LOCAL_HOSTS, '[::1]'].includes(url.hostname) &&
      (url.port || '5432') === (dbPort?.trim() || '5432') &&
      decodeURIComponent(url.username) === 'rapidauth' &&
      decodeURIComponent(url.password) === 'rapidauth' &&
      url.pathname === '/rapidauth'
    );
  } catch {
    return false;
  }
}

/** An unset or unparsable BETTER_AUTH_URL is not treated as remote. */
function isRemoteUrl(value: string | undefined): boolean {
  if (!value?.trim()) return false;
  try {
    return !LOCAL_HOSTS.includes(new URL(value).hostname);
  } catch {
    return false;
  }
}

function isLocalUrl(value: string | undefined): boolean {
  if (!value?.trim()) return false;
  try {
    return LOCAL_HOSTS.includes(new URL(value).hostname);
  } catch {
    return false;
  }
}

/**
 * Which Docker services `bun dev` starts, from the effective environment
 * (variables exported in the terminal already merged over `.env`).
 */
export function resolveDevServices(env: EnvSource): { dockerDatabase: boolean; mailpit: boolean } {
  return {
    dockerDatabase: isDockerDatabaseUrl(env.DATABASE_URL, env.DB_PORT),
    mailpit: !env.RESEND_API_KEY?.trim(),
  };
}

const REQUIRED_S3_VARIABLES = [
  'S3_REGION',
  'S3_BUCKET',
  'S3_ACCESS_KEY_ID',
  'S3_SECRET_ACCESS_KEY',
  'S3_PUBLIC_URL',
] as const;

function resolveS3(
  env: EnvSource,
): { config: S3StorageConfig | null; problem: string | null } {
  const missing = REQUIRED_S3_VARIABLES.filter((key) => !env[key]?.trim());
  if (missing.length) {
    return {
      config: null,
      problem: `STORAGE_DRIVER=s3 requires ${missing.join(', ')}. See docs/en/05-file-storage.md.`,
    };
  }
  const pathStyle = env.S3_FORCE_PATH_STYLE?.trim().toLowerCase();
  if (pathStyle && pathStyle !== 'true' && pathStyle !== 'false') {
    return { config: null, problem: 'S3_FORCE_PATH_STYLE must be "true" or "false" when set.' };
  }
  try {
    const publicUrl = new URL(env.S3_PUBLIC_URL!);
    if (!['http:', 'https:'].includes(publicUrl.protocol)) throw new Error();
  } catch {
    return { config: null, problem: 'S3_PUBLIC_URL must be a valid public HTTP or HTTPS URL.' };
  }
  return {
    problem: null,
    config: {
      endpoint: env.S3_ENDPOINT?.trim() || undefined,
      region: env.S3_REGION!.trim(),
      bucket: env.S3_BUCKET!.trim(),
      accessKeyId: env.S3_ACCESS_KEY_ID!.trim(),
      secretAccessKey: env.S3_SECRET_ACCESS_KEY!.trim(),
      publicUrl: env.S3_PUBLIC_URL!.trim().replace(/\/+$/, ''),
      forcePathStyle: pathStyle === 'true',
    },
  };
}

function resolveStorage(env: EnvSource): ResolvedEnv['storage'] {
  const requested = env.STORAGE_DRIVER?.trim().toLowerCase() || 'local';
  const driver = requested === 'local' || requested === 's3' ? requested : undefined;
  const s3 = resolveS3(env);
  return {
    driver: driver ?? 'local',
    driverError: driver ? null : `Invalid STORAGE_DRIVER "${requested}". Use "local" or "s3".`,
    s3: s3.config,
    s3Problem: s3.problem,
  };
}

export function resolveEnv(env: EnvSource = process.env): EnvResolution {
  const problems: string[] = [];
  const enabled: Record<string, boolean> = {};

  if (
    env.BETTER_AUTH_SECRET === EXAMPLE_BETTER_AUTH_SECRET &&
    !isLocalUrl(env.BETTER_AUTH_URL)
  ) {
    problems.push(
      'BETTER_AUTH_SECRET is still the example value while BETTER_AUTH_URL is missing or does not use localhost. Generate a real secret with `openssl rand -hex 32` and set BETTER_AUTH_SECRET.',
    );
  }

  for (const { name, keys } of PAIRS) {
    const pair = resolvePair(env, keys);
    enabled[name] = pair.enabled;
    if (pair.missing.length) {
      problems.push(`${name}: missing ${pair.missing.join(', ')}.`);
    }
  }

  const storage = resolveStorage(env);
  if (storage.driverError) problems.push(storage.driverError);
  if (storage.driver === 's3' && storage.s3Problem) problems.push(storage.s3Problem);

  const provider = resolveEmailProvider(env);
  const config: ResolvedEnv = {
    database: { docker: isDockerDatabaseUrl(env.DATABASE_URL, env.DB_PORT) },
    email: {
      provider,
      resendApiKey: env.RESEND_API_KEY,
      mailpitSmtpAddress: env.MAILPIT_SMTP_ADDRESS?.trim() || 'localhost:1025',
      mailpitOnRemoteHost: provider === 'mailpit' && isRemoteUrl(env.BETTER_AUTH_URL),
      from: env.FROM_EMAIL ?? 'RapidAuth <onboarding@resend.dev>',
    },
    storage,
    turnstile: {
      enabled: enabled.Turnstile,
      // Read through the env object so Next.js does not freeze the value at build time.
      siteKey: env.NEXT_PUBLIC_TURNSTILE_SITE_KEY,
      secretKey: env.TURNSTILE_SECRET_KEY,
    },
    google: {
      enabled: enabled.Google,
      clientId: env.GOOGLE_CLIENT_ID,
      clientSecret: env.GOOGLE_CLIENT_SECRET,
    },
    github: {
      enabled: enabled.GitHub,
      clientId: env.GITHUB_CLIENT_ID,
      clientSecret: env.GITHUB_CLIENT_SECRET,
    },
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
};

/** Short startup summary. Built only from resolved values: never keys, URLs or DSNs. */
export function formatEnvSummary(config: ResolvedEnv): string {
  const state = (enabled: boolean) => (enabled ? 'on' : 'off');
  const lines = [
    'Environment:',
    `  Database:  ${config.database.docker ? 'Docker PostgreSQL' : 'external PostgreSQL'}`,
    `  Emails:    ${EMAIL_LABELS[config.email.provider]}`,
    `  Files:     ${config.storage.driver === 's3' ? 'S3' : 'local disk'}`,
    `  Turnstile: ${state(config.turnstile.enabled)}`,
    `  Google:    ${state(config.google.enabled)}`,
    `  GitHub:    ${state(config.github.enabled)}`,
    `  Sentry:    ${state(config.sentry.enabled)}`,
  ];
  if (config.email.mailpitOnRemoteHost) {
    lines.push(
      '',
      '  WARNING: RESEND_API_KEY is not set, so emails go to Mailpit and will not reach anyone.',
      '  Set RESEND_API_KEY to send real emails.',
    );
  }
  return lines.join('\n');
}

let cached: EnvResolution | undefined;

/** Resolves `process.env` once and reuses the result for the rest of the process. */
export function getEnv(): EnvResolution {
  cached ??= resolveEnv(process.env);
  return cached;
}
