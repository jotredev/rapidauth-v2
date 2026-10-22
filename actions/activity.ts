'use server';

import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { reportError } from '@/lib/report-error';
import {
  ADMIN_TWO_FACTOR_REQUIRED_MESSAGE,
  getAdminAccess,
} from '@/lib/admin-access';
import type { PageSize } from '@/lib/list-pagination';
import {
  buildActivityLogWhere,
  activityLogListParamsSchema,
  type ActivityLogListParams,
} from '@/lib/activity-log-query';

// ============================================
// TYPES
// ============================================

export interface ActivityLog {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  action: string;
  details: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
}

export interface ActivityLogPage {
  logs: ActivityLog[];
  total: number;
  page: number;
  pageSize: PageSize;
  totalPages: number;
}

// ============================================
// GET ACTIVITY LOGS ACTION
// ============================================

export const getActivityLogs = async (
  params: ActivityLogListParams,
): Promise<{
  response: 'success' | 'error';
  message: string;
  data: ActivityLogPage | null;
}> => {
  try {
    const session = await getSession();
    if (!session) {
      return { response: 'error', message: 'Unauthorized', data: null };
    }

    const adminAccess = await getAdminAccess(session);
    if (adminAccess !== 'admin') {
      return {
        response: 'error',
        message:
          adminAccess === 'two-factor-required'
            ? ADMIN_TWO_FACTOR_REQUIRED_MESSAGE
            : 'Unauthorized',
        data: null,
      };
    }

    const parsedParams = activityLogListParamsSchema.safeParse(params);
    if (!parsedParams.success) {
      return {
        response: 'error',
        message: 'Invalid activity log parameters',
        data: null,
      };
    }

    const where = buildActivityLogWhere(parsedParams.data);

    const [total, logs] = await prisma.$transaction([
      prisma.activityLog.count({ where }),
      prisma.activityLog.findMany({
        where,
        skip: (parsedParams.data.page - 1) * parsedParams.data.pageSize,
        take: parsedParams.data.pageSize,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        include: {
          user: {
            select: {
              name: true,
              email: true,
            },
          },
        },
      }),
    ]);

    const totalPages = Math.max(1, Math.ceil(total / parsedParams.data.pageSize));

    const data: ActivityLog[] = logs.map((log) => ({
      id: log.id,
      userId: log.userId,
      userName: log.user.name,
      userEmail: log.user.email,
      action: log.action,
      details: log.details,
      ipAddress: log.ipAddress,
      userAgent: log.userAgent,
      createdAt: log.createdAt.toISOString(),
    }));

    return {
      response: 'success',
      message: 'Activity logs fetched successfully',
      data: {
        logs: data,
        total,
        page: Math.min(parsedParams.data.page, totalPages),
        pageSize: parsedParams.data.pageSize,
        totalPages,
      },
    };
  } catch (error) {
    reportError(error, { area: 'activity.list' });
    return {
      response: 'error',
      message: 'Failed to fetch activity logs',
      data: null,
    };
  }
};
