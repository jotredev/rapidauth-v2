# Create your project from the template

This guide is only for the template repository. `bun run project:init` turns a fresh copy of RapidAuth into a project of your own: your name everywhere, no leftovers of the template, and ready to start. The command, its code and this guide are deleted from your project when it finishes.

## Before you start

1. Create your copy: on GitHub, open the template repository and press **Use this template**, or clone it. A copy made with "Use this template" has one commit and no history, which is expected.
2. Open a terminal in the folder of your copy and run `bun install`.
3. Make sure Git has no unsaved changes (`git status` shows nothing). The command refuses to run otherwise.
4. Check the internet connection: the command downloads the template history to find which version your copy came from.

## Run it

```bash
bun run project:init
```

The init runs **once**. If the project is already initialized, the command stops with an error and there is no option to force it.

### What it asks

1. **Project name**, for example `Acme Portal`.
2. **Project slug**: lowercase letters, digits and hyphens, suggested from the name (`acme-portal`).
3. **One-line description**: used in the new README and the landing page. It can stay empty.
4. **GitHub repository** (`owner/repo`): suggested from `origin` when it already points to your repository. It sets the default Docker image (`ghcr.io/owner/repo`) and the `git clone` line of the VPS guide. If you leave it empty, a visible `OWNER/<slug>` placeholder is written for you to replace.
5. **How do you want to start?**
   - **Use Docker locally** (recommended): creates `.env` with local values, starts PostgreSQL and Mailpit with Docker, applies the migrations, and ends with "Run `bun dev` and open http://localhost:3000". If port 5432 is busy it picks a free one. If Docker is missing or not running, it finishes and tells you what to do.
   - **Enter my production values now**: runs `bun run setup:prod`. The database you configure there is the one the app also uses on your computer.
   - **I'll configure it later**: does not touch `.env` and shows both paths.

To skip the questions, pass flags: `--name`, `--slug`, `--description`, `--repo`, `--start docker|prod|later`. Without a terminal, `--name`, `--slug` and `--start` are required.

## What it changes

- Renames every form of the template name in versioned files: texts, emails, the two-factor issuer, the package name, the Docker project name, the local database user and name, the documentation and the themes.
- Resets `package.json` to version `0.1.0`.
- Deletes `.forge614/` (the Engram memory folder of the template; Engram creates a new one for your project), `docs/superpowers/`, and the code, tests and documentation of `project:init`.
- Replaces `README.md`, `app/page.tsx` and `components/landing-content.tsx` with neutral versions that use your name.
- Writes `.setup/project.json` with your answers and the template version your copy came from. `template:pull` uses it later.
- Runs `bun install` (to refresh `bun.lock`) and `bun run theme:sync-classic`.

It is atomic: it computes every change first and, if any write fails or a mention of the template is left behind, it restores every file exactly as it was.

**It does not commit and it does not touch the Git remote.** Review the changes with `git status` and commit them on your own branch.

## Warnings at the end

- **`origin` still points to the template.** Change it before opening the project with an AI agent: `git remote set-url origin <your repository>`. Otherwise Engram links the folder to the template memory again.
- **There is no `.env`.** This happens when you chose "later", or when Docker or the production setup did not create one. Every commit runs the pre-commit build, which needs `SUPPORT_EMAIL` and the other required variables, so your first commit fails until you have them. Start with Docker (`cd docker && docker compose up -d db mailpit`, then `bun dev` creates `.env`), run `bun run setup:prod`, or create `.env` from `.env.example`.

## If you run it inside the template itself

When `origin` is the template repository, the init asks you to type the template slug to confirm (or pass `--confirm-template <slug>`), because it would turn the template into a project and delete its memory folder. Only do this in a copy.

## Get template updates later

See the template updates guide (`docs/en/10-template-updates.md`): `bun run template:pull`.

## Exit codes

| Code | Meaning |
| --- | --- |
| `0` | The project was initialized (also when the start step had warnings). |
| `1` | It refused or failed and changed nothing. |
| `2` | Invalid arguments. |
