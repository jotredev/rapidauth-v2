# RapidAuth Docker

Compose offers a production-image mode for using the app and a development mode with the source mounted. For setup, daily use, troubleshooting, and production instructions, see the [English guide](../docs/en/03-docker.md) or the [guía en español](../docs/es/03-docker.md).

Run the production mode with `docker compose up --build` from the project root. Files:

- `compose.yaml` (project root): sets the project name `rapidauth` and includes the service files below.
- `compose.dev.yaml` (project root): includes the development app with the same project name, so Compose reads the root `.env`.
- `docker/db.yaml`: the `db` service (PostgreSQL) and its data volume.
- `docker/mail.yaml`: the `mailpit` service (local inbox at `127.0.0.1:8025`).
- `docker/app.yaml`: the production `app` and one-shot `migrate` service.
- `docker/app.dev.yaml`: the development `app` and its source and dependency volumes, included by `compose.dev.yaml` and started with `bun run docker:dev`.
- `docker/cron.yaml`: the optional `cron` service that runs daily cleanup when `CRON_SECRET` is configured.
