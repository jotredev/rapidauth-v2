# Deploy to a VPS

This guide runs the production Compose stack on one Linux VPS. It assumes you have never used Docker; follow the steps in order. Compose runs the app, PostgreSQL, Caddy, and daily database backups.

## What you need

- A VPS with a current Ubuntu LTS release and a public IPv4 address.
- A domain name that you control.
- A terminal on your computer and an SSH account on the VPS.

## 1. Point your domain to the VPS

At your DNS provider, create an `A` record for your domain (for example, `auth.example.com`) pointing to the VPS IPv4 address. Add an `AAAA` record only if the VPS has working public IPv6. DNS can take time to update.

## 2. Allow only the required firewall ports

In the VPS provider's firewall, allow SSH on port 22 and web traffic on ports 80 and 443. Caddy uses TCP for HTTP/HTTPS and UDP 443 for HTTP/3. Do not open PostgreSQL (5432) or the app port (3000) to the internet.

If you use Ubuntu's UFW firewall, connect over SSH first, then run:

```sh
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw allow 443/udp
sudo ufw enable
sudo ufw status
```

Keep your current SSH session open while enabling the firewall and confirm that port 22 is allowed.

## 3. Install Docker and Bun

Install Docker Engine and the Compose plugin by following Docker's [official Ubuntu instructions](https://docs.docker.com/engine/install/ubuntu/). Check that both commands work:

```sh
docker version
docker compose version
```

Install Bun using the [official Bun instructions](https://bun.sh/docs/installation). Bun is only used to run the production setup wizard; the app itself runs in Docker.

## 4. Configure RapidAuth

Clone the repository and install its pinned dependencies:

```sh
git clone https://github.com/jotredev/rapidauth-v2.git
cd rapidauth-v2
bun install
```

Run the production setup:

```sh
bun run setup:prod
```

Answer **yes** to “Are you deploying with Docker Compose? (y/n)” and enter your public HTTPS address, such as `https://auth.example.com`. The wizard creates a Better Auth secret and saves settings in `.env`. Compose supplies the database connection itself, so you do not need to enter `DATABASE_URL`. Keep `.env` private. When setup asks for the trusted proxy, choose **Own proxy** (option 4, `TRUSTED_PROXY=proxy`) so the app uses the client IP set by Caddy. The existing production checks still require a Resend key and verified sender for email.

## 5. Start the VPS stack

Validate the Compose files, then start the app, HTTPS proxy, and backup service:

```sh
docker compose --profile vps config --quiet
docker compose --profile vps up -d
```

The first start downloads the app and Caddy images, creates PostgreSQL, applies pending migrations, and starts the app. Caddy listens on ports 80 and 443 and proxies requests to the app. With public DNS already pointing to the VPS and both ports reachable, Caddy obtains and renews a publicly trusted HTTPS certificate automatically.

Check the services and logs:

```sh
docker compose --profile vps ps
docker compose --profile vps logs -f app caddy
```

Open your HTTPS domain and create the first administrator. Use `Ctrl+C` to stop following logs; it does not stop the services.

For a local certificate check, set `BETTER_AUTH_URL=https://localhost` in `.env` and start the profile. Caddy creates a certificate from its own local authority. Browsers will show it as untrusted until that authority is installed on the computer; use a real public domain for a trusted certificate.

## 6. Update RapidAuth

Choose the release version in `docker/app.yaml` (the `image` line), then pull and recreate the containers:

```sh
docker compose --profile vps pull
docker compose --profile vps up -d
```

Compose runs pending Prisma migrations before starting the updated app. Keep the `postgres_data`, `app_storage`, `caddy_data`, `caddy_config`, and `db_backups` volumes; they hold your database, uploads, HTTPS state, and backups.

## 7. Restore a database backup

The backup container writes one compressed SQL dump immediately when it starts, then every day at 02:00 UTC. It keeps the most recent seven days in the `db_backups` volume.

Copy the selected backup to a temporary file, then stop the app and backup scheduler. Replace the current database with an empty one and restore the dump (replace the filename with one shown by the first command):

```sh
docker compose --profile vps exec backup ls -lh /backups
docker compose --profile vps exec -T backup sh -c 'cat "/backups/$1"' sh rapidauth-YYYYMMDDTHHMMSSZ.sql.gz > /tmp/rapidauth-restore.sql.gz
docker compose --profile vps stop app backup
docker compose --profile vps exec db dropdb -U rapidauth --if-exists rapidauth
docker compose --profile vps exec db createdb -U rapidauth -O rapidauth rapidauth
gunzip -c /tmp/rapidauth-restore.sql.gz | docker compose --profile vps exec -T db psql -U rapidauth -d rapidauth
docker compose --profile vps up -d app backup
rm /tmp/rapidauth-restore.sql.gz
```

Replace the example filename with one listed under `/backups`. Run the commands from the repository folder. Dropping the database permanently deletes its current contents; verify the backup filename before running the commands.

## 8. Copy backups off the VPS

Keep a second copy somewhere other than the VPS. To copy a backup to your computer, run this from the repository folder on the VPS:

```sh
docker compose --profile vps exec -T backup sh -c 'cat /backups/rapidauth-YYYYMMDDTHHMMSSZ.sql.gz' > rapidauth-backup.sql.gz
```

Then, from a terminal on your computer, download it with:

```sh
scp user@your-vps-ip:/path/to/rapidauth-v2/rapidauth-backup.sql.gz .
```

Replace `user`, the VPS address, and the repository path with your SSH details. Store the downloaded file somewhere separate and private.

## Deploy with Coolify

[Coolify](https://github.com/coollabsio/coolify) is a self-hosted deployment platform for apps and databases, licensed under Apache-2.0. Install it on a VPS and connect your Git repository.

Create a Docker Compose application from this repository, use the repository root as the base directory, and select `compose.yaml`. Coolify supplies its own HTTPS proxy, so do not start the `caddy` service on the same ports. Set the custom start command to:

```sh
docker compose --profile vps up -d app backup
```

This starts the app and backup service with their database dependencies while leaving Caddy stopped. Add your domain in Coolify for the `app` service on port `3000`, then set `BETTER_AUTH_URL` to that public HTTPS URL and add the other production values required by `setup:prod`. Deploy and check Coolify's deployment and runtime logs. Follow the same backup and restore instructions above; the backups remain in the `db_backups` volume on the server.

---

← [Docker](03-docker.md) · [Documentation index](README.md) · [File storage →](05-file-storage.md) · [Project docs](../README.md)
