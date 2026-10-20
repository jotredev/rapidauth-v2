import { prisma } from "@/lib/prisma";
import { reportError } from "@/lib/report-error";
import { deleteUserRecord } from "@/lib/user-deletion";

export const CLEANUP_BATCH_SIZE = 500;
export const RATE_LIMIT_RETENTION_MS = 24 * 60 * 60 * 1000;
export const UNVERIFIED_ACCOUNT_RETENTION_MS = 7 * 24 * 60 * 60 * 1000;
export const OPERATIONAL_LOG_RETENTION_MS = 90 * 24 * 60 * 60 * 1000;

export type CleanupCounts = {
  rateLimits: number;
  verifications: number;
  unverifiedUsers: number;
  operationalLogs: number;
};

export async function runScheduledCleanup(now = new Date()): Promise<CleanupCounts> {
  try {
    const rateLimitCutoff = BigInt(now.getTime() - RATE_LIMIT_RETENTION_MS);
    const verificationCutoff = now;
    const accountCutoff = new Date(
      now.getTime() - UNVERIFIED_ACCOUNT_RETENTION_MS,
    );
    const operationalLogCutoff = new Date(
      now.getTime() - OPERATIONAL_LOG_RETENTION_MS,
    );

    const oldRateLimits = await prisma.rateLimit.findMany({
      where: { lastRequest: { lt: rateLimitCutoff } },
      orderBy: { lastRequest: "asc" },
      select: { id: true },
      take: CLEANUP_BATCH_SIZE,
    });
    const rateLimitResult = oldRateLimits.length
      ? await prisma.rateLimit.deleteMany({
          where: {
            id: { in: oldRateLimits.map(({ id }) => id) },
            lastRequest: { lt: rateLimitCutoff },
          },
        })
      : { count: 0 };

    const expiredVerifications = await prisma.verification.findMany({
      where: { expiresAt: { lt: verificationCutoff } },
      orderBy: { expiresAt: "asc" },
      select: { id: true },
      take: CLEANUP_BATCH_SIZE,
    });
    const verificationResult = expiredVerifications.length
      ? await prisma.verification.deleteMany({
          where: {
            id: { in: expiredVerifications.map(({ id }) => id) },
            expiresAt: { lt: verificationCutoff },
          },
        })
      : { count: 0 };

    const unverifiedUsers = await prisma.user.findMany({
      where: {
        emailVerified: false,
        createdAt: { lt: accountCutoff },
        role: { not: "admin" },
        status: { not: "pending" },
      },
      orderBy: { createdAt: "asc" },
      select: { id: true },
      take: CLEANUP_BATCH_SIZE,
    });

    let unverifiedUsersDeleted = 0;
    for (const { id } of unverifiedUsers) {
      try {
        const result = await deleteUserRecord(id, {
          where: {
            emailVerified: false,
            createdAt: { lt: accountCutoff },
            role: { not: "admin" },
            status: { not: "pending" },
          },
        });
        if (result.deleted) unverifiedUsersDeleted++;
      } catch (error) {
        reportError(error, { area: "scheduled-cleanup.user" });
      }
    }

    const oldOperationalLogs = await prisma.operationalLog.findMany({
      where: { createdAt: { lt: operationalLogCutoff } },
      orderBy: { createdAt: "asc" },
      select: { id: true },
      take: CLEANUP_BATCH_SIZE,
    });
    const operationalLogResult = oldOperationalLogs.length
      ? await prisma.operationalLog.deleteMany({
          where: {
            id: { in: oldOperationalLogs.map(({ id }) => id) },
            createdAt: { lt: operationalLogCutoff },
          },
        })
      : { count: 0 };

    return {
      rateLimits: rateLimitResult.count,
      verifications: verificationResult.count,
      unverifiedUsers: unverifiedUsersDeleted,
      operationalLogs: operationalLogResult.count,
    };
  } catch (error) {
    reportError(error, { area: "scheduled-cleanup.run" });
    throw error;
  }
}
