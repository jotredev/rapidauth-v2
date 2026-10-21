# RapidAuth - Better Auth Boilerplate

A production-ready Next.js 16+ authentication boilerplate with Better Auth, designed for rapid application development.

![Next.js](https://img.shields.io/badge/Next.js-16.4.2-black?style=flat-square&logo=next.js)
![TypeScript](https://img.shields.io/badge/TypeScript-6.0.3-blue?style=flat-square&logo=typescript)
![Better Auth](https://img.shields.io/badge/Better_Auth-1.7.10-purple?style=flat-square)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-4.x-38B2AC?style=flat-square&logo=tailwind-css)
![Prisma](https://img.shields.io/badge/Prisma-7.10.1-2D3748?style=flat-square&logo=prisma)

## Features

### Authentication
- Email/Password authentication with strong password validation
- OAuth integration (Google & GitHub)
- Email verification with a 6-digit code sent via Resend
- Two-Factor Authentication (TOTP) with backup codes
- Password recovery with a 6-digit code
- Session management with IP & User Agent tracking

### Dashboard
- Admin user management (CRUD)
- Activity logging & monitoring
- Profile management
- Active sessions management
- Role-based access control (admin, moderator, user)

### Developer Experience
- Interactive setup wizard (`bun run init:setup`)
- TypeScript strict mode
- ESLint with zero warnings policy
- Husky git hooks
- shadcn/ui components

## Quick Start

[![CI](https://github.com/jotredev/rapidauth-v2/actions/workflows/ci.yml/badge.svg)](https://github.com/jotredev/rapidauth-v2/actions/workflows/ci.yml)

The project pins Bun to **1.4.2** in `package.json`; use that version locally and in Docker.

Choose **one** of these four ways to start. You do not need to follow the other setup paths.

| Option | What must be installed | Database | Main command |
| --- | --- | --- | --- |
| Setup wizard | [Bun](https://bun.sh/); Docker engine only for its local database option | External PostgreSQL or local PostgreSQL in Docker | `bun run init:setup` |
| Manual setup | [Bun](https://bun.sh/) | External PostgreSQL, such as [Neon](https://neon.tech) | `bun dev` after following the manual guide |
| Docker | A Docker engine with Compose v2 and Buildx | Local PostgreSQL, created by Compose | `docker compose -f docker/compose.yaml up --build` |
| Docker for the database only | [Bun](https://bun.sh/) and a Docker engine | Local PostgreSQL in Docker; no external database | `docker compose -f docker/compose.yaml up -d db`, then `bun dev` |

### Option 1: Setup wizard

**Requirements:** Bun. Choose an external PostgreSQL database or let the wizard run local PostgreSQL in Docker; the local option also requires a Docker engine. Create a [Resend](https://resend.com) account for email delivery; OAuth credentials are optional.

```bash
# Clone the repository
git clone https://github.com/yourusername/rapidauth-better-auth.git
cd rapidauth-better-auth

# Install dependencies
bun install

# Run the interactive setup wizard
bun run init:setup
```

The setup wizard will guide you through:
1. Database connection (external PostgreSQL or a local Docker database)
2. Better Auth configuration
3. Email service setup
4. Cloudflare Turnstile
5. OAuth providers (optional)
6. Database setup and admin user creation
7. Optional auth theme selection

You can run `bun run init:setup` again later. It offers the sections to update; only the selected section is changed in `.env` (or choose **Everything** to revisit all sections).

### Option 2: Manual setup

**Requirements:** Bun and access to an external PostgreSQL database. Create a [Resend](https://resend.com) account for email delivery; OAuth credentials are optional.

To configure each step yourself, follow the [English manual setup guide](docs/en/00-manual-setup.md) or the [guía de setup manual en español](docs/es/00-manual-setup.md). Start the app with `bun dev` after completing that guide.

### Option 3: Docker

**Requirements:** A Docker engine with Compose v2 and Buildx, such as Docker Desktop, OrbStack, Colima, or Docker Engine. You do not need Bun or PostgreSQL installed on your computer. Compose creates the local database, applies the schema, and seeds the admin account when it starts; you do not need to run `bun run init:setup`.

A `.env` file created by `bun run init:setup` also works with Docker. Compose supplies the local database URL and local app URL when starting the container. To start the app and database, follow the [English Docker guide](docs/en/03-docker.md) or the [guía de Docker en español](docs/es/03-docker.md).

### Option 4: Docker for the database only

**Requirements:** Bun and a Docker engine. You do not need an external database. Docker runs PostgreSQL while `bun dev` runs the app directly on your computer. Next.js recommends this approach for development on macOS and Windows because it is faster than mounting the app code into Docker. Follow the [English Docker guide](docs/en/03-docker.md#run-the-app-on-your-computer-and-only-postgresql-in-docker) or the [guía en español](docs/es/03-docker.md#ejecuta-la-app-en-tu-computadora-y-solo-postgresql-en-docker).

Browse all guides from the [documentation index](docs/README.md).

### Admin Account

The setup seed prints a randomly generated admin password once. Save it and change it after your first login. Set `SEED_ADMIN_EMAIL` and `SEED_ADMIN_PASSWORD` to customize the seed credentials; a configured password must be at least 8 characters. If the admin already exists, the seed keeps its current password. To reset it, run `bun run scripts/reset-password.ts [email]` (defaults to `admin@admin.com`); the new password is printed once.

### Themes and template maintenance

Themes can change authentication pages, the landing page, shared UI, layout, and styles. They never include or replace the dashboard. A v2 `theme.json` must declare a compatible `coreVersion` such as `">=0.2.0"` (only `>=x.y.z`, at least `0.2.0`); RapidAuth rejects themes with a missing or incompatible core version before changing files. Aurora and Nexus need an update before they can be installed with this core version.

When you change the template's auth, landing, layout, style, or shared UI files, update Classic with `bun run theme:sync-classic`. Run `bun run theme:sync-classic --check` to see whether Classic is in sync; CI runs this check too.

The local pre-commit hook sets `RAPIDAUTH_SKIP_TURNSTILE_BUILD_CHECK=1` only for its compile check. This bypass is never for production, CI production builds, or hosting builds; those builds must validate real Turnstile keys.

### CI

The [GitHub Actions workflow](.github/workflows/ci.yml) has separate quality, production build, Turnstile guard, dependency audit, and Docker jobs. Reproduce quality locally with `bun run lint`, `bun run typecheck`, and `bun run theme:sync-classic --check`; run the audit with `bun audit --audit-level=high`. To exercise the build guard safely, use dummy database/auth values (the build does not connect to the database):

```sh
BUILD_ENV='DATABASE_URL=postgresql://build:build@127.0.0.1:5432/build?sslmode=disable BETTER_AUTH_URL=http://localhost:3000 BETTER_AUTH_SECRET=0000000000000000000000000000000000000000000000000000000000000000 NEXT_TELEMETRY_DISABLED=1'
env NEXT_PUBLIC_TURNSTILE_SITE_KEY= TURNSTILE_SECRET_KEY= $BUILD_ENV bun run build # expected to fail without Turnstile keys
env $BUILD_ENV NEXT_PUBLIC_TURNSTILE_SITE_KEY=1x00000000000000000000AA TURNSTILE_SECRET_KEY=1x0000000000000000000000AA bun run build # expected to fail with test keys
env $BUILD_ENV NEXT_PUBLIC_TURNSTILE_SITE_KEY=0x4AAAAAACIBfakeCIpublicsitekey0000000000 TURNSTILE_SECRET_KEY=0x4AAAAAACIBfakeCIsecretkey00000000000000000 bun run build # fake format-valid keys; expected to compile
```

Run the Docker job steps using the isolated project name and alternate ports shown in [the Docker guide](docs/en/03-docker.md). Production builds always validate Turnstile. The local pre-commit hook alone uses `RAPIDAUTH_SKIP_TURNSTILE_BUILD_CHECK=1` for a compile check; never set it in production.

## Tech Stack

| Category | Technology |
|----------|------------|
| Framework | Next.js 16.4.2 (App Router, Server Actions) |
| Language | TypeScript 6.0.3 |
| Auth | Better Auth 1.7.10 |
| Database | PostgreSQL + Prisma 7.10.1 |
| UI | shadcn/ui + Tailwind CSS 4.x |
| Forms | React Hook Form + Zod |
| Email | Resend + React Email |
| Runtime | Bun |

## Project Structure

```
rapidauth-better-auth/
├── app/                    # Next.js App Router
│   ├── api/auth/           # Better Auth API routes
│   ├── auth/               # Authentication pages
│   │   ├── login/
│   │   ├── register/
│   │   ├── forgot-password/
│   │   ├── reset-password/
│   │   ├── verify-email/
│   │   ├── accept-invite/
│   │   ├── accept-terms/
│   │   ├── change-password/
│   │   └── two-factor/
│   └── dashboard/          # Protected dashboard
│       ├── profile/
│       ├── activity/
│       ├── logs/           # Admin only
│       └── users/          # Admin only
├── actions/                # Server Actions
│   ├── auth/               # Auth actions
│   ├── dashboard.ts
│   ├── profile.ts
│   ├── sessions.ts
│   ├── activity.ts
│   └── users.ts            # Admin CRUD
├── components/
│   ├── auth/               # Auth components
│   ├── dashboard/          # Dashboard components
│   └── ui/                 # shadcn/ui
├── lib/
│   ├── auth.ts             # Better Auth config
│   ├── prisma.ts           # Prisma client
│   └── email.ts            # Email functions
├── prisma/
│   └── schema.prisma       # Database schema
├── validations/            # Zod schemas
├── scripts/
│   ├── setup.ts            # Setup wizard
│   └── seed.ts             # Database seed
└── middleware.ts           # Route protection
```

## Environment Variables

```bash
# Database
DATABASE_URL="postgresql://user:password@host:5432/database"

# Better Auth
BETTER_AUTH_SECRET="auto-generated"
BETTER_AUTH_URL="http://localhost:3000"
# BETTER_AUTH_URL is required; without it every auth request fails with a clear error.

# Email (Resend)
RESEND_API_KEY="re_xxxxxxxxxxxxx"
FROM_EMAIL="RapidAuth <noreply@yourdomain.com>"

# OAuth (Optional)
GOOGLE_CLIENT_ID=""
GOOGLE_CLIENT_SECRET=""
GITHUB_CLIENT_ID=""
GITHUB_CLIENT_SECRET=""
```

## Turnstile (Required in production)

Turnstile protects registration, verification code resends, and password reset code requests. `bun run init:setup` asks for the two keys and can use test keys for local development. Production builds require both real keys and fail if either is missing or a test key is used.

Setup guides: [English](docs/en/02-turnstile.md) · [Español](docs/es/02-turnstile.md).

Cloudflare's test keys work on `localhost` and development domains:

```bash
NEXT_PUBLIC_TURNSTILE_SITE_KEY="1x00000000000000000000AA"
TURNSTILE_SECRET_KEY="1x0000000000000000000000000000000AA"
```

- Always pass: site key `1x00000000000000000000AA`, secret `1x0000000000000000000000000000000AA`.
- Always fail: site key `2x00000000000000000000AB`, secret `2x0000000000000000000000000000000AA`.
- Duplicate-token response: secret `3x0000000000000000000000000000000AA`.

Test keys are only for local development. Create real keys in the Cloudflare dashboard for production; see the guides above.

## Available Scripts

```bash
# Development
bun dev                 # Start dev server (with lint & typecheck)
bun run build          # Production build
bun run start          # Start production server

# Code Quality
bun run lint           # ESLint (zero warnings)
bun run typecheck      # TypeScript check

# Database
bun run db:generate    # Generate Prisma Client
bun run db:push        # Push schema to database
bun run db:migrate     # Create migration
bun run db:studio      # Open Prisma Studio
bun run db:seed        # Seed database

# Setup
bun run init:setup     # Interactive setup wizard
```

## Database Schema

```prisma
model User {
  id               String    @id @default(cuid())
  name             String
  email            String    @unique
  emailVerified    Boolean   @default(false)
  image            String?
  role             String    @default("user")
  status           String    @default("active")
  twoFactorEnabled Boolean?  @default(false)

  sessions         Session[]
  accounts         Account[]
  twoFactors       TwoFactor[]
  activityLogs     ActivityLog[]
}

model Session {
  id        String   @id @default(cuid())
  expiresAt DateTime
  token     String   @unique
  ipAddress String?
  userAgent String?
  userId    String
  user      User     @relation(...)
}

model Account {
  id         String  @id @default(cuid())
  accountId  String
  providerId String  // google, github, credential
  password   String? // For email/password
  userId     String
  user       User    @relation(...)
}

model TwoFactor {
  id          String @id @default(cuid())
  secret      String
  backupCodes String
  userId      String
  user        User   @relation(...)
}

model ActivityLog {
  id        String   @id @default(cuid())
  userId    String
  action    String   // login, logout, register, etc.
  details   String?
  ipAddress String?
  userAgent String?
  createdAt DateTime @default(now())
  user      User     @relation(...)
}
```

## Authentication Flow

### Email/Password
1. User registers with email/password
2. A 6-digit verification code is sent via Resend (valid for 10 minutes, 5 attempts)
3. User enters the code at `/auth/verify-email` and is sent to the login page to sign in with their password (and 2FA, if enabled)
4. A new code can be requested every 60 seconds; signing in with an unverified email leads back to `/auth/verify-email`

### Password Recovery
1. User requests a code at `/auth/forgot-password`
2. A 6-digit reset code is sent via Resend (valid for 10 minutes, 5 attempts)
3. User enters the code and a new password at `/auth/reset-password`
4. User is sent to the login page to sign in with the new password

### OAuth
1. User clicks Google/GitHub button
2. Redirected to provider
3. Account linked/created automatically
4. User logged in

### Two-Factor Authentication
1. User enables 2FA in profile
2. QR code generated for authenticator app
3. Backup codes provided
4. On login, TOTP code required

## Route Protection

`proxy.ts` only makes an optimistic check: requests to `/dashboard/*` without a session cookie are redirected to `/auth/login`. The real session and role checks happen in layouts, pages and inside every server action.

| Route | Access |
|-------|--------|
| `/auth/login`, `/auth/register`, `/auth/forgot-password`, `/auth/reset-password` | Public (redirect to `/dashboard` if signed in) |
| `/dashboard/*` | Authenticated users |
| `/dashboard/users`, `/dashboard/logs` | Admins only (admins who sign in with a password must have 2FA enabled) |

## Server Actions

All mutations use Next.js Server Actions with consistent return types:

```typescript
type ActionResponse<T = void> = {
  response: 'success' | 'error';
  message: string;
  data?: T;
};
```

## Customization

### Adding OAuth Providers

Edit `lib/auth.ts`:

```typescript
socialProviders: {
  google: { ... },
  github: { ... },
  // Add more providers here
}
```

### Modifying Roles

Edit the User model and update:
- `prisma/schema.prisma`
- `validations/users.ts`
- `components/dashboard/users/`

### Email Templates

Edit templates in `emails/`:
- `verification-code-email.tsx` – email verification code
- `password-reset-code-email.tsx` – password reset code
- `invitation-email.tsx` – admin invitation link
- `security-notice-email.tsx` – security notices
- `account-deleted-email.tsx` – account deletion confirmation

## Deployment

### Before deploying

Set these required environment variables in the runtime environment of each deployment:

- `DATABASE_URL`
- `BETTER_AUTH_SECRET`
- `BETTER_AUTH_URL`
- `RESEND_API_KEY`
- `FROM_EMAIL`
- `NEXT_PUBLIC_TURNSTILE_SITE_KEY` (real Cloudflare key)
- `TURNSTILE_SECRET_KEY` (real Cloudflare key)

OAuth credentials are optional. Additionally, every environment running `next build` (production, staging, previews, and CI) needs real Turnstile keys during compilation; test keys make the build fail. `NEXT_PUBLIC_TURNSTILE_SITE_KEY` is embedded during compilation, so changing it requires a new build. For Docker, pass the public site key as `ARG`/`--build-arg` and mount `TURNSTILE_SECRET_KEY` as a BuildKit secret during the build; also provide the secret to the running container.

This applies across hosting providers, including Vercel, Netlify, Railway, Render, Coolify, Docker on a VPS, and any CI pipeline that runs the build. For example, Vercel variables are configured under **Project Settings → Environment Variables**; CI should provide both as secrets to the build step.

Every hostname serving the app must be covered by the widget's **Hostnames**. Cloudflare does not support `*` wildcards, but adding a hostname covers its subdomains. For example, `example.com` covers `staging.example.com`; adding only `app.example.com` does not cover its parent or sibling subdomains. Add unrelated hostnames individually or use separate widgets per environment. See [Cloudflare's hostname management guide](https://developers.cloudflare.com/turnstile/additional-configuration/hostname-management/).

### Example: Vercel

1. Push to GitHub
2. Import in Vercel
3. Add environment variables
4. Deploy

### Docker

Use the [Docker guide](docs/en/03-docker.md) for local development and production builds, or read the [guía en español](docs/es/03-docker.md). It covers BuildKit secrets and runtime environment variables.

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

MIT License.

## Author

**Jorge Trejo** - [@jotredev](https://github.com/jotredev)

---

Built with [Better Auth](https://better-auth.com), [Next.js](https://nextjs.org), and [shadcn/ui](https://ui.shadcn.com).
