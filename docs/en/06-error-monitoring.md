# Error monitoring with Sentry

Sentry collects unexpected application errors so maintainers can see failures that users cannot diagnose. It is optional in RapidAuth. Without a valid `NEXT_PUBLIC_SENTRY_DSN`, Sentry is not initialized, makes no requests, and does not affect the build.

## 1. Create the Sentry project

1. Create an account at [sentry.io](https://sentry.io/signup/).
2. Create a project and choose **Next.js** as the platform.
3. Open **Project Settings → Client Keys (DSN)**.
4. Copy the DSN. It looks like `https://public-key@o0.ingest.sentry.io/project-id`. The DSN is public by design; it tells the SDK where to send events.

## 2. Configure RapidAuth

The guided option is the easiest:

```sh
bun run setup:sentry
```

The full `bun run init:setup` wizard offers the same optional step and skips it by default. If values already exist, the wizard lets you keep them, change them, or disable Sentry.

For manual setup, add the DSN to `.env`:

```dotenv
NEXT_PUBLIC_SENTRY_DSN="https://public-key@o0.ingest.sentry.io/project-id"
SENTRY_TRACES_SAMPLE_RATE="0"
```

The DSN activates both server and browser reporting. `0` keeps performance monitoring off so only errors are sent. Restart development or rebuild after changing a `NEXT_PUBLIC_*` value.

## 3. Optional source maps

Source maps turn minified production stacks into readable source locations. In Sentry, copy the organization and project slugs from their Settings pages. Then open **Organization Settings → Developer Settings → Auth Tokens** and create a token with only `org:read` and `project:releases`.

```dotenv
SENTRY_ORG="your-organization"
SENTRY_PROJECT="your-project"
SENTRY_AUTH_TOKEN="sntrys_replace_with_your_token"
```

All three values must be present during `next build`; otherwise RapidAuth silently skips the upload. `SENTRY_AUTH_TOKEN` is secret and build-only. Never prefix it with `NEXT_PUBLIC_`, print it, or commit it.

## 4. Vercel

In **Project Settings → Environment Variables**, add `NEXT_PUBLIC_SENTRY_DSN` to every environment where reporting should run. Add `SENTRY_ORG`, `SENTRY_PROJECT`, and the secret `SENTRY_AUTH_TOKEN` to build environments only when you want source maps. Set `SENTRY_TRACES_SAMPLE_RATE=0` unless performance tracing is intentional. Redeploy after changing the DSN.

## 5. Docker

Pass the public DSN as `NEXT_PUBLIC_SENTRY_DSN` during the image build because the browser bundle embeds it. If source maps are enabled, pass the organization and project as build arguments and mount the token as the `sentry_auth_token` BuildKit secret. Also provide the DSN and sample rate to the running container for server reporting. See the complete commands in [Docker](03-docker.md).

## 6. Verify the integration

Run the application, trigger an unexpected error in a development or staging workflow, and open **Issues** in the Sentry project. The event should include an `area` tag when it came from a caught application error.

For a one-time manual check, temporarily call `reportError(new Error('Sentry setup check'), { area: 'sentry.setup-check' })` from a server-side code path you can execute, reload that path, confirm the issue, and remove the temporary call. Never put credentials or personal data in the test error.

## Privacy and disabling

RapidAuth disables automatic collection of user information, cookies, headers, query parameters, HTTP bodies, local variables, database values, queues, GraphQL variables, and AI inputs/outputs. A shared filter also removes secret-looking keys at any depth, token-bearing URL parameters, and email addresses. Sentry user data is limited to an ID; names and email addresses are removed. Session Replay is not enabled.

To disable Sentry, run `bun run setup:sentry` and choose **Disable**, or remove all Sentry variables and rebuild. An empty or invalid DSN keeps both server and browser reporting off.

---

← [File storage](05-file-storage.md) · [English index](README.md) · [Dependency updates →](04-dependency-updates.md)
