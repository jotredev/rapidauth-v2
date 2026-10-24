# Docker

RapidAuth has two Docker modes. **Use the app** with the production image and one command, or **develop in Docker** with the source folder mounted for live reload. Both modes start PostgreSQL. Mailpit starts when `RESEND_API_KEY` is empty; with a key, the app sends through Resend and Mailpit stays stopped.

## Requirements

Install Docker Engine or Docker Desktop with Docker Compose v2 and Buildx. From a terminal in the project folder, confirm Docker is running:

```sh
docker version
docker compose version
docker buildx version
```

## Use the app

A `.env` file is optional. With no file, Compose supplies local defaults and uses the published `ghcr.io/jotredev/rapidauth-v2:2.3.0` image. If that image is unavailable, Compose builds it from the root `Dockerfile`:

```sh
docker compose up
```

The image version is set in `docker/app.yaml`. To use a newer release, change its image tag to the release version (for example, `2.4.0`) and run `docker compose up`. To build the app locally instead, run `docker compose up --build`.

To publish a release, create and push a version tag such as `2.4.0`. GitHub Actions builds the root `Dockerfile` and publishes both `2.4.0` and `2` to GitHub Container Registry. After the first publication, make the `rapidauth-v2` package public in GitHub Packages so Compose can pull it without authentication.

Open [http://localhost:3000](http://localhost:3000). On a new database, use the first-run screen to create the first administrator, then sign in to the dashboard. The setup screen is available for 15 minutes after the app starts.

The first start pulls the app image (or builds it locally if it is unavailable) and applies versioned Prisma migrations before the app starts. Compose then keeps the app, database, and Mailpit running in the terminal. Press **Ctrl+C** to stop them. Start again with `docker compose up`.

The defaults are for local use:

- `BETTER_AUTH_URL=http://localhost:3000`
- A clearly marked example `BETTER_AUTH_SECRET`
- `SUPPORT_EMAIL=support@example.invalid`
- PostgreSQL at the `db` service
- Emails go to Mailpit at [http://localhost:8025](http://localhost:8025)

The example secret is accepted only for a localhost URL. If you set a public `BETTER_AUTH_URL` while keeping the example secret, the app stops and prints instructions to create a real secret with `openssl rand -hex 32`.

You do not need to copy `.env.example`. If you create a root `.env`, its values replace the Compose defaults. Both the migration service and app always use the Compose `db` service; `DATABASE_URL` from `.env` is ignored. For a production deployment, set at least a unique `BETTER_AUTH_SECRET`, the public `BETTER_AUTH_URL`, and `SUPPORT_EMAIL`. Add `RESEND_API_KEY` and a verified `FROM_EMAIL` to deliver real email. Without a Resend key, email is captured by Mailpit and its inbox starts at port 8025; with a key, Mailpit stays stopped. Add `CRON_SECRET` to enable daily scheduled cleanup; without the secret, the cron container stays stopped. See [Scheduled cleanup](07-scheduled-cleanup.md).

To enable Sentry, set `NEXT_PUBLIC_SENTRY_DSN` in the root `.env` and restart the app container. The running server provides the public DSN to the browser; no image rebuild is needed. `SENTRY_ORG`, `SENTRY_PROJECT`, and `SENTRY_AUTH_TOKEN` are only needed at build time to upload source maps. The token is mounted as a BuildKit secret, never passed as a build argument. See [Error monitoring](06-error-monitoring.md).

Only the app is published on `127.0.0.1:3000`. PostgreSQL and Mailpit also bind to `127.0.0.1`; Mailpit's web inbox is at port 8025 and its SMTP port is 1025. To deploy on a VPS with Caddy, automatic HTTPS, and daily database backups, follow [Deploy to a VPS](08-deploy-to-a-vps.md).

The database and uploaded avatars survive container replacement and `docker compose down`. To remove all saved data too, run `docker compose down -v`.

## Develop in Docker

For live source edits in a container, use:

```sh
bun run docker:dev
```

This mode needs Bun on the host. It mounts the project into the container and runs Next.js in development mode. The root `.env` is optional; when present, its values are used. The app is at [http://localhost:3000](http://localhost:3000), and Mailpit is at [http://localhost:8025](http://localhost:8025).

Stop the development stack with **Ctrl+C**. To remove its containers while keeping data, run:

```sh
docker compose -f compose.dev.yaml down
```

Both modes keep PostgreSQL data in a named volume. The production mode also keeps local avatars in a named volume mounted at `/app/storage`. Do not use `down -v` unless you intend to delete the database and saved avatars.

## Troubleshooting

- **Port 3000 is already in use:** stop the other app using that port before starting RapidAuth.
- **The app does not start:** inspect its logs with `docker compose logs app migrate db mailpit`. The app waits for a healthy database and Mailpit, and for migrations to finish successfully.
- **Emails are missing:** without `RESEND_API_KEY`, open Mailpit at [http://localhost:8025](http://localhost:8025). With a key, check your Resend settings and verified sender.
- **Data disappeared:** `docker compose down -v` removes named volumes. Start again and create a new admin.

---

← [Turnstile](02-turnstile.md) · [Documentation index](README.md) · [Dependency updates →](04-dependency-updates.md) · [Project docs](../README.md)
