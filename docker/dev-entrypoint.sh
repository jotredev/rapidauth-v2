#!/bin/sh
set -eu

cd /app

lock_hash="$(sha256sum bun.lock | sha256sum | cut -d ' ' -f 1)"
installed_hash="$(cat node_modules/.docker-bun-lock-hash 2>/dev/null || true)"

if [ "$lock_hash" != "$installed_hash" ]; then
  bun install --frozen-lockfile
  printf '%s\n' "$lock_hash" > node_modules/.docker-bun-lock-hash
fi

if [ "$#" -gt 0 ]; then
  exec "$@"
fi

if ! migrate_output="$(bunx prisma migrate deploy 2>&1)"; then
  printf '%s\n' "$migrate_output" >&2
  if printf '%s' "$migrate_output" | grep -q 'P3005'; then
    cat >&2 <<'MSG'

This database already has tables but no migration history (Prisma error P3005).
It was probably created with `prisma db push`. Nothing was changed.
If its tables match the current schema, mark the initial migration as applied yourself:
  docker compose -f docker/compose.dev.yaml run --rm app bunx prisma migrate resolve --applied 0_init
Then start the containers again. Guide (English): docs/en/00-manual-setup.md
Guía (español): docs/es/00-manual-setup.md
MSG
  fi
  exit 1
fi
printf '%s\n' "$migrate_output"
exec bunx next dev --turbopack --hostname 0.0.0.0
