'use server';

import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { reportError } from '@/lib/report-error';
import type { PageSize } from '@/lib/list-pagination';
import type { TableParams } from '@/lib/table-query';
import {
  type ProfileActivityFilter,
  type ProfileSessionsFilter,
  profileActivityTableQuery,
  profileSessionsTableQuery,
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

export interface ActivityLogEntryPage {
  logs: ActivityLogEntry[];
  total: number;
  page: number;
  pageSize: PageSize;
  totalPages: number;
}

export interface SessionData {
  id: string;
  userAgent: string | null;
  ipAddress: string | null;
  createdAt: string;
  expiresAt: string;
  isCurrent: boolean;
}

export interface SessionPage {
  sessions: SessionData[];
  total: number;
  page: number;
  pageSize: PageSize;
  totalPages: number;
}

export interface ProfilePageData {
  profile: ProfileData;
  twoFactorEnabled: boolean;
  isOAuthUser: boolean;
  hasPassword: boolean;
}

// ============================================
// GET PROFILE DATA ACTION
// ============================================

export const getProfileData = async (): Promise<{
  response: 'success' | 'error';
  message: string;
  data: ProfilePageData | null;
}> => {
  try {
    const session = await getSession();
    if (!session) {
      return { response: 'error', message: 'Unauthorized', data: null };
    }

    const userId = session.user.id;

    // Get user's 2FA status, image and sign-in methods from database
    const [user, oauthAccounts, credentialAccount] = await Promise.all([
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

    return {
      response: 'success',
      message: 'Profile data fetched successfully',
      data: {
        profile,
        twoFactorEnabled: user.twoFactorEnabled ?? false,
        isOAuthUser: oauthAccounts.length > 0,
        hasPassword: credentialAccount !== null,
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

// ============================================
// GET MY ACTIVITY LOGS ACTION
// ============================================

function parseDetails(details: string | null): Record<string, unknown> | null {
  if (!details) return null;
  try {
    const parsed: unknown = JSON.parse(details);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

export const getMyActivityLogs = async (
  params: TableParams<ProfileActivityFilter>,
): Promise<{
  response: 'success' | 'error';
  message: string;
  data: ActivityLogEntryPage | null;
}> => {
  try {
    const session = await getSession();
    if (!session) {
      return { response: 'error', message: 'Unauthorized', data: null };
    }

    const parsedParams = profileActivityTableQuery.schema.safeParse(params);
    if (!parsedParams.success) {
      return {
        response: 'error',
        message: 'Invalid activity parameters',
        data: null,
      };
    }

    const { page, pageSize, filters } = parsedParams.data;
    // Always the signed-in user's own activity, never an id sent by the client.
    const where = {
      userId: session.user.id,
      ...(filters.action.length > 0 ? { action: { in: filters.action } } : {}),
    };

    const [total, logs] = await prisma.$transaction([
      prisma.activityLog.count({ where }),
      prisma.activityLog.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    const totalPages = Math.max(1, Math.ceil(total / pageSize));

    return {
      response: 'success',
      message: 'Activity fetched successfully',
      data: {
        logs: logs.map((log) => ({
          id: log.id,
          userId: log.userId,
          action: log.action,
          details: parseDetails(log.details),
          ipAddress: log.ipAddress,
          userAgent: log.userAgent,
          createdAt: log.createdAt.toISOString(),
        })),
        total,
        page: Math.min(page, totalPages),
        pageSize,
        totalPages,
      },
    };
  } catch (error) {
    reportError(error, { area: 'profile.activity' });
    return {
      response: 'error',
      message: 'Failed to fetch activity',
      data: null,
    };
  }
};

// ============================================
// GET MY SESSIONS ACTION
// ============================================

export const getMySessions = async (
  params: TableParams<ProfileSessionsFilter>,
): Promise<{
  response: 'success' | 'error';
  message: string;
  data: SessionPage | null;
}> => {
  try {
    const session = await getSession();
    if (!session) {
      return { response: 'error', message: 'Unauthorized', data: null };
    }

    const parsedParams = profileSessionsTableQuery.schema.safeParse(params);
    if (!parsedParams.success) {
      return {
        response: 'error',
        message: 'Invalid session parameters',
        data: null,
      };
    }

    const { page, pageSize } = parsedParams.data;
    const currentSessionId = session.session.id;
    // Always the signed-in user's own sessions, never an id sent by the client.
    const where = {
      userId: session.user.id,
      expiresAt: { gt: new Date() },
    };

    const [total, sessions] = await prisma.$transaction([
      prisma.session.count({ where }),
      prisma.session.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: {
          id: true,
          userAgent: true,
          ipAddress: true,
          createdAt: true,
          expiresAt: true,
        },
      }),
    ]);

    const totalPages = Math.max(1, Math.ceil(total / pageSize));

    return {
      response: 'success',
      message: 'Sessions fetched successfully',
      data: {
        sessions: sessions.map((s) => ({
          id: s.id,
          userAgent: s.userAgent,
          ipAddress: s.ipAddress,
          createdAt: s.createdAt.toISOString(),
          expiresAt: s.expiresAt.toISOString(),
          isCurrent: s.id === currentSessionId,
        })),
        total,
        page: Math.min(page, totalPages),
        pageSize,
        totalPages,
      },
    };
  } catch (error) {
    reportError(error, { area: 'profile.sessions' });
    return {
      response: 'error',
      message: 'Failed to fetch sessions',
      data: null,
    };
  }
};
