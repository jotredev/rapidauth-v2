# Dependency updates

RapidAuth keeps every direct dependency at an exact version in `package.json`. This makes installs predictable and ensures a dependency changes only in a reviewed update. Bun uses `bunfig.toml` (`[install] exact = true`), and Dependabot uses `versioning-strategy: increase` so its pull requests keep exact specifiers. A pull request is accepted only when CI is green, including the end-to-end tests.

## Review a Dependabot pull request

For each proposed update:

1. Read the release notes and linked changes for the package and every package in the group. Look for breaking changes, removed or renamed APIs, migration steps, security fixes, supported runtime versions, and changes to peer dependencies.
2. Confirm the new version is stable, supported by this project, and compatible with the other changed packages. Check the exact versions in `package.json` and the resolved changes in `bun.lock`.
3. Review the CI results and the generated diff. Accept the pull request only when the change is understood, every required CI job is green, and the checklist for its update stage is complete.
4. Close or defer it when it is a prerelease, violates a toolchain limit, needs a migration that is not included, breaks a check, or its behavior cannot be verified. Record the reason and revisit it in the relevant planned stage.

Dependabot groups minor and patch updates. A grouped pull request can be split when a package needs separate investigation.

## Large upgrades in stages

The October 2026 upgrade is the model: first minor and patch releases, then critical libraries such as Better Auth, then major releases, and finally shadcn components. Keep each stage isolated and finish its checklist before beginning the next one. For **every stage**, require all of these checks:

- [ ] CI is green, including lint, exact dependency versions, type checking, production build, dependency audit, theme synchronization, and Docker jobs.
- [ ] Sign in and sign out work with valid and invalid credentials.
- [ ] Password creation, change, and recovery work, including the verification steps used by those flows.
- [ ] Email verification with a 6-digit code and verification code resend work.
- [ ] Turnstile works on registration, verification code resend, and password recovery; invalid or missing tokens are rejected.
- [ ] Review the main pages visually against the previous version and inspect any changed areas.
- [ ] Build the production Docker image and run its health check or the project’s Docker smoke checks.

### Stage 1: minor and patch releases

Review Dependabot’s grouped updates and keep compatible minor and patch changes together. Split packages out when their release notes or CI results need individual investigation. Complete the full checklist above before accepting the stage.

### Stage 2: critical libraries such as Better Auth

Update one critical library at a time. Read its migration and security notes, verify the auth configuration and adapters, and exercise login, sessions, passwords, and email flows. Complete the full checklist above before accepting each library update.

**Stage 2 completed (October 18, 2026):** Better Auth is pinned to 1.7.10. Its coordinated runtime and adapter packages are also resolved to 1.7.10; `@better-auth/utils` remains at 0.5.0 because it follows an independent version line and has no 1.7.10 release. The 1.7 schema comparison required only the `verified`, `failedVerificationCount`, and `lockedUntil` fields on `twoFactor`; `account` remains unchanged from 1.6 and `rateLimit` retains `id`, `key`, `count`, and `lastRequest`. The TypeScript, ESLint, and Node.js limits below remain in force, and dependencies remain pinned to exact versions.

#### Update an existing installation to Better Auth 1.7

For **each environment** (development, staging, and production), run `bun run db:deploy` to apply the migrations and add `verified`, `failedVerificationCount`, and `lockedUntil` to `twoFactor`, then run `bun run db:seed` to normalize legacy password accounts. Without this step, an admin created by an older seed cannot sign in with Better Auth 1.7. The seed is safe to repeat and does not delete data.

### Stage 3: major releases

Upgrade one major package or a tightly coupled package set at a time. Follow its migration guide, update project code and configuration, and check peer dependency requirements. Complete the full checklist above before accepting each major upgrade.

**Stage 3 completed (October 18, 2026):** TypeScript is pinned to 6.0.3 with `typescript-eslint` 8.71.2 as a direct development dependency, so `eslint-config-next` and every `@typescript-eslint/*` package resolve to that same version without overrides. TypeScript stays on 6.0.x because `typescript-eslint` requires TypeScript `<6.1.0`. TypeScript 7 remains pending until `typescript-eslint` supports it. `dotenv` is pinned to 18.0.8, React Email to 6.11.3, and Recharts to 3.10.1. React Email components and rendering now come from `react-email`, which is a production dependency because the app renders emails with it at runtime; its preview server is not included in the production build. Also, `bun run email:preview` opens the templates at `http://localhost:3200`.

### Stage 4: shadcn components

Use the project's pinned local shadcn CLI 4.22.0 to update or add components, for example `bunx shadcn add button`. `components.json` uses `radix-vega`: the old `default` style is frozen, while `radix-vega` keeps the Radix primitive family and provides the current shadcn component set. Changing the style does not require changing the project's colors or fonts.

**Stage 4 completed (October 18, 2026):** All 46 existing UI components were regenerated in `radix-vega`, and these 14 components were added: `attachment`, `bubble`, `button-group`, `direction`, `empty`, `field`, `item`, `kbd`, `marker`, `message`, `native-select`, `resizable`, `spinner`, and `trace`. The shared primitive dependency is pinned exactly as `radix-ui` 1.8.1; individual `@radix-ui/react-*` dependencies are removed when no repository source imports them. The existing `react-resizable-panels` dependency is reused.

The CLI currently imports `cn` from the standalone `cn` package and adds that dependency, although this project keeps its `cn` helper built on `clsx` and `tailwind-merge` in `@/lib/utils`. The `components.json` schema supports a `utils` alias but has no option to choose the package used for the `cn` import. All generated imports therefore use `@/lib/utils`, and ESLint rejects imports from `cn` with a message pointing to the local helper. The CLI also changed Recharts to 3.8.0, so it was restored to the project's pinned 3.10.1, and its duplicate `hooks/use-mobile.ts` was removed in favor of the existing `.tsx` hook.

The following components were deliberately excluded: `combobox` (it adds `@base-ui/react`, which is a different primitive family), `code-block` (it adds `shiki`), `message-scroller`, and `questionnaire` (both add `@shadcn/react`). The registration form's terms checkbox contrast and the spacing around its Terms of Service and Privacy Policy links are checked in both themes after the migration.

Review the generated diff against local customizations and restore or merge those customizations deliberately; do not replace customized components blindly. Run `bun run theme:sync-classic` to copy shared UI changes into the Classic theme, inspect the result, and run `bun run theme:sync-classic --check`. Complete the full checklist above before accepting the component updates.

## Toolchain limits

- **TypeScript:** stay on 6.0.x while `typescript-eslint` requires TypeScript `<6.1.0`. TypeScript 7 remains pending until `typescript-eslint` supports it. Check the installed tooling’s peer dependency range before selecting an update.
- **ESLint:** stay on version 9. The `eslint-plugin-react` version included by `eslint-config-next` currently supports ESLint 9, so review that compatibility before moving to a newer major.
- **Node.js:** use an active LTS release. Dependabot major updates for Node are ignored so the project can move deliberately to the next LTS.

To move Node to the next LTS, update the Node base image in every stage of `Dockerfile` and in `docker/Dockerfile.dev`, update `@types/node` to the matching major, and check any Node version declarations used by CI or project configuration. Keep `packageManager` in `package.json` aligned if the Bun version is also being changed; it identifies Bun in this project, not Node. CI reads the Bun version from `package.json`. Rebuild and validate both development and production Docker images and complete the full checklist above. Update the Dependabot Node exclusions only if the project intentionally changes its manual LTS upgrade policy.

## Add or update a dependency

Add a dependency with its complete exact version, such as `bun add package@1.2.3`, or omit the version with `bun add package`. Do not use incomplete versions such as `bun add package@7`, which Bun stores as a range. `bunfig.toml` makes exact installs the default and `bun run deps:check` verifies every direct dependency. For a deliberate upgrade, change to the selected exact version, run `bun install`, and review that `bun.lock` changes only as expected. Follow the applicable stage and full checklist above. Keep `bun install --frozen-lockfile` passing so CI installs the committed resolution without changing it.

## Preview email templates

Run `bun run email:preview` to open the templates from `emails/` at `http://localhost:3200`. The preview server uses a port separate from the app.
