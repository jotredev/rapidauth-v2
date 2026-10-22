# Docker for beginners

This guide starts RapidAuth and its PostgreSQL database on your computer. You do not need Bun or PostgreSQL installed on your computer. Follow the steps in order.

## Docker in simple words

- An **image** is a packaged recipe for an application, like a boxed model kit.
- A **container** is a running copy made from that image, like the assembled model.
- A **volume** is a storage box that keeps data when you replace a container. The database uses a named volume.
- **Compose** is a list of containers and instructions that starts them together. Here it starts the app and database with one command.

## 1. Install and start a Docker engine

Docker needs an engine that runs containers, plus Compose version 2 and Buildx with BuildKit support.

- **macOS:** install [Docker Desktop](https://docs.docker.com/desktop/setup/install/mac-install/), [OrbStack](https://orbstack.dev/download), or [Colima](https://github.com/abiosoft/colima). Open Docker Desktop or OrbStack and wait until its engine is running. With Colima, start it in Terminal with `colima start`.
- **Windows:** install [Docker Desktop](https://docs.docker.com/desktop/setup/install/windows-install/) and enable its WSL 2 engine when prompted. Open Docker Desktop and wait until it says Docker is running.
- **Linux:** install [Docker Engine](https://docs.docker.com/engine/install/) and the [Docker Compose plugin](https://docs.docker.com/compose/install/linux/). Start the engine with `sudo systemctl start docker` if it is stopped.

Open Terminal or PowerShell in the project folder and check all three tools:

```sh
docker version
docker compose version
docker buildx version
```

`docker version` should show both a Client and a Server section. Each command should print a version. If the Server section is missing, the engine is not running. If Compose or Buildx is not found, install its plugin or update your Docker installation.

## 2. Prepare `.env`

Copy the example file from the project folder:

```sh
cp .env.example .env
```

In Windows PowerShell, use `Copy-Item .env.example .env`. Open `.env` in a text editor and set:

- `RESEND_API_KEY`: your Resend API key. Leave it empty in development: emails then go to the Mailpit inbox at [http://localhost:8025](http://localhost:8025), which `docker compose up` starts for you. With a key, emails go through Resend and Mailpit does not start.
- `FROM_EMAIL`: a sender accepted by Resend. Verify its domain in Resend to deliver real email.
- `BETTER_AUTH_SECRET`: replace the example with a unique secret. On macOS or Linux, generate one with `openssl rand -hex 32`.

Compose sets `DATABASE_URL` and `BETTER_AUTH_URL` for the app. OAuth values and Turnstile keys are optional: leave them empty, or use Cloudflare test keys for Turnstile; see [Cloudflare Turnstile](02-turnstile.md). Compose reports an error if `.env` is missing.

## 3. Start RapidAuth

Run this command from the project root. The first start downloads images and builds the development app, so it may take a few minutes:

```sh
docker compose up --build
```

You should see PostgreSQL become healthy, Prisma apply the schema with `db push`, the seed finish, and Next.js become ready on port 3000. The first seed creates `admin@admin.com` and prints its generated password in the app logs. Save it; the seed prints it only when it creates that account.

Open [http://localhost:3000](http://localhost:3000) and sign in with `admin@admin.com` and the password from the logs. Change the generated password after signing in.

To find the seed output later, open another terminal in the project root and run:

```sh
docker compose logs app
```

The password appears only in the logs from the run that created the admin. Keep those logs private.

If you create another project from this template, change `name: rapidauth` in the root `compose.yaml` to the new project name so it does not share containers or a database with this project.

The `bun run docker:up`, `bun run docker:logs`, `bun run docker:down`, and `bun run docker:reset` commands are optional shortcuts. They require Bun on the host; the Docker commands above do not.

## Run the app on your computer and only PostgreSQL in Docker

This is an alternative to running both services in Docker. It is often faster on macOS and Windows because Next.js recommends running the app directly on the host instead of mounting source code into a container.

You can also choose this database option in `bun run init:setup`. The wizard checks Docker, starts only the database, writes its local URL to `.env`, then applies the schema and seeds the admin as part of setup.

The database starts automatically when the Docker engine starts, unless you intentionally stopped it with `docker compose stop db`.

Start only the database in the background. This database-only command does not need a `.env` file:

```sh
docker compose up -d db
```

Set the local Docker database URL in `.env`:

```dotenv
DATABASE_URL="postgresql://rapidauth:rapidauth@localhost:5432/rapidauth?sslmode=disable"
```

If you changed `DB_PORT`, replace `5432` in the URL with that host port. `sslmode=disable` is only for this local Docker database. Never use it for a production database.

If `.env` does not exist, `bun dev` creates it with local values (random `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, and this Docker `DATABASE_URL`). `bun dev` starts the database and waits for it to become healthy before running lint and Next.js only when `DATABASE_URL` points to it: host `localhost`, `127.0.0.1` or `::1`, user, password and database `rapidauth`, and port `DB_PORT` (default `5432`). With any other URL, such as Neon, `bun dev` does not touch Docker.

## Switch databases (Neon ↔ Docker)

Run `bun run db:switch` to choose an external PostgreSQL database or the local Docker database. The wizard saves the previous URL as a comment in `.env`, then pushes the schema and seeds the new database. It does not copy records between databases.

To switch manually, edit `DATABASE_URL` in `.env`. Use the Docker URL above for local Docker PostgreSQL, or your provider's URL for an external database. Then run `bun run db:push` and `bun run db:seed`. Use `sslmode=disable` only for the local Docker database, never production.

Install dependencies with `bun install` if you have not already, then create the tables and admin and start the app on your computer:

```sh
bun run db:push
bun run db:seed
bun dev
```

This uses the same PostgreSQL database and named volume as the full Docker setup, so you can switch between the two modes without losing data. Do not run this mode and the full Docker app at the same time; both use host port 3000.

To stop PostgreSQL while keeping its data, run:

```sh
docker compose stop db
```

## 4. Work on the app

- Edit files on your computer. Compose mounts the project into the app container. Next.js reloads the app when it detects your edits.
- `DOCKER_DEV_POLLING` controls file polling. It defaults to `true` and checks for changes once per second, which helps Docker Desktop and other file-sharing engines notice edits. It uses a little extra CPU. On Linux with native Docker Engine, you can turn it off:

  ```sh
  DOCKER_DEV_POLLING=false docker compose up --build
  ```

  If you change this setting while the app is already running, recreate the app container for the new value to take effect.
- Messages such as `watch error ... NotFound` can appear while files are being replaced. They are harmless if the app reloads and continues running.
- To follow logs, run `docker compose logs -f` in another terminal.
- Press **Ctrl+C** to stop the attached command. The named database volume stays on disk. You can also stop the services with `docker compose down`.
- Start again with `docker compose up --build`. Code edits reload automatically. The app syncs dependencies only when `bun.lock` changes.
- After editing a Dockerfile or Compose settings, use `up --build` to rebuild the app image.

## 5. Change the host ports

The defaults are app `3000`, database `5432`, and Prisma Studio `5555`. Set a different host port before the Compose command. For example, on macOS or Linux:

```sh
APP_PORT=3001 docker compose up --build
```

In PowerShell, use `$env:APP_PORT = "3001"` and then run the Compose command. Open `http://localhost:3001`. The same settings are available as `DB_PORT` and `STUDIO_PORT`. The number on the right side of each mapping stays fixed inside the container. Compose also reads `APP_PORT`, `DB_PORT` and `STUDIO_PORT` from the `.env` file in the project root; a variable set in your shell takes priority.

## 6. View the database and use Prisma commands

Prisma Studio runs inside the app container, and Compose publishes its port. Keep the app stack running. In a second terminal, run:

```sh
docker compose exec app bunx prisma studio --port 5555 --browser none
```

Open [http://localhost:5555](http://localhost:5555). Prisma Studio's CLI has no hostname option, so Compose sets `HOST=0.0.0.0` on the app container. That makes Studio reachable through the published host port; do not add an unsupported hostname flag.

You can run the seed again while the app is running:

```sh
docker compose exec app bun run db:seed
```

The seed is safe to repeat; if the admin exists, it skips creating another one. To reset a user's password, run:

```sh
docker compose exec app bun run scripts/reset-password.ts admin@admin.com
```

The new password is printed once in the command output. These commands run Bun inside the container, so Bun is not required on your computer.

## 7. Remove the local database and start over

To stop the app and database and permanently erase their stored data, run:

```sh
docker compose down -v
```

**The `-v` option deletes the local database volume, including accounts and data.** The next `up --build` creates empty tables and a new admin account. Without `-v`, the database stays available for the next start.

## Common problems

### “Cannot connect to the Docker daemon”

The engine is stopped. Open Docker Desktop or OrbStack and wait until it is running. With Colima, run `colima start`. On Linux, run `sudo systemctl start docker`.

### A port is already in use

Choose another host port. For example, start the app on 3001 with `APP_PORT=3001 docker compose up --build`. Use `DB_PORT` for the database and `STUDIO_PORT` for Studio. In PowerShell, set the matching `$env:...` variable before running Compose.

### `.env` is missing or email fails

Copy `.env.example` to `.env`. Without `RESEND_API_KEY`, read the emails at [http://localhost:8025](http://localhost:8025). With a key, check that it is valid and `FROM_EMAIL` is allowed by your Resend account. Read app messages with `docker compose logs app`.

### Changes do not appear

Wait one second and refresh the browser. Confirm the edited files are inside the project folder. Keep `DOCKER_DEV_POLLING=true` for Docker Desktop. Restart the app with `docker compose restart app` if needed.

### A dependency or Docker file changed

Run `docker compose up --build`. This rebuilds the app image and keeps the database volume. Do not use `down -v` for a rebuild.

## Themes, Bun, and CI

The repository pins Bun to **1.4.2** in `package.json`. Themes never include or replace the dashboard. A v2 `theme.json` must declare a compatible `coreVersion`, such as `">=0.2.0"`; missing or incompatible versions are rejected before files are changed. Aurora and Nexus need an update for RapidAuth 0.2.0.

Template maintainers should run `bun run theme:sync-classic` after changing auth, landing, layout, styles, or shared UI files. Use `bun run theme:sync-classic --check` to list differences without writing; CI runs this check.

GitHub Actions checks lint, types, Classic sync, production compilation (which must pass without any Turnstile key), the support email check, high/critical dependency advisories, and development/production Docker behavior including exclusion of the Turnstile secret from the image. Run `bun run lint`, `bun run typecheck`, `bun run theme:sync-classic --check`, and `bun audit --audit-level=high` locally; this guide covers the Docker checks.

## Production with Docker

The production image is separate from the development Compose stack. It does not contain a database. Point it at a production PostgreSQL database and provide all runtime settings when you start it. The development Compose stack keeps local file storage inside the bind-mounted project folder.

For `STORAGE_DRIVER=local`, mount a persistent volume at `/app/storage` so uploaded files survive container replacement. For example, add `-v rapidauth_storage:/app/storage` to `docker run`, or add a named volume to the production Compose service. The image creates `/app/storage` writable by its `nextjs` user. For S3, no file volume is needed. See [File storage](05-file-storage.md).

The build needs no Turnstile or OAuth keys, and the image contains none. Provide `TURNSTILE_SITE_KEY` and `TURNSTILE_SECRET_KEY` (recommended in production), and any `GOOGLE_*` / `GITHUB_*` values, only when you start the container; the server reads them at startup, so changing them needs a container restart, not a new image. The build uses dummy `DATABASE_URL`, `BETTER_AUTH_URL`, and `BETTER_AUTH_SECRET` values only for module loading. It does not connect to a database, and the dummy values are not saved in the final image.

Sentry remains optional. `NEXT_PUBLIC_SENTRY_DSN` must be a build argument when browser reporting is enabled, and must also be present at runtime for server reporting. Source map uploads additionally use the non-secret `SENTRY_ORG` and `SENTRY_PROJECT` build arguments. Mount `SENTRY_AUTH_TOKEN` only as the optional BuildKit secret `sentry_auth_token`; never pass that token as `ARG` or `ENV`. If any source map value is missing, the upload is silently skipped and the build continues.

Build from the project root:

```sh
docker build \
  --build-arg NEXT_PUBLIC_SENTRY_DSN="$NEXT_PUBLIC_SENTRY_DSN" \
  --build-arg SENTRY_ORG="$SENTRY_ORG" \
  --build-arg SENTRY_PROJECT="$SENTRY_PROJECT" \
  --secret id=sentry_auth_token,env=SENTRY_AUTH_TOKEN \
  -t rapidauth .
```

Omit the four Sentry lines when Sentry is disabled. When error reporting is enabled without source maps, pass only `NEXT_PUBLIC_SENTRY_DSN` and omit the organization, project, and token lines.

For PowerShell, run the same command on one line. If Sentry is enabled, set `$env:NEXT_PUBLIC_SENTRY_DSN` and the optional source map variables, then add their matching `--build-arg` options plus `--secret id=sentry_auth_token,env=SENTRY_AUTH_TOKEN`.

Create a protected runtime file such as `.env.production` with your real production `DATABASE_URL`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `RESEND_API_KEY`, and `FROM_EMAIL`. To turn Turnstile on (recommended in production) also add `TURNSTILE_SITE_KEY` and `TURNSTILE_SECRET_KEY`; add the Google or GitHub client ID and secret pairs for social sign-in. If Sentry is enabled, also include `NEXT_PUBLIC_SENTRY_DSN` and `SENTRY_TRACES_SAMPLE_RATE`; the auth token is not needed at runtime. Then start the image:

```sh
docker run --env-file .env.production -p 3000:3000 rapidauth
```

The image runs as an unprivileged user. Docker checks `/api/auth/ok` for health. Never connect production to the local Compose database.

### Create production tables and the first admin with Docker

You can use the development image to apply the Prisma schema and seed an external database, without installing Bun on your computer. First make sure `.env` exists so Compose can build and start the app service. Replace the example URL with your real production connection string:

```sh
docker compose run --rm \
  -e DATABASE_URL="postgresql://USER:PASSWORD@HOST:5432/DATABASE?sslmode=verify-full" \
  app bunx prisma db push
```

Then create the admin:

```sh
docker compose run --rm \
  -e DATABASE_URL="postgresql://USER:PASSWORD@HOST:5432/DATABASE?sslmode=verify-full" \
  app bun run db:seed
```

**These commands point at the real database in `DATABASE_URL` and can change production data.** Check the host and database name carefully before running them. Save the generated admin password from the seed output. To reset that account later while the app is running with the production URL, use `docker compose exec -e DATABASE_URL="<production-url>" app bun run scripts/reset-password.ts admin@admin.com`.

---

← [Cloudflare Turnstile](02-turnstile.md) · [English index](README.md) · [Dependency updates →](04-dependency-updates.md) · [Project docs](../README.md)
