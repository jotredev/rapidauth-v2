# English documentation

Choose one starting path in the [Quick Start](../README.md#quick-start): setup wizard, manual setup, or Docker. These are alternatives, not steps to complete in sequence. The environment-variable and Turnstile guides are references you can use with any path.

1. [Manual setup](00-manual-setup.md) — install RapidAuth without the setup wizard, configure services, prepare the database and admin account, and run the app.
2. [Environment variables](01-environment-variables.md) — reference for every environment variable, its purpose, source, required environments, and handling notes.
3. [Cloudflare Turnstile](02-turnstile.md) — create a widget, use test keys locally, and turn it on in production with runtime variables.
4. [Docker](03-docker.md) — install Docker, run the app and database locally, and build a production image.
5. [File storage](05-file-storage.md) — choose local or S3-compatible storage for avatars and migrate between providers.
6. [Error monitoring](06-error-monitoring.md) — optionally connect Sentry, upload source maps, verify reporting, and understand the privacy filters.
7. [Scheduled cleanup and trusted client IPs](07-scheduled-cleanup.md) — enable daily cleanup on Vercel or GitHub Actions and configure safe proxy headers.
8. [Dependency updates](04-dependency-updates.md) — review Dependabot, upgrade dependencies in tested stages, and follow toolchain limits.
