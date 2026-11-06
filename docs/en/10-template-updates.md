# Template updates

This project was created from a template. When the template publishes a new version, `bun run template:pull` brings those improvements into your project without overwriting your own work. You choose when to run it; nothing updates by itself.

## When to use it

Run it when you want the latest fixes and features of the template, for example after reading its release notes. It works only in a project that was already initialized with `bun run project:init`. Inside the template itself it refuses to run.

## Before you run it

The command refuses to start, and changes nothing, in these cases:

- **The Git working tree has unsaved changes.** Commit or discard them first. This way the pull is easy to review and easy to undo.
- **An earlier pull left conflicts.** If any `*.pull-conflict-*` file or file with conflict markers is still in the project, resolve it first (see "Resolve conflicts" below).
- **The project is not initialized**, or `.setup/project.json` is missing or invalid.
- **There is no network.** The command reads the template's published versions from Git.

## Run it

```bash
bun run template:pull
```

Useful options:

| Option | What it does |
| --- | --- |
| `--dry-run` | Shows what would be updated, added, deleted and in conflict. Writes nothing. Use it first if you are unsure. |
| `--allow-major` | Accepts a jump to a new major version (for example from 1.4.0 to 2.0.0). |

## Which version it brings

- It looks at the template's version tags (`X.Y.Z`, such as `2.4.0`) and picks the **highest** one, comparing numbers (so `2.10.0` is newer than `2.9.0`).
- If that version is not newer than the one your project already has, it says you are up to date. It never goes back to an older version.
- A new **major** version (the first number grows) can contain breaking changes. The command stops and asks you to read the template's release notes and run it again with `--allow-major`.
- When it skips several versions at once, it lists the versions it crossed.
- The version your project has is saved in `.setup/project.json`.

## What travels and what does not

Every file belongs to one of four classes:

| Class | What it means | Files |
| --- | --- | --- |
| Template | Travels. The pull updates it. | Application code, `scripts/`, `prisma/` (including migrations), `docker/`, `.github/`, `.husky/`, `.agents/`, `.claude/`, `skills-lock.json`, `docs/en/`, `docs/es/`, `AGENTS.md` and the configuration files in the project root |
| Seeded | `project:init` wrote it for you. After that it is yours and the pull never touches it. | `README.md`, `app/page.tsx`, `components/landing-content.tsx`, `config/site.ts`, and the copies of the two landing files inside each folder of `themes/` |
| Project | Yours. The pull never touches it. | `.env` and other `.env*` files (not the `.example` ones), `docker/.env`, `.setup/`, `bun.lock`, `.forge614/` |
| Template only | Part of the template, never sent to a project. | `docs/superpowers/`, the `project:init` code and its guide |

Files that Git ignores do not exist for the pull. The pull also applies your project name to what it brings, using the answers saved in `.setup/project.json`, so you never receive the template's own name.

### Keep a template file for yourself

If you changed a file of the template class and want the pull to leave it alone for good, list it in `.setup/template-exclusions.json`:

```json
{
  "schemaVersion": 1,
  "exclude": [
    ".agents/skills/my-custom-skill/",
    "lib/special.ts"
  ]
}
```

- Each entry is an exact path, or a folder that ends with a slash (it covers everything inside).
- Paths are relative to the project root and use forward slashes. Globs (`*`), `..` and absolute paths are not allowed.
- The file is optional. If it is invalid, the pull stops and tells you why.

## How files are merged

For every file the pull compares three states: the template version your project came from, the new template version and your file.

- **Only the template changed it:** the new version is taken (new and deleted files too).
- **Only you changed it:** your file stays as it is.
- **Both changed it:** Git merges both changes. If they touch different lines, the merge is automatic. If they touch the same lines, the file keeps both versions marked for you to decide (a conflict).
- **One side deleted it and the other changed it:** it counts as a conflict and your file is kept.
- **A binary file changed on both sides:** your file is kept and the template version is written next to it.

## Resolve conflicts

The command finishes normally even with conflicts and lists them at the end. For a text file, open it and look for the conflict markers. A conflict looks like this (the markers are shown indented here; in the real file they start at the first column):

```text
  <<<<<<< project
  your version of the lines
  ||||||| template 2.3.0
  the lines as they were in the version you had
  =======
  the new version of the lines
  >>>>>>> template 2.4.0
```

1. Decide what the final lines should be: yours, the template's, or a mix.
2. Delete all the marker lines (the first one starts with less-than signs, the last one with greater-than signs, and there are a line of vertical bars and a line of equal signs in between) and any lines you do not want.
3. Save the file.

When the project's file was kept and the template side was written next to it, you will see a file named like `lib/example.ts.pull-conflict-2.4.0`. Compare it with your file, copy what you want into your file, and **delete the `*.pull-conflict-*` file**.

Until every marker and every `*.pull-conflict-*` file is gone, the next `template:pull` refuses to run.

## Next steps after a pull

The command prints the steps that apply. The common ones:

1. `bun install`, when `package.json` changed. Resolve its conflicts first. This also refreshes `bun.lock`. The pull never runs it for you.
2. `bun run db:deploy`, when new migrations arrived.
3. `bun run theme:sync-classic`, when the files that the Classic theme copies changed.
4. Review the result with `git diff`, run `bun run lint`, `bun run typecheck` and `bun run test`, and commit on your own branch.

The pull **never commits**. It also writes everything in one step: if something fails midway, every change is undone.

If some brought files still mention the template's name, the command warns you and lists them so you can rename them by hand. The next pull will handle that spelling by itself.

## Exit codes

| Code | Meaning |
| --- | --- |
| `0` | Finished (also when there are conflicts to resolve), or already up to date. |
| `1` | It refused or failed and changed nothing (dirty tree, leftover conflicts, no network, new major version without `--allow-major`...). |
| `2` | Invalid arguments. |
