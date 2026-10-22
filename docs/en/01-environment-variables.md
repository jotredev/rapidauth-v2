# Environment variables

This reference covers every variable read by the application and setup scripts. The `.env.example` file provides a copyable template. Never commit real secrets.

## Database

### `DATABASE_URL`

- **Purpose:** PostgreSQL connection used by the app, Prisma, and the database scripts.
- **Required:** Development and production.
- **Where to get it:** Copy the connection string from your PostgreSQL provider, such as Neon.
- **Example format:** `postgresql://USER:PASSWORD@HOST:5432/DATABASE?sslmode=require`
- **Local Docker database:** `postgresql://rapidauth:rapidauth@localhost:5432/rapidauth?sslmode=disable` (use your `DB_PORT` if you changed it).
- **Warning:** `sslmode=disable` is only for the local PostgreSQL database in Docker. Never use it in production.
- **Secret:** Yes. It contains database credentials.

### `DOCKER_DATABASE`

- **Purpose:** Enables automatic startup of the local PostgreSQL service in Docker before `bun dev` starts lint and Next.js.
- **Required:** No. The default is `false`; `init:setup` sets it to `true` when you choose a local Docker database.
- **Values:** `true` or `false`. Only the exact value `true` enables Docker startup. Choosing an external database removes this variable; keeping an existing `DATABASE_URL` also keeps its existing value.
- **Secret:** No.

## Better Auth

### `BETTER_AUTH_SECRET`

- **Purpose:** Signs and encrypts Better Auth session data.
- **Required:** Development and production.
- **Where to get it:** Generate a unique value with `openssl rand -hex 32` or `node -p "require('node:crypto').randomBytes(32).toString('hex')"`.
- **Example format:** `64-characters-of-random-hex`
- **Secret:** Yes. Use a different value for each environment and never expose it to the client.

### `BETTER_AUTH_URL`

- **Purpose:** Public base URL Better Auth uses to build callback and email links.
- **Required:** Development and production.
- **Where to get it:** Use `http://localhost:3000` locally; use the canonical HTTPS URL for each deployed environment.
- **Example format:** `https://auth.example.com`
- **Secret:** No. Keep it aligned with the URL from which the app is served.

## Scheduled cleanup and client IPs

### `CRON_SECRET`

- **Purpose:** Protects the optional `GET /api/cron/cleanup` route used by Vercel Cron or the included GitHub Actions workflow.
- **Required:** No. Missing values and values shorter than 32 characters disable the route with HTTP 404.
- **Where to get it:** Run `bun run setup:cleanup` to generate a 64-character random secret, or generate an equivalent secret yourself.
- **Secret:** Yes. Keep the same value in the running application and its scheduler; never expose it to the browser or commit it.

### `TRUSTED_PROXY`

- **Purpose:** Selects the only request header RapidAuth may trust as the client IP for rate limits, activity logs, and Better Auth sessions.
- **Required:** No. The safe default is `none`.
- **Values:** `none`, `vercel`, `cloudflare`, or `proxy`.
- **Handling:** Unknown values behave as `none` and produce one startup warning. Production also warns once when the value is `none`, because IP-based limits are then disabled while email- and user-based limits keep working.
- **Secret:** No. Run `bun run setup:proxy` or see [Scheduled cleanup and trusted proxy setup](07-scheduled-cleanup.md).

## Email

### `EMAIL_DELIVERY`

- **Purpose:** Selects the email transport. The default `resend` sends through Resend; `outbox` writes test messages to disk.
- **Required:** No.
- **Values:** `resend` or `outbox`.
- **Warning:** `outbox` is only for automated tests and is rejected in production.
- **Secret:** No.

### `EMAIL_OUTBOX_DIR`

- **Purpose:** Directory where `EMAIL_DELIVERY=outbox` writes JSON messages, including the recipient, subject, HTML and primary link.
- **Required:** No. Defaults to `.e2e-outbox/`.
- **Warning:** Test use only; the default directory is ignored by Git.
- **Secret:** No.

### `RESEND_API_KEY`

- **Purpose:** Authenticates email requests sent through Resend.
- **Required:** For email delivery in development and production; use production credentials for production.
- **Where to get it:** Create an API key in the Resend dashboard.
- **Example format:** `re_replace_with_your_resend_key`
- **Secret:** Yes. Keep it server-side.

### `FROM_EMAIL`

- **Purpose:** Sender name and address for verification and password emails.
- **Required:** Development has an application fallback; production email delivery requires a sender address authorized by Resend.
- **Where to get it:** Choose an address on a domain verified in Resend.
- **Example format:** `RapidAuth <noreply@example.com>`
- **Secret:** No. The domain must be verified before production email delivery.

## Support

### `SUPPORT_EMAIL`

- **Purpose:** Public support and legal contact email address. Shown on the `/support` page, on legal pages (`/terms` and `/privacy`), and in account deletion and security notice emails.
- **Required:** Required for production builds (`next build` fails if missing or invalid). Optional in development (displays a placeholder explaining configuration is pending).
- **Where to get it:** Configure your support mailbox address (e.g., `support@yourdomain.com`). Run `bun run init:setup --only support` (or `bun run setup:support`) to configure it.
- **Example format:** `support@example.com`
- **Build note:** The value is baked in during the build for static pages (`/terms` and `/privacy`).
- **Secret:** No. It is a public contact address.

## Turnstile

Turnstile is optional. It turns on only when both `TURNSTILE_SITE_KEY` and `TURNSTILE_SECRET_KEY` are set; with neither, it is off and nothing fails. Turning it on in production is recommended: set both variables on the server where you deploy (Vercel, Docker on a VPS, or any other host). The server reads them when it starts, so changing them needs a restart, not a rebuild.

### `TURNSTILE_SITE_KEY`

- **Purpose:** Public key rendered by the browser widget. The server reads it and passes it to the page.
- **Required:** No. Set it together with `TURNSTILE_SECRET_KEY`; setting only one stops the server with an error.
- **Where to get it:** Create a Cloudflare Turnstile widget. See [Cloudflare Turnstile](02-turnstile.md).
- **Example format:** `your-real-turnstile-site-key`
- **Secret:** No. It is sent to the browser, but it is a normal runtime variable (not `NEXT_PUBLIC_*`), so it is not compiled into the build.

### `TURNSTILE_SECRET_KEY`

- **Purpose:** Validates Turnstile tokens on the server.
- **Required:** No. Set it together with `TURNSTILE_SITE_KEY`.
- **Where to get it:** Copy the Secret Key belonging to the same Cloudflare Turnstile widget as the site key.
- **Example format:** `your-real-turnstile-secret-key`
- **Secret:** Yes. Keep it server-side and provide it to the running server or container, never to the build.

## Error monitoring (Sentry)

All Sentry variables are optional. With an empty or invalid `NEXT_PUBLIC_SENTRY_DSN`, the SDK is not initialized and sends no requests. See the step-by-step [Error monitoring guide](06-error-monitoring.md).

### `NEXT_PUBLIC_SENTRY_DSN`

- **Purpose:** Activates Sentry error reporting in the server and browser.
- **Required:** No. Leave it empty to keep Sentry fully disabled.
- **Where to get it:** Sentry Project Settings → Client Keys (DSN).
- **Secret:** No. A DSN is a public routing key and is embedded in the client bundle.
- **Validation:** An invalid value leaves Sentry disabled and produces one startup warning.

### `SENTRY_ORG`, `SENTRY_PROJECT`, and `SENTRY_AUTH_TOKEN`

- **Purpose:** Upload source maps during a build so production stack traces show original source files and lines.
- **Required:** No. Uploading occurs only when all three values are present.
- **Where to get them:** Copy the organization and project slugs from Sentry Settings. Create the token under Organization Settings → Developer Settings → Auth Tokens with only `org:read` and `project:releases`.
- **Secret:** Only `SENTRY_AUTH_TOKEN` is secret. It is build-only, never exposed to the browser, and Docker must mount it as a BuildKit secret rather than an argument or environment layer.

### `SENTRY_TRACES_SAMPLE_RATE`

- **Purpose:** Chooses the fraction of performance traces sent to Sentry.
- **Required:** No. The default is `0`, so only errors are reported.
- **Values:** A number from `0` to `1`; for example, `0.1` samples about ten percent of traces.
- **Secret:** No.

## OAuth

Each provider is optional and turns on, together with its sign-in button, only when both its client ID and client secret are set. The server reads them when it starts, so changing them needs a restart, not a rebuild.

For either provider, add its callback URL to the provider's OAuth application: `<BETTER_AUTH_URL>/api/auth/callback/google` or `<BETTER_AUTH_URL>/api/auth/callback/github`. For example, the local Google callback is `http://localhost:3000/api/auth/callback/google`.

### `GOOGLE_CLIENT_ID`

- **Purpose:** Identifies the Google OAuth application.
- **Required:** Not required unless Google sign-in is enabled, in development or production.
- **Where to get it:** Google Cloud Console → APIs & Services → Credentials.
- **Example format:** `1234567890-example.apps.googleusercontent.com`
- **Secret:** No. Configure the matching callback URL above.

### `GOOGLE_CLIENT_SECRET`

- **Purpose:** Authenticates RapidAuth to the Google OAuth application.
- **Required:** Not required unless Google sign-in is enabled, in development or production.
- **Where to get it:** Google Cloud Console, with the client ID.
- **Example format:** `replace-with-google-client-secret`
- **Secret:** Yes. Keep it server-side.

### `GITHUB_CLIENT_ID`

- **Purpose:** Identifies the GitHub OAuth application.
- **Required:** Not required unless GitHub sign-in is enabled, in development or production.
- **Where to get it:** GitHub Settings → Developer settings → OAuth Apps.
- **Example format:** `Iv1.exampleclientid`
- **Secret:** No. Configure the matching callback URL above.

### `GITHUB_CLIENT_SECRET`

- **Purpose:** Authenticates RapidAuth to the GitHub OAuth application.
- **Required:** Not required unless GitHub sign-in is enabled, in development or production.
- **Where to get it:** GitHub OAuth App settings, with the client ID.
- **Example format:** `replace-with-github-client-secret`
- **Secret:** Yes. Keep it server-side.

## File storage

See the beginner [File storage guide](05-file-storage.md) for creating a bucket and testing its public URL.

### `STORAGE_DRIVER`

- **Purpose:** Chooses where avatars are stored.
- **Required:** No. Defaults to `local`.
- **Values:** `local` or `s3`.
- **Production:** Local requires persistent writable disk; S3 requires all `S3_*` values below.
- **Secret:** No.

### `S3_ENDPOINT`

- **Purpose:** S3 API endpoint for compatible providers. Leave empty for Amazon S3.
- **Required:** No.
- **Example:** `https://<account-id>.r2.cloudflarestorage.com` for Cloudflare R2.
- **Secret:** No.

### `S3_REGION`

- **Purpose:** Region sent to the S3 API.
- **Required:** When `STORAGE_DRIVER=s3`.
- **Examples:** `auto` for Cloudflare R2; the region assigned by Amazon S3 or another provider.
- **Secret:** No.

### `S3_BUCKET`

- **Purpose:** Bucket name for uploaded avatar objects.
- **Required:** When `STORAGE_DRIVER=s3`.
- **Secret:** No.

### `S3_ACCESS_KEY_ID` and `S3_SECRET_ACCESS_KEY`

- **Purpose:** Server credentials allowed to read, write, and delete objects in the avatar bucket.
- **Required:** When `STORAGE_DRIVER=s3`.
- **Secret:** `S3_ACCESS_KEY_ID` is sensitive; `S3_SECRET_ACCESS_KEY` is secret. Keep both server-side.

### `S3_PUBLIC_URL`

- **Purpose:** Public base URL for the bucket or a custom domain. RapidAuth appends each object key to it.
- **Required:** When `STORAGE_DRIVER=s3`.
- **Example:** `https://avatars.example.com` or the provider's public bucket URL.
- **Secret:** No. Objects are readable by anyone with the URL.

### `S3_FORCE_PATH_STYLE`

- **Purpose:** Tells the S3 client whether to put the bucket name in the URL path (`true`) or hostname (`false`).
- **Required:** No. Defaults to `false`.
- **Examples:** Use `true` with Cloudflare R2 and many self-hosted S3 services; use `false` with Amazon S3.
- **Values:** `true` or `false`.
- **Secret:** No.

## Seed

These variables are read only by `bun run db:seed`; they are not needed by the app after seeding.

### `SEED_ADMIN_EMAIL`

- **Purpose:** Email address of the initial admin account. After the first password sign-in, activate 2FA under **Profile → Security** before using the admin panel.
- **Required:** Not required. The seed defaults to `admin@admin.com`.
- **Where to get it:** Choose an email address you control.
- **Example format:** `admin@example.com`
- **Secret:** No. Used only by the seed script.

### `SEED_ADMIN_PASSWORD`

- **Purpose:** Password for the initial admin account.
- **Required:** Not required. If unset, the seed generates a password and prints it once.
- **Where to get it:** Choose a unique password of at least 8 characters.
- **Example format:** `replace-with-a-unique-password`
- **Secret:** Yes. Used only by the seed script. Do not leave a sample value active in a real `.env`.

## Themes

### `GITHUB_TOKEN`

- **Purpose:** Lets the optional theme selector download premium themes from GitHub.
- **Required:** Not required for the app or free/default themes.
- **Where to get it:** Create a GitHub personal access token with access to the requested theme repository. The theme selector prompts for a token and saves it in `.env.local`.
- **Example format:** `github_pat_replace_with_your_token`
- **Secret:** Yes. The theme selector reads it from `.env.local`; it is not needed by the running app.

## Startup check and summary

When the server starts (`bun dev` or `bun run start`), RapidAuth reads these variables once and prints a short summary of what is active. Only states are shown, never keys, URLs, or DSNs:

```text
Environment:
  Database:  Docker PostgreSQL
  Emails:    Resend
  Files:     local disk
  Turnstile: on
  Google:    off
  GitHub:    off
  Sentry:    off
```

Some features are enabled by a pair of variables. The server checks these pairs:

- Google: `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`.
- GitHub: `GITHUB_CLIENT_ID` and `GITHUB_CLIENT_SECRET`.
- Turnstile: `TURNSTILE_SITE_KEY` and `TURNSTILE_SECRET_KEY`.
- S3 storage: when `STORAGE_DRIVER=s3`, all the `S3_*` variables it requires (see [File storage](#file-storage)).

If you set neither variable of a Google, GitHub, or Turnstile pair, the feature is simply off and there is no error. If you set only one, the server prints a single error that lists everything missing and stops:

```text
Incomplete environment configuration:
- Google: missing GOOGLE_CLIENT_SECRET.
- GitHub: missing GITHUB_CLIENT_ID.
```

An invalid `STORAGE_DRIVER` or incomplete S3 settings are reported in the same error.

## Public values and build timing

Google, GitHub, and Turnstile settings are read when the server starts: change them and restart, with no rebuild. The remaining `NEXT_PUBLIC_*` values (such as the Sentry DSN) are public and compiled into the client bundle; changing one of those requires a new `next build` and deployment.

---

← [Manual setup](00-manual-setup.md) · [English index](README.md) · [Next: Cloudflare Turnstile →](02-turnstile.md)
