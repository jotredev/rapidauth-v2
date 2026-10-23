# Cloudflare Turnstile

Cloudflare Turnstile is optional in RapidAuth. It turns on only when both `NEXT_PUBLIC_TURNSTILE_SITE_KEY` and `TURNSTILE_SECRET_KEY` are set; with neither, it stays off and nothing fails. We recommend always turning it on in production, by setting both variables on the server where you deploy. Development can use the test keys below. The production build never needs the keys.

## Create a widget

1. Create a free account at [dash.cloudflare.com](https://dash.cloudflare.com/). You do not need to move your domain to Cloudflare.
2. Find **Turnstile** in the dashboard menu, or press **Cmd + K** on Mac / **Ctrl + K** on Windows and search for Turnstile.
3. Select **Add widget** and enter a name, such as `RapidAuth`.
4. Under **Hostnames**, add `localhost` and the hostnames from which the app will be served, without `https://` (for example, `example.com` or `app.example.com`). Cloudflare does not accept `*` wildcards. Adding a hostname also authorizes its subdomains: adding `example.com` covers `app.example.com` and `staging.example.com`; adding `app.example.com` does not cover `example.com` or sibling hostnames. Add each unrelated hostname, or create a separate widget for each environment. See [Cloudflare's hostname management guide](https://developers.cloudflare.com/turnstile/additional-configuration/hostname-management/).
5. Set **Widget Mode** to **Managed** and **Pre-clearance** to **No**.
6. Create the widget and copy its **Site Key** and **Secret Key**.

Set the keys in your environment:

```env
NEXT_PUBLIC_TURNSTILE_SITE_KEY="your-site-key"
TURNSTILE_SECRET_KEY="your-secret-key"
```

The site key is public: the server reads it and passes it to the page. The secret key must stay server-side. Both are normal runtime variables, read when the server starts; to change them, restart the server. No rebuild is needed.

## Production deployment

Set `NEXT_PUBLIC_TURNSTILE_SITE_KEY` and `TURNSTILE_SECRET_KEY` on the server where you deploy, as ordinary runtime environment variables. Vercel, Netlify, Railway, Render, Coolify, and Docker on a VPS are only examples; the same applies to any other host. The build, including staging, previews, and CI, does not need them.

For Docker, pass both variables only when you start the container (for example with `--env-file`). Nothing Turnstile-related goes into `docker build`. Follow the [Docker guide](03-docker.md#production-with-docker) for the commands.

For example, in Vercel add both variables under **Project Settings → Environment Variables** for each environment that should run Turnstile, then redeploy or restart so they take effect. In CI, you only need them if a test starts the app with Turnstile on.

The `bun run init:setup` wizard also asks for Turnstile keys and can save real or local test keys in `.env`.

## Cloudflare test keys

Test keys are for local development only. Do not use them in production; the server only logs a warning if you do, so they would not protect you.

| Site key | Secret key | Result |
| --- | --- | --- |
| `1x00000000000000000000AA` | `1x0000000000000000000000000000000AA` | Always approves |
| `2x00000000000000000000AB` | `2x0000000000000000000000000000000AA` | Always rejects |
| `1x00000000000000000000AA` | `3x0000000000000000000000000000000AA` | Always rejects with `timeout-or-duplicate` |

Other Cloudflare test site keys: `1x00000000000000000000BB`, `2x00000000000000000000BB`, and `3x00000000000000000000FF`. Cloudflare publishes the full [test key reference](https://developers.cloudflare.com/turnstile/troubleshooting/testing/).

## Check that it works

Start the app locally, open [`/auth/forgot-password`](http://localhost:3000/auth/forgot-password), and confirm the Turnstile widget shows a checkmark after verification.

## Troubleshooting

### “Invalid domain”

Make sure the hostname is listed on the widget exactly as the browser uses it. Enter only the hostname, without `https://`, a path, or a trailing slash. Add `localhost` for local development.

### “Captcha verification failed”

Confirm that the Site Key and Secret Key belong to the same widget and that the hostname is allowed. Test keys only work with their documented test combinations. Also check that the server action is receiving the widget token.

### The app will not start

The app stops if only one of the two Turnstile keys is set. Set both (or neither) in the server environment and restart. In production, set both real keys; test keys only produce a warning in the log.

### Turnstile is off and I want it on

Check the startup summary: it prints `Turnstile: off` unless both `NEXT_PUBLIC_TURNSTILE_SITE_KEY` and `TURNSTILE_SECRET_KEY` are set in the environment of the running server (not only at build time). Set both and restart.

---

← [Environment variables](01-environment-variables.md) · [English index](README.md) · [Next: Docker →](03-docker.md) · [Project docs →](../README.md)
