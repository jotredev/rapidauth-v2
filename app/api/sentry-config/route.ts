import { getSentryRuntimeConfig } from '@/lib/sentry-config';

export const dynamic = 'force-dynamic';

export function GET(): Response {
  const { dsn } = getSentryRuntimeConfig(process.env);

  return Response.json(
    { dsn: dsn ?? null },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
