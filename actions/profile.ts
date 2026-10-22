'use server';

import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { reportError } from '@/lib/report-error';
import type { PageSize } from '@/lib/list-pagination';
import {
  type ProfileListParams,
  profileListParamsSchema,
} from '@/lib/profile-query';

// ============================================
// TYPES
// ============================================

export interface ProfileData {
  name: string;
  email: string;
  avatar?: string;
}

export interface ActivityLogEntry {
  id: string;
  userId: string;
  action: string;
  details: Record<string, unknown> | null;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
}

export interface SessionData {
  id: string;
  userAgent: string | null;
  ipAddress: string | null;
  createdAt: string;
  expiresAt: string;
  isCurrent: boolean;
}

export interface ProfilePageData {
  profile: ProfileData;
  twoFactorEnabled: boolean;
  isOAuthUser: boolean;
  hasPassword: boolean;
  activityLogs: ActivityLogEntry[];
  sessions: SessionData[];
  activityTotal: number;
  activityPage: number;
  activityTotalPages: number;
  sessionsTotal: number;
  sessionsPage: number;
  sessionsTotalPages: number;
  pageSize: PageSize;
}

// ============================================
// GET PROFILE DATA ACTION
// ============================================

export const getProfileData = async (
  params: ProfileListParams,
): Promise<{
  response: 'success' | 'error';
  message: string;
  data: ProfilePageData | null;
}> => {
  try {
    const session = await getSession();
    if (!session) {
      return { response: 'error', message: 'Unauthorized', data: null };
    }

    const validation = profileListParamsSchema.safeParse(params);
    if (!validation.success) {
      return {
        response: 'error',
        message: 'Invalid profile parameters',
        data: null,
      };
    }

    const { activityPage, sessionsPage, pageSize } = validation.data;
    const userId = session.user.id;
    const currentSessionId = session.session.id;
    const now = new Date();

    // Get user's 2FA status, image, activity logs, and sessions from database
    const [
      user,
      oauthAccounts,
      credentialAccount,
      activityTotal,
      activityLogs,
      sessionsTotal,
      sessions,
    ] = await Promise.all([
      prisma.user.findUnique({
        where: { id: userId },
        select: { name: true, email: true, twoFactorEnabled: true, image: true },
      }),
      prisma.account.findMany({
        where: { userId, providerId: { not: 'credential' } },
        select: { providerId: true },
      }),
      prisma.account.findFirst({
        where: { userId, providerId: 'credential', password: { not: null } },
        select: { id: true },
      }),
      prisma.activityLog.count({
        where: { userId },
      }),
      prisma.activityLog.findMany({
        where: { userId },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: (activityPage - 1) * pageSize,
        take: pageSize,
      }),
      prisma.session.count({
        where: {
          userId,
          expiresAt: { gt: now },
        },
      }),
      prisma.session.findMany({
        where: {
          userId,
          expiresAt: { gt: now },
        },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: (sessionsPage - 1) * pageSize,
        take: pageSize,
        select: { id: true, userAgent: true, ipAddress: true, createdAt: true, expiresAt: true },
      }),
    ]);

    if (!user) {
      return {
        response: 'error',
        message: 'User not found',
        data: null,
      };
    }

    const profile: ProfileData = {
      name: user.name,
      email: user.email,
      avatar: user.image ?? undefined,
    };

    // Parse JSON details for activity logs and serialize dates
    const parsedActivityLogs: ActivityLogEntry[] = activityLogs.map((log) => ({
      id: log.id,
      userId: log.userId,
      action: log.action,
      details: log.details ? JSON.parse(log.details) : null,
      ipAddress: log.ipAddress,
      userAgent: log.userAgent,
      createdAt: log.createdAt.toISOString(),
    }));

    // Format sessions with current session flag and serialize dates
    const formattedSessions: SessionData[] = sessions.map((s) => ({
      id: s.id,
      userAgent: s.userAgent,
      ipAddress: s.ipAddress,
      createdAt: s.createdAt.toISOString(),
      expiresAt: s.expiresAt.toISOString(),
      isCurrent: s.id === currentSessionId,
    }));

    const activityTotalPages = Math.max(1, Math.ceil(activityTotal / pageSize));
    const resolvedActivityPage = Math.min(activityPage, activityTotalPages);

    const sessionsTotalPages = Math.max(1, Math.ceil(sessionsTotal / pageSize));
    const resolvedSessionsPage = Math.min(sessionsPage, sessionsTotalPages);

    return {
      response: 'success',
      message: 'Profile data fetched successfully',
      data: {
        profile,
        twoFactorEnabled: user.twoFactorEnabled ?? false,
        isOAuthUser: oauthAccounts.length > 0,
        hasPassword: credentialAccount !== null,
        activityLogs: parsedActivityLogs,
        sessions: formattedSessions,
        activityTotal,
        activityPage: resolvedActivityPage,
        activityTotalPages,
        sessionsTotal,
        sessionsPage: resolvedSessionsPage,
        sessionsTotalPages,
        pageSize,
      },
    };
  } catch (error) {
    reportError(error, { area: 'profile.read' });
    return {
      response: 'error',
      message: 'Failed to fetch profile data',
      data: null,
    };
  }
};
