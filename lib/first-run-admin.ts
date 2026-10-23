// Internal helpers for the first-run admin screen; they must not live in a "use server" file because its exports would be public endpoints.

import { redirect } from 'next/navigation';
import { connection } from 'next/server';
import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';

export const FIRST_RUN_ADMIN_PATH = '/auth/setup';

export const FIRST_RUN_WINDOW_MS = 15 * 60 * 1000;

export const FIRST_RUN_CLOSED_MESSAGE =
  'The setup window has closed. Restart the app to open it again.';

export type FirstRunState = 'completed' | 'open' | 'closed';

/**
 * Internal, server-only and undocumented (like RAPIDAUTH_NEXT_DIST_DIR): lets the
 * E2E suite shorten or expire the window. Anything that is not a non-negative
 * integer falls back to the 15 minute default.
 */
export function getFirstRunWindowMs(
  env: Record<string, string | undefined> = process.env
): number {
  const raw = env.RAPIDAUTH_FIRST_RUN_WINDOW_MS?.trim();
  if (!raw || !/^\d+$/.test(raw)) return FIRST_RUN_WINDOW_MS;

  const value = Number(raw);
  return Number.isSafeInteger(value) ? value : FIRST_RUN_WINDOW_MS;
}

/**
 * The window is counted from process start, not from module load, so every
 * route bundle (and dev-mode reload) agrees on the same moment.
 */
export function isFirstRunWindowOpen({
  uptimeSeconds = process.uptime(),
  windowMs = getFirstRunWindowMs(),
}: {
  uptimeSeconds?: number;
  windowMs?: number;
} = {}): boolean {
  return uptimeSeconds * 1000 < windowMs;
}

export async function hasAdminUser(
  client: Prisma.TransactionClient | typeof prisma = prisma
): Promise<boolean> {
  const admin = await client.user.findFirst({
    where: { role: 'admin' },
    select: { id: true },
  });

  return admin !== null;
}

export async function getFirstRunState(): Promise<FirstRunState> {
  if (await hasAdminUser()) return 'completed';
  return isFirstRunWindowOpen() ? 'open' : 'closed';
}

/** For Server Components: send visitors to the setup screen while no admin exists. */
export async function redirectToFirstRunIfNoAdmin(): Promise<void> {
  // Admin existence is per-request data; without this the build prerenders the page and queries the database.
  await connection();
  if (!(await hasAdminUser())) redirect(FIRST_RUN_ADMIN_PATH);
}
