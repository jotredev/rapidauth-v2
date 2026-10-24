# RapidAuth Docker

Compose offers a production-image mode for using the app and a development mode with the source mounted. For setup, daily use, troubleshooting, and production instructions, see the [English guide](../docs/en/03-docker.md) or the [guía en español](../docs/es/03-docker.md).

Docker reads its settings only from `docker/.env` (optional; copy `docker/.env.example`), never from the root `.env`. Run the production mode with `cd docker && docker compose up --build`. Files:

- `docker/compose.yaml`: sets the project name `rapidauth` and includes the service files below.
- `docker/compose.dev.yaml`: includes the development app with the same project name; run it from the project root with `bun run docker:dev`.
- `db.yaml`: the `db` service (PostgreSQL) and its data volume.
- `mail.yaml`: the `mailpit` service (local inbox at `127.0.0.1:8025`).
- `app.yaml`: the production `app` and one-shot `migrate` service.
- `app.dev.yaml`: the development `app` and its source and dependency volumes, included by `compose.dev.yaml`.
- `cron.yaml`: the optional `cron` service that runs daily cleanup when `CRON_SECRET` is configured.
