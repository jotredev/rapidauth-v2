# RapidAuth Docker

Compose starts the local app and PostgreSQL database. For setup, daily use, troubleshooting, and production instructions, see the [English guide](../docs/en/03-docker.md) or the [guía en español](../docs/es/03-docker.md).

Run `docker compose` from the project root. Files:

- `compose.yaml` (project root): sets the project name `rapidauth` and includes the two files below.
- `docker/db.yaml`: the `db` service (PostgreSQL) and its data volume.
- `docker/app.dev.yaml`: the `app` service (development app) and its volumes.
