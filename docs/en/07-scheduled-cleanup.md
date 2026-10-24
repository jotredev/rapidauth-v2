# Scheduled cleanup and trusted client IPs

RapidAuth includes an optional daily maintenance route. It deletes, in bounded batches of 500 per type:

- rate-limit rows older than 24 hours;
- expired verification, password-reset, invitation, and OAuth-state records; and
- non-admin, non-pending accounts that are still unverified more than 7 days after registration.

Pending accounts created by an administrator are never deleted automatically. When `CRON_SECRET` is missing or shorter than 32 characters, the route returns HTTP 404 and the application otherwise works normally.

You can configure the secret interactively with `bun run setup:cleanup`.

## Path A: Vercel

1. In the Vercel dashboard, open the project, then **Settings → Environment Variables**.
2. Add `CRON_SECRET` as a secret production variable with at least 32 random characters and redeploy.

Nothing else is required. The root `vercel.json` already calls `/api/cron/cleanup` every day at 03:00 UTC. Vercel sends `Authorization: Bearer <CRON_SECRET>` automatically.

On Vercel's Hobby plan, cron jobs can run only once per day and may run at any point during the selected hour. Paid plans normally run within the selected minute.

## Path B: any other deployment

1. Add `CRON_SECRET` with at least 32 random characters to the server's environment and restart the application.
2. In the GitHub repository, open **Settings → Secrets and variables → Actions** and add repository secrets named `CRON_SECRET` and `APP_URL`. `APP_URL` is the public origin, for example `https://auth.example.com`.

The included `.github/workflows/scheduled-cleanup.yml` calls the route every day at 03:00 UTC. If either GitHub secret is absent, the workflow prints a configuration notice and succeeds without making a request.

## Path C: Docker

1. Add `CRON_SECRET` with at least 32 random characters to your root `.env` file (for Docker Compose, to `docker/.env`; or export it in your shell):

   ```env
   CRON_SECRET="your-secure-random-secret-at-least-32-characters"
   ```

2. Start the containers with `cd docker && docker compose up` (or `bun run docker:dev` for development).

When `CRON_SECRET` is present, Docker Compose automatically starts the minimal `cron` container (`docker/cron.yaml`). It calls `/api/cron/cleanup` once a day at 03:00 UTC using the required `Authorization: Bearer <CRON_SECRET>` header. Without `CRON_SECRET`, the container remains completely off (`scale: 0`).

## Test it manually

In Docker, you can run the cleanup on demand inside the running cron container:

```bash
cd docker
docker compose exec cron cleanup
```

In GitHub, open **Actions → Scheduled cleanup → Run workflow**. A successful run prints the JSON returned by the route.

You can also call it from a trusted terminal:

```bash
curl --fail --silent --show-error \
  --header "Authorization: Bearer ${CRON_SECRET}" \
  "http://localhost:3000/api/cron/cleanup"
```

The response contains counters only:

```json
{"rateLimits":0,"verifications":0,"unverifiedUsers":0,"operationalLogs":0}
```

Calling the route again is safe; already deleted rows are not counted again.

## Change the schedule

The expression `0 3 * * *` means minute `0`, hour `3`, every day of the month, every month, every day of the week. Cron schedules use UTC. Change the expression in both `vercel.json` and `.github/workflows/scheduled-cleanup.yml` so both deployment paths stay aligned.

## Configure `TRUSTED_PROXY`

Run `bun run setup:proxy`, or set one of these values in the server environment:

- `none` (default): trust no IP header. IP-based rate limits are disabled, while limits keyed by email or user continue to work.
- `vercel`: use Vercel's protected `X-Vercel-Forwarded-For` header.
- `cloudflare`: use `CF-Connecting-IP`. Configure the origin so it accepts traffic only from Cloudflare; otherwise a direct client can forge this header.
- `proxy`: use `X-Real-IP` from nginx or another reverse proxy you control. The origin must not be directly reachable by clients that can set this header themselves.

RapidAuth accepts the configured header only when its complete value is a valid IPv4 or IPv6 address. An unknown `TRUSTED_PROXY` value behaves as `none`. In production, `none` logs one startup warning so a missing proxy configuration is visible.
