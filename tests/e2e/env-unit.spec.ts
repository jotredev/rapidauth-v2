import { expect, test } from '@playwright/test';
import { formatEnvSummary, resolveEnv } from '../../lib/env';

const google = { GOOGLE_CLIENT_ID: 'id', GOOGLE_CLIENT_SECRET: 'secret' };
const github = { GITHUB_CLIENT_ID: 'id', GITHUB_CLIENT_SECRET: 'secret' };
const turnstile = {
  NEXT_PUBLIC_TURNSTILE_SITE_KEY: 'site',
  TURNSTILE_SECRET_KEY: 'secret',
};
const s3 = {
  STORAGE_DRIVER: 's3',
  S3_REGION: 'auto',
  S3_BUCKET: 'bucket',
  S3_ACCESS_KEY_ID: 'key',
  S3_SECRET_ACCESS_KEY: 'secret',
  S3_PUBLIC_URL: 'https://cdn.example.com',
};

test.describe('environment resolution', () => {
  test('an empty environment resolves to defaults without errors', () => {
    const { config, error, problems } = resolveEnv({});
    expect(error).toBeNull();
    expect(problems).toEqual([]);
    expect(config).toEqual({
      database: { docker: false },
      email: { provider: 'mailpit' },
      storage: { driver: 'local' },
      turnstile: { enabled: false },
      google: { enabled: false },
      github: { enabled: false },
      sentry: { enabled: false },
    });
  });

  test('detects the Docker database only when DOCKER_DATABASE is "true"', () => {
    expect(resolveEnv({ DOCKER_DATABASE: 'true' }).config.database.docker).toBe(true);
    expect(resolveEnv({ DOCKER_DATABASE: 'false' }).config.database.docker).toBe(false);
    expect(resolveEnv({ DOCKER_DATABASE: '1' }).config.database.docker).toBe(false);
  });

  test('resolves the email provider', () => {
    expect(resolveEnv({ RESEND_API_KEY: 're_123' }).config.email.provider).toBe('resend');
    expect(resolveEnv({ RESEND_API_KEY: '  ' }).config.email.provider).toBe('mailpit');
    expect(resolveEnv({ EMAIL_DELIVERY: 'outbox' }).config.email.provider).toBe('outbox');
    expect(
      resolveEnv({ EMAIL_DELIVERY: 'outbox', RESEND_API_KEY: 're_123' }).config.email.provider,
    ).toBe('outbox');
  });

  test('resolves the storage driver', () => {
    expect(resolveEnv({ STORAGE_DRIVER: 'local' }).config.storage.driver).toBe('local');
    const resolved = resolveEnv(s3);
    expect(resolved.error).toBeNull();
    expect(resolved.config.storage.driver).toBe('s3');
  });

  test('enables each complete pair', () => {
    const { config, error } = resolveEnv({ ...google, ...github, ...turnstile });
    expect(error).toBeNull();
    expect(config.google.enabled).toBe(true);
    expect(config.github.enabled).toBe(true);
    expect(config.turnstile.enabled).toBe(true);
  });

  test('enables Sentry only with a valid DSN', () => {
    const dsn = 'https://public@o0.ingest.sentry.io/1';
    expect(resolveEnv({ NEXT_PUBLIC_SENTRY_DSN: dsn }).config.sentry.enabled).toBe(true);
    expect(resolveEnv({ NEXT_PUBLIC_SENTRY_DSN: 'nope' }).config.sentry.enabled).toBe(false);
  });

  test('reports an incomplete Google pair', () => {
    const { config, error } = resolveEnv({ GOOGLE_CLIENT_ID: 'id' });
    expect(config.google.enabled).toBe(false);
    expect(error).toContain('Google: missing GOOGLE_CLIENT_SECRET');
    expect(resolveEnv({ GOOGLE_CLIENT_SECRET: 's' }).error).toContain('missing GOOGLE_CLIENT_ID');
  });

  test('reports an incomplete GitHub pair', () => {
    const { config, error } = resolveEnv({ GITHUB_CLIENT_SECRET: 's' });
    expect(config.github.enabled).toBe(false);
    expect(error).toContain('GitHub: missing GITHUB_CLIENT_ID');
  });

  test('reports an incomplete Turnstile pair', () => {
    const { config, error } = resolveEnv({ NEXT_PUBLIC_TURNSTILE_SITE_KEY: 'site' });
    expect(config.turnstile.enabled).toBe(false);
    expect(error).toContain('Turnstile: missing TURNSTILE_SECRET_KEY');
    expect(resolveEnv({ TURNSTILE_SECRET_KEY: 's' }).error).toContain(
      'missing NEXT_PUBLIC_TURNSTILE_SITE_KEY',
    );
  });

  test('reports a partial S3 configuration listing every missing variable', () => {
    const { error } = resolveEnv({ STORAGE_DRIVER: 's3', S3_BUCKET: 'bucket' });
    expect(error).toContain('S3_REGION');
    expect(error).toContain('S3_ACCESS_KEY_ID');
    expect(error).toContain('S3_SECRET_ACCESS_KEY');
    expect(error).toContain('S3_PUBLIC_URL');
    expect(error).not.toContain('S3_BUCKET,');
  });

  test('reports an invalid storage driver', () => {
    const { error } = resolveEnv({ STORAGE_DRIVER: 'ftp' });
    expect(error).toContain('Invalid STORAGE_DRIVER "ftp"');
  });

  test('lists every incomplete pair in one single error', () => {
    const { error, problems } = resolveEnv({
      GOOGLE_CLIENT_ID: 'id',
      GITHUB_CLIENT_SECRET: 's',
      TURNSTILE_SECRET_KEY: 's',
      STORAGE_DRIVER: 's3',
    });
    expect(problems).toHaveLength(4);
    expect(error).toContain('GOOGLE_CLIENT_SECRET');
    expect(error).toContain('GITHUB_CLIENT_ID');
    expect(error).toContain('NEXT_PUBLIC_TURNSTILE_SITE_KEY');
    expect(error).toContain('S3_REGION');
    expect(error?.startsWith('Incomplete environment configuration:')).toBe(true);
  });

  test('does not mutate the environment it receives', () => {
    const env = { ...google };
    resolveEnv(env);
    expect(env).toEqual(google);
  });

  test('pairs use the same rule as the app: any non-empty value counts as set', () => {
    const { config, error } = resolveEnv({
      GOOGLE_CLIENT_ID: ' ',
      GOOGLE_CLIENT_SECRET: ' ',
      NEXT_PUBLIC_TURNSTILE_SITE_KEY: ' ',
    });
    expect(config.google.enabled).toBe(true);
    expect(config.turnstile.enabled).toBe(false);
    expect(error).toContain('Turnstile: missing TURNSTILE_SECRET_KEY');
    expect(error).not.toContain('Google');
  });

  test('formats a short summary from resolved values only', () => {
    const secret = 'super-secret-value';
    const { config } = resolveEnv({
      DOCKER_DATABASE: 'true',
      RESEND_API_KEY: secret,
      ...google,
      NEXT_PUBLIC_SENTRY_DSN: 'https://public@o0.ingest.sentry.io/1',
    });
    const summary = formatEnvSummary(config);
    expect(summary).toBe(
      [
        'Environment:',
        '  Database:  Docker PostgreSQL',
        '  Emails:    Resend',
        '  Files:     local disk',
        '  Turnstile: off',
        '  Google:    on',
        '  GitHub:    off',
        '  Sentry:    on',
      ].join('\n'),
    );
    expect(summary).not.toContain(secret);
    expect(summary).not.toContain('sentry.io');
    expect(formatEnvSummary(resolveEnv({}).config)).toContain('Emails:    Mailpit');
    expect(formatEnvSummary(resolveEnv(s3).config)).toContain('Files:     S3');
  });
});
