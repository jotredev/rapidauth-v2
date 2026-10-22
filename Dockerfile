# syntax=docker/dockerfile:1

FROM node:24-alpine AS dependencies
COPY --from=oven/bun:1.4.2-alpine /usr/local/bin/bun /usr/local/bin/bun
RUN ln -s /usr/local/bin/bun /usr/local/bin/bunx
WORKDIR /app
COPY package.json bun.lock prisma.config.ts ./
COPY prisma ./prisma
RUN bun install --frozen-lockfile

FROM dependencies AS builder
COPY . .
ARG NEXT_PUBLIC_SENTRY_DSN
ARG SENTRY_ORG
ARG SENTRY_PROJECT
ARG SUPPORT_EMAIL
# These dummy values let auth and Prisma modules load for compilation only.
# The build does not connect to the database; the runtime container receives real values.
RUN --mount=type=secret,id=sentry_auth_token,env=SENTRY_AUTH_TOKEN,required=false \
    DATABASE_URL="postgresql://build:build@127.0.0.1:5432/build?sslmode=disable" \
    BETTER_AUTH_URL="http://127.0.0.1:3000" \
    BETTER_AUTH_SECRET="0000000000000000000000000000000000000000000000000000000000000000" \
    SUPPORT_EMAIL="${SUPPORT_EMAIL}" \
    NODE_ENV="production" bun run build

FROM node:24-alpine AS runner
WORKDIR /app
ENV NODE_ENV="production" \
    NEXT_TELEMETRY_DISABLED="1" \
    HOSTNAME="0.0.0.0" \
    PORT="3000"
RUN addgroup --system --gid 1001 nodejs \
    && adduser --system --uid 1001 nextjs \
    && mkdir -p /app/storage \
    && chown nextjs:nodejs /app/storage
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
USER nextjs
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=3s --start-period=20s --retries=3 \
    CMD wget -q -O /dev/null http://127.0.0.1:3000/api/auth/ok || exit 1
CMD ["node", "server.js"]
