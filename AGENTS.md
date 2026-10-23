# AGENTS.md - Project Rules & Guidelines

Instructions for any AI coding agent working in this repository (Claude Code, Codex, Cursor, OpenCode, Gemini, etc.).

## Project Overview

This is a **RapidAuth Boilerplate** - a Next.js 16+ application with Better Auth, designed for rapid application development with user management.

User documentation lives in `docs/` (index: `docs/README.md`). When adding or changing an environment variable, update `.env.example`, both `docs/en/01-environment-variables.md` and `docs/es/01-environment-variables.md`, and `scripts/setup.ts`.

### Tech Stack
- **Framework**: Next.js 16+ (App Router)
- **UI**: shadcn/ui + Tailwind CSS v4
- **Auth**: Better Auth
- **Database**: Neon Postgres + Prisma
- **Forms**: React Hook Form + Zod
- **Payments**: Stripe
- **Email**: Resend

## Skills

Project skills live in `.agents/skills/<name>/SKILL.md` (`.claude/skills/` symlinks to the same folders).

**CRITICAL: load the matching skill automatically based on context. DO NOT wait for the user to ask.** If your tool supports skills, invoke it by name; otherwise read its `SKILL.md` (and the rules or references it points to) before writing code.

| When you detect... | Skill |
|-------------------|-------|
| Creating/editing files in `actions/`, using `prisma.`, data fetching, mutations | `server-actions-patterns` |
| Database queries, schema changes, migrations | `prisma-expert` |
| Forms, `useActionState`, `formData`, validation | `react-hook-form-zod` |
| `auth.api.`, Better Auth, sessions, login, register, 2FA | `better-auth-best-practices` |
| Creating UI components, pages, layouts | `shadcn` + `frontend-design` |
| `<Button>`, `<Input>`, `<Card>`, any shadcn component | `shadcn` |
| Tailwind classes, styling, responsive design | `tailwind-design-system` |
| Colors, spacing, typography, UX decisions | `ui-ux-pro-max` |
| Neon, DATABASE_URL, connection pooling | `neon-postgres` |
| Stripe, payments, subscriptions, checkout | `stripe-best-practices` |
| Sending emails, Resend | `resend` |
| Animations, transitions, GSAP | `gsap` |
| Performance issues, optimization, React patterns | `vercel-react-best-practices` |
| Security questions, vulnerability reviews, audits, pen tests | `security-audit` |

### Examples

```
User: "Create a page to list products"
→ Load: `server-actions-patterns` + `shadcn`

User: "Add a contact form"
→ Load: `server-actions-patterns` + `react-hook-form-zod` + `shadcn`

User: "Fix the login"
→ Load: `better-auth-best-practices` + `server-actions-patterns`

User: "Query users from database"
→ Load: `server-actions-patterns` + `prisma-expert`
```

## Architecture Rules

### Server vs Client Components

1. **Pages (`app/**/page.tsx`)**: Always Server Components - call server actions here
2. **Layouts (`app/**/layout.tsx`)**: Server Components when possible
3. **UI Components**: Client Components only when needed (state, effects, events)
4. **Never pass functions as props** from Server to Client Components
5. **Icons**: Import Lucide icons inside Client Components, not in Server Components

### Data Flow Pattern
```
Server Component (page.tsx)
    ↓ calls server action
    ↓ passes serializable props
Client Component
    ↓ handles interactivity
    ↓ uses router.refresh() after mutations
```

## Security Rules

1. **Better Auth HTTP routes are closed by default**: `app/api/auth/[...all]/route.ts` only lets `/callback/<provider>`, `/error` and `/ok` through; everything else returns 404. All auth operations (sign up, sign in, 2FA, sessions, passwords) go through server actions that call `auth.api.*`. Do not use the Better Auth browser client (`better-auth/react`, `better-auth/client`) and do not widen the allowlist without a security review.
2. **`proxy.ts` is an optimistic check only**: it looks at the session cookie to redirect. The real session and role checks happen in layouts, pages and inside every server action.
3. **Every exported function in a `"use server"` file is a public endpoint**: check the session (and role, for admin actions) inside it. Internal helpers such as `logActivity` live in `lib/` without `"use server"`.
4. **Never send session tokens to the client**: manage sessions by ID.

## Server Actions

> **Always load the `server-actions-patterns` skill when working with server actions.**

The skill contains all rules for:
- File location (`actions/` folder)
- Try-catch patterns
- Return types (`{ success, data }` or `{ success, error }`)
- Form actions with `useActionState`
- Integration with pages and components

## Component Structure

```
components/
├── dashboard/
│   ├── index.ts              # Barrel exports - ALWAYS export new components here
│   ├── page-header.tsx       # Page titles
│   ├── data-table.tsx        # Tables
│   ├── confirm-dialog.tsx    # Confirmations
│   └── *-content.tsx         # Page content components
├── auth/
│   └── *-form.tsx            # Auth forms
└── ui/                       # shadcn components
```

## Dashboard UI Patterns

> **Always load the `shadcn` skill for UI components.**

- **Page titles**: Use `PageHeader` component
- **Tables**: Use `DataTable` component
- **Details view**: Use `Sheet` (slides from right)
- **Confirmations**: Use `ConfirmDialog`

## Code Style

### Imports Order
```typescript
// 1. React/Next
// 2. Dashboard components
// 3. UI components (shadcn)
// 4. Actions
// 5. Utils/Types
// 6. Icons (only in Client Components)
```

### Naming Conventions
- **Pages**: `page.tsx`
- **Client Components**: `*-content.tsx`, `*-form.tsx`
- **Server Actions**: verb + noun (`getUsers`, `deleteUser`)

## Commands

```bash
bun dev                        # Development (runs lint first, then next dev + tsc watch)
bun run build                  # Build
bun run typecheck              # Type check
bun run lint                   # Lint (zero warnings allowed)
bunx shadcn add [name]         # Add shadcn component with the pinned local CLI
bunx prisma generate           # Generate Prisma client
bun run db:deploy              # Apply pending migrations (migrate deploy)
bun run db:migrate -- --name x  # Create a new migration (local Docker database only)
```

## Git Workflow

- `main` is protected on GitHub: never commit or push to `main` directly.
- Work on a branch named `<type>/<short-topic>` (for example `feat/system-logs`, `fix/login-redirect`, `chore/ci-cache`). The types match the commit prefixes used in this repo.
- Open a pull request to `main`. CI runs on every push to the branch. Merging requires all five CI jobs to pass and the branch to be up to date with `main`.
- Pull requests are merged with squash. The pull request title becomes the commit message on `main`, so write it like a commit message.
- Never bypass hooks with `--no-verify`. The pre-commit hook checks dependency versions, lint, types, and the build.

## Remember

1. **Load skills** - Detect context, load the matching skill automatically
2. **Server by Default** - Pages are Server Components
3. **Client When Needed** - Only use "use client" for interactivity
4. **shadcn Always** - Use shadcn components, don't reinvent
   - The project style is `radix-vega` in `components.json`; generated `cn` imports must use `@/lib/utils`.
5. **Actions in `actions/`** - Never in `lib/` or page files
6. **Export from index** - Always add new components to barrel exports
7. **router.refresh()** - Reload server data after mutations
8. **Auth through server actions** - `/api/auth` stays closed; use `auth.api.*`
9. **Keep Classic theme in sync** - After changing `app/auth`, `components/auth`, `app/page.tsx`, `components/landing-content.tsx`, `app/globals.css`, `app/layout.tsx`, or `components/ui`, run `bun run theme:sync-classic`. CI checks this with `bun run theme:sync-classic --check`.
10. **Respect toolchain update limits** - Keep TypeScript below 6.1 because typescript-eslint 8.x does not support 6.1+, ESLint on 9.x because eslint-plugin-react (included by eslint-config-next) supports only ^9, and Node on the current LTS because upgrades must change both Dockerfiles and `@types/node` together.
11. **Pin dependencies and update them deliberately** - Add dependencies with a complete exact version (`bun add <package>@<x.y.z>`) or omit the version (`bun add <package>`); incomplete versions such as `@7` create a range. `bunfig.toml` enforces exact versions, and `bun run deps:check` verifies them. Upgrade dependencies in tested stages following `docs/en/04-dependency-updates.md`.
12. **Branches and pull requests** - Never push to main; open a PR and merge it with squash after CI passes

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
