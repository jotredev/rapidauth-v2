# Manual setup

This guide installs and configures RapidAuth without running `bun run init:setup`. Follow the steps in order.

## 1. Prepare the requirements

- Install [Bun](https://bun.sh/).
- If you use Node.js directly for the Next.js runtime, use version 20.9 or newer.
- Have access to a PostgreSQL database, such as Neon or another PostgreSQL provider.
- Create a [Resend](https://resend.com/) account for email delivery. It is optional in development: without a key, emails go to Mailpit at `http://localhost:8025` (started by Docker Compose); it is required in production.
- Optional but recommended for production: create a free Cloudflare account and real Turnstile keys. See [Cloudflare Turnstile](02-turnstile.md).
- OAuth credentials are optional. Create Google and/or GitHub OAuth applications only if you want social sign-in.
- Sentry error monitoring is optional. The app makes no Sentry requests without a valid DSN; see [Error monitoring](06-error-monitoring.md) if you want to enable it.

Clone the project and enter its directory:

```sh
git clone https://github.com/yourusername/rapidauth-better-auth.git
cd rapidauth-better-auth
```

## 2. Install dependencies

```sh
bun install
```

The `postinstall` script automatically runs `prisma generate`. You do not need to run it separately after a normal `bun install`.

## 3. Create and fill `.env`

Copy the example file, then edit `.env`:

```sh
cp .env.example .env
```

Use the [environment variable reference](01-environment-variables.md) to fill in the database, Better Auth, email, and other values. Generate a unique `BETTER_AUTH_SECRET` with either command:

```sh
openssl rand -hex 32
```

```sh
node -p "require('node:crypto').randomBytes(32).toString('hex')"
```

Paste the generated 64-character hexadecimal value into `.env`. Set `BETTER_AUTH_URL` to `http://localhost:3000` for local development. Set it to the public base URL in each deployed environment.

## 4. Configure and check email

Set `RESEND_API_KEY` and `FROM_EMAIL`. In development you can leave `RESEND_API_KEY` empty: emails then go to Mailpit at `http://localhost:8025` instead of Resend. For production, verify the sender domain in Resend and use an address on that domain. You can make a minimal API check with a verified sender and recipient:

```sh
export RESEND_API_KEY="re_replace_with_your_resend_key"

curl https://api.resend.com/emails \
  -H "Authorization: Bearer $RESEND_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"from":"RapidAuth <noreply@example.com>","to":["you@example.com"],"subject":"RapidAuth email test","html":"<p>Email delivery works.</p>"}'
```

Replace the example sender and recipient with addresses you control. A successful response includes an email ID; also check that the message arrives.

## 5. Configure optional OAuth

For each provider you want to enable, set its client ID and secret in `.env` and set the corresponding `NEXT_PUBLIC_*_ENABLED` value to `true`. Set it to `false` when the provider is disabled. Add these callback URLs to the OAuth application:

- Google: `<BETTER_AUTH_URL>/api/auth/callback/google`
- GitHub: `<BETTER_AUTH_URL>/api/auth/callback/github`

For local development, for example, the Google callback is `http://localhost:3000/api/auth/callback/google`.

Each provider, and its button, turns on only when both its client ID and client secret are set. The server reads them when it starts, so restart it to change them; no rebuild is needed.

Google and GitHub sign-in only opens existing accounts. New users must start from the registration page and accept the Terms of Service and Privacy Policy before continuing to the provider.

## 6. Configure Turnstile

Turnstile is optional. It turns on only when both `TURNSTILE_SITE_KEY` and `TURNSTILE_SECRET_KEY` are set; with neither, it stays off and nothing fails. We recommend always turning it on in production by setting both variables on the server where you deploy. For `next dev` you can use Cloudflare test keys. The production build does not need the keys: the server reads them when it starts, so changing them only needs a restart. Follow the [Turnstile guide](02-turnstile.md) to create a widget and authorize the hostnames where the app will be served.

## 7. Push the schema and seed the admin

Sentry remains optional. Run `bun run setup:sentry` at any time for a guided setup, or follow the [manual Sentry guide](06-error-monitoring.md). Skipping it does not affect builds or application features.

With `DATABASE_URL` set in `.env`, run:

```sh
bun run db:push
bun run db:seed
```

The user schema stores the accepted terms date and version, plus the state and expiration of temporary passwords. Run `bunx prisma db push` when deploying this version to an existing installation as well as during a fresh setup. After the schema is updated, every user without a stored acceptance—including existing users—will see the terms acceptance screen after signing in. Users whose stored version is old see the same screen again. Change `termsVersion` in `config/site.ts` whenever the legal terms require renewed acceptance; that change makes the current version mandatory for every account.

Every user created from the admin panel receives an invitation email. The invitation is valid for 7 days, lets the user set a password and accept the current terms, and can be resent from the user table while it remains pending. A temporary password generated by an admin must be changed at the next sign-in and expires after 72 hours. An admin cannot generate a temporary password for another admin; use the password-reset email link instead.

The seed creates the first admin account. `SEED_ADMIN_EMAIL` defaults to `admin@admin.com`. You can set `SEED_ADMIN_PASSWORD` to a password of at least 8 characters before seeding. If it is unset, the seed generates a password and prints it once; save it because the seed will not show it again. If the admin already exists, the seed skips creating another account. After signing in, this password admin must activate two-factor authentication under **Profile → Security** before using the admin panel. OAuth-only admins are exempt because their provider supplies the second factor.

## 8. Optionally select an auth theme

```sh
bun run theme:select
```

The theme selector is optional. Some premium themes require a GitHub personal access token. The selector prompts for it and saves it to `.env.local`; it does not need to be set for the free/default theme.

Before replacing files, the selector lists every affected path. It checks Git changes and compares those paths with the Classic theme. If it finds changes, type the theme name to confirm. It always saves a copy under `.theme-backups/<timestamp>/` before replacing files; the folder is ignored by Git. To restore, copy each saved path from that timestamp folder back to the same path in the project root.

Themes never include or replace the dashboard. A v2 `theme.json` must declare a compatible `coreVersion`, for example `">=0.2.0"`. Only the `>=x.y.z` form is supported, and the version must be at least `0.2.0` (the release that moved Turnstile and the email verification flow into the auth pages) and no newer than the installed core. Themes with a missing or incompatible version are rejected before files are changed. Aurora and Nexus need an update for RapidAuth 0.2.0.

Template maintainers should run `bun run theme:sync-classic` after changing auth, landing, layout, styles, or shared UI files. Use `bun run theme:sync-classic --check` to list differences without writing; CI runs this check.

## Switch databases (Neon ↔ Docker)

Run `bun run db:switch` and choose an external PostgreSQL database or the local Docker database. The wizard saves the previous URL as a comment in `.env`, then runs `prisma db push` and the seed against the new database. Database records are not copied between the two databases.

You can switch manually by changing `DATABASE_URL` and `DOCKER_DATABASE` in `.env`. Set `DOCKER_DATABASE=true` for the local Docker database and remove the variable or set it to `false` for an external database. Then run:

```sh
bun run db:push
bun run db:seed
```

Use `sslmode=disable` only with the local Docker database. Never use it for production.

## CI and Bun version

Use Bun **1.4.2**, the version pinned by `package.json`. GitHub Actions has quality, production build, build guard, dependency audit, and Docker jobs. Run `bun run lint`, `bun run typecheck`, `bun run theme:sync-classic --check`, and `bun audit --audit-level=high` locally. The Docker guide shows how to reproduce its stack checks. To check the production build without connecting to a real database, use dummy database/auth values:

```sh
BUILD_ENV='DATABASE_URL=postgresql://build:build@127.0.0.1:5432/build?sslmode=disable BETTER_AUTH_URL=http://localhost:3000 BETTER_AUTH_SECRET=0000000000000000000000000000000000000000000000000000000000000000 NEXT_TELEMETRY_DISABLED=1'
env $BUILD_ENV SUPPORT_EMAIL=support@example.invalid bun run build # expected to compile without any Turnstile key
env $BUILD_ENV SUPPORT_EMAIL= bun run build # expected to fail: SUPPORT_EMAIL is required
```

The production build does not need Turnstile keys.

## Account deletion

Signed-in users can permanently delete their account from **Profile → Security**. Deletion removes their profile data, sessions, connected accounts, two-factor settings, activity history, and stored avatar, then sends an email notice. A password is required for password accounts; OAuth-only accounts need a session created in the last 10 minutes. The last active administrator must add another active admin before deleting their account.

## Security notices

RapidAuth sends the account owner an email notice when their password is changed from the profile, reset from an email link, or replaced with a temporary password by an admin. It also sends a notice after two-factor authentication is confirmed as enabled or is disabled. These notices contain the UTC time and support address, but never include passwords, TOTP secrets, or backup codes.

## 9. Start the app and verify the admin login

```sh
bun dev
```

Open [http://localhost:3000](http://localhost:3000), go to the sign-in page, and log in with `SEED_ADMIN_EMAIL` and the password printed or configured during seeding. Open **Profile → Security**, activate two-factor authentication, and then confirm that the admin dashboard loads.

## Before deploying

- Review and personalize the public Terms of Service (`/terms`) and Privacy Policy (`/privacy`) before launch. Set `legalEntityName`, `governingLaw`, `lastUpdated`, and `termsVersion` in `config/site.ts`, and set `SUPPORT_EMAIL` in your environment (see [Environment variables](01-environment-variables.md)), then edit the page copy in `app/(legal)/terms/page.tsx` and `app/(legal)/privacy/page.tsx` to match your service. Increase `termsVersion` whenever users must accept a revised version. These documents are templates, not legal advice; have a qualified lawyer review them.
- Set a unique `BETTER_AUTH_SECRET`, the correct public `BETTER_AUTH_URL`, and a production `DATABASE_URL` in the target environment.
- Set `RESEND_API_KEY` and a verified `FROM_EMAIL` sender. Without the key, emails go to Mailpit and reach nobody.
- Recommended: turn Turnstile on in production by setting `TURNSTILE_SITE_KEY` and `TURNSTILE_SECRET_KEY` as normal runtime variables on the server where you deploy (Vercel, Docker on a VPS, or any other host). The build does not need them; restart to apply changes. See [Cloudflare Turnstile](02-turnstile.md).
- Add every serving hostname, or a parent hostname that covers its subdomains, to the Turnstile widget.
- Set OAuth callback URLs to the deployed `BETTER_AUTH_URL` if social sign-in is enabled. Set the provider's client ID and secret as runtime variables; the buttons follow them after a restart.
- Choose avatar storage for production: set `STORAGE_DRIVER=s3` and configure its bucket, keys, and public URL, or use Local only when the server has persistent writable disk. See [File storage](05-file-storage.md).
- Use a deliberate admin email and secure seed password, or save the one-time generated password and change it after the first login.
- Keep `.env`, `.env.local`, and all secret values out of version control and image build arguments.

When changing storage engines, run `bun run storage:migrate` first to preview, then `bun run storage:migrate --apply` to move existing avatars.

---

← [Project docs](../README.md) · [English index](README.md) · [Next: Environment variables →](01-environment-variables.md)
