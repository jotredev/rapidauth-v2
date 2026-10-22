import { expect, test } from '@playwright/test';
import { formatEnvSummary, resolveEnv } from '../../lib/env';

const google = { GOOGLE_CLIENT_ID: 'id', GOOGLE_CLIENT_SECRET: 'secret' };
const github = { GITHUB_CLIENT_ID: 'id', GITHUB_CLIENT_SECRET: 'secret' };
const turnstile = {
  TURNSTILE_SITE_KEY: 'site',
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
      email: {
        provider: 'mailpit',
        mailpitSmtpAddress: 'localhost:1025',
        mailpitOnRemoteHost: false,
        from: 'RapidAuth <onboarding@resend.dev>',
        outboxDir: '.e2e-outbox',
      },
      storage: {
        driver: 'local',
        driverError: null,
        s3: null,
        s3Problem: expect.stringContaining('S3_REGION'),
      },
      turnstile: { enabled: false },
      google: { enabled: false },
      github: { enabled: false },
      sentry: { enabled: false },
    });
  });

  test('detects the Docker database from DATABASE_URL and DB_PORT', () => {
    const local = 'postgresql://rapidauth:rapidauth@localhost:5432/rapidauth?sslmode=disable';
    const docker = (env: Record<string, string>) => resolveEnv(env).config.database.docker;
    expect(docker({ DATABASE_URL: local })).toBe(true);
    expect(docker({ DATABASE_URL: local.replace('localhost', '127.0.0.1') })).toBe(true);
    expect(docker({ DATABASE_URL: local.replace('localhost', '[::1]') })).toBe(true);
    expect(docker({ DATABASE_URL: local.replace(':5432', ':55432'), DB_PORT: '55432' })).toBe(true);
    expect(docker({ DATABASE_URL: local.replace(':5432', ':55432') })).toBe(false);
    expect(docker({ DATABASE_URL: local, DB_PORT: '55432' })).toBe(false);
    expect(docker({ DATABASE_URL: 'postgresql://u:p@ep-x.neon.tech:5432/neondb?sslmode=require' })).toBe(false);
    expect(docker({ DATABASE_URL: local.replace('rapidauth@', 'other@') })).toBe(false);
    expect(docker({ DATABASE_URL: 'not a url' })).toBe(false);
    expect(docker({})).toBe(false);
  });

  test('resolves the email provider', () => {
    expect(resolveEnv({ RESEND_API_KEY: 're_123' }).config.email.provider).toBe('resend');
    expect(resolveEnv({ RESEND_API_KEY: '  ' }).config.email.provider).toBe('mailpit');
    expect(resolveEnv({ EMAIL_DELIVERY: 'outbox' }).config.email.provider).toBe('outbox');
    expect(
      resolveEnv({ EMAIL_DELIVERY: 'outbox', RESEND_API_KEY: 're_123' }).config.email.provider,
    ).toBe('outbox');
  });

  test('reads the internal Mailpit address and defaults to localhost:1025', () => {
    expect(resolveEnv({}).config.email.mailpitSmtpAddress).toBe('localhost:1025');
    expect(resolveEnv({ MAILPIT_SMTP_ADDRESS: '  ' }).config.email.mailpitSmtpAddress).toBe(
      'localhost:1025',
    );
    expect(
      resolveEnv({ MAILPIT_SMTP_ADDRESS: 'mailpit:1025' }).config.email.mailpitSmtpAddress,
    ).toBe('mailpit:1025');
  });

  test('warns when Mailpit is used with a non-local BETTER_AUTH_URL, without blocking', () => {
    const remote = resolveEnv({ BETTER_AUTH_URL: 'https://app.example.com' });
    expect(remote.error).toBeNull();
    expect(remote.config.email.mailpitOnRemoteHost).toBe(true);
    const summary = formatEnvSummary(remote.config);
    expect(summary).toContain('WARNING');
    expect(summary).toContain('will not reach anyone');
    expect(summary).not.toContain('app.example.com');

    for (const url of ['http://localhost:3000', 'http://127.0.0.1:3100', undefined, 'not a url']) {
      const { config } = resolveEnv({ BETTER_AUTH_URL: url });
      expect(config.email.mailpitOnRemoteHost).toBe(false);
      expect(formatEnvSummary(config)).not.toContain('WARNING');
    }

    // With a key (Resend) or the test outbox there is nothing to warn about.
    for (const extra of [{ RESEND_API_KEY: 're_123' }, { EMAIL_DELIVERY: 'outbox' }]) {
      const { config } = resolveEnv({ BETTER_AUTH_URL: 'https://app.example.com', ...extra });
      expect(config.email.mailpitOnRemoteHost).toBe(false);
      expect(formatEnvSummary(config)).not.toContain('WARNING');
    }
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
    const { config, error } = resolveEnv({ TURNSTILE_SITE_KEY: 'site' });
    expect(config.turnstile.enabled).toBe(false);
    expect(error).toContain('Turnstile: missing TURNSTILE_SECRET_KEY');
    expect(resolveEnv({ TURNSTILE_SECRET_KEY: 's' }).error).toContain(
      'missing TURNSTILE_SITE_KEY',
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
    expect(error).toContain('TURNSTILE_SITE_KEY');
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
      TURNSTILE_SITE_KEY: ' ',
    });
    expect(config.google.enabled).toBe(true);
    expect(config.turnstile.enabled).toBe(false);
    expect(error).toContain('Turnstile: missing TURNSTILE_SECRET_KEY');
    expect(error).not.toContain('Google');
  });

  test('formats a short summary from resolved values only', () => {
    const secret = 'super-secret-value';
    const { config } = resolveEnv({
      DATABASE_URL: 'postgresql://rapidauth:rapidauth@localhost:5432/rapidauth?sslmode=disable',
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

  test('exposes the resolved values the modules read', () => {
    const { config } = resolveEnv({
      ...google,
      ...github,
      ...turnstile,
      ...s3,
      RESEND_API_KEY: ' re_123 ',
      FROM_EMAIL: 'App <hi@example.com>',
      EMAIL_DELIVERY: 'outbox',
      EMAIL_OUTBOX_DIR: '/tmp/outbox',
      S3_FORCE_PATH_STYLE: 'true',
      S3_ENDPOINT: ' http://127.0.0.1:9090 ',
    });
    expect(config.google).toEqual({ enabled: true, clientId: 'id', clientSecret: 'secret' });
    expect(config.github).toEqual({ enabled: true, clientId: 'id', clientSecret: 'secret' });
    expect(config.turnstile).toEqual({ enabled: true, siteKey: 'site', secretKey: 'secret' });
    expect(config.email).toEqual({
      provider: 'outbox',
      resendApiKey: ' re_123 ',
      mailpitSmtpAddress: 'localhost:1025',
      mailpitOnRemoteHost: false,
      from: 'App <hi@example.com>',
      outboxDir: '/tmp/outbox',
    });
    expect(config.storage.s3).toEqual({
      endpoint: 'http://127.0.0.1:9090',
      region: 'auto',
      bucket: 'bucket',
      accessKeyId: 'key',
      secretAccessKey: 'secret',
      publicUrl: 'https://cdn.example.com',
      forcePathStyle: true,
    });
  });

  test('the summary never includes any resolved secret value', () => {
    const { config } = resolveEnv({
      ...google,
      ...turnstile,
      ...s3,
      RESEND_API_KEY: 're_topsecret',
      GOOGLE_CLIENT_SECRET: 'google-topsecret',
      TURNSTILE_SECRET_KEY: 'turnstile-topsecret',
      S3_SECRET_ACCESS_KEY: 's3-topsecret',
    });
    const summary = formatEnvSummary(config);
    for (const value of ['topsecret', 'cdn.example.com', 'bucket', 'site']) {
      expect(summary).not.toContain(value);
    }
  });
});
