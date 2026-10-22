'use server';

import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { reportError } from '@/lib/report-error';
import {
  ADMIN_TWO_FACTOR_REQUIRED_MESSAGE,
  getAdminAccess,
} from '@/lib/admin-access';
import {
  DASHBOARD_RANGES,
  type DashboardRange,
  type BucketUnit,
  getRangeWindow,
  getBucketKey,
} from '@/lib/dashboard-range';

// ============================================
// TYPES
// ============================================

export interface DashboardMetrics {
  totalUsers: number;
  totalUsersChange: number | null; // crecimiento en el periodo, %, 1 decimal
  activeUsers: number;
  inactiveUsers: number;
  newInPeriod: number;
  newInPeriodChange: number | null; // vs periodo anterior, %, 1 decimal
}

export interface RecentUser {
  id: string;
  name: string;
  email: string;
  role: string;
  status: string;
  createdAt: string;
}

export interface ChartPoint {
  key: string;
  label: string;
  value: number;
}

export interface DashboardData {
  range: DashboardRange;
  unit: BucketUnit;
  metrics: DashboardMetrics;
  chartData: ChartPoint[];
  recentUsers: RecentUser[];
}

export interface UserData {
  name: string;
  email: string;
  emailVerified: boolean;
  createdAt: string;
  twoFactorEnabled: boolean;
}

// ============================================
// GET DASHBOARD METRICS ACTION
// ============================================

export const getDashboardMetrics = async (
  range: DashboardRange = '30d'
): Promise<{
  response: 'success' | 'error';
  message: string;
  data: DashboardData | null;
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

    const rangeParsed = z.enum(DASHBOARD_RANGES).safeParse(range);
    if (!rangeParsed.success) {
      return {
        response: 'error',
        message: 'Invalid dashboard range',
        data: null,
      };
    }

    const validRange = rangeParsed.data;
    const window = getRangeWindow(validRange, new Date());

    const [
      totalUsers,
      activeUsers,
      usersBeforeStart,
      newInPeriod,
      newPreviousPeriod,
      chartRows,
      recentUsersData,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({
        where: {
          emailVerified: true,
        },
      }),
      prisma.user.count({
        where: {
          createdAt: {
            lt: window.start,
          },
        },
      }),
      prisma.user.count({
        where: {
          createdAt: {
            gte: window.start,
          },
        },
      }),
      prisma.user.count({
        where: {
          createdAt: {
            gte: window.previousStart,
            lt: window.start,
          },
        },
      }),
      prisma.$queryRaw<{ bucket: Date; count: number }[]>`
        SELECT date_trunc(${window.unit}, "createdAt") AS bucket, COUNT(*)::int AS count
        FROM "user"
        WHERE "createdAt" >= ${window.start.toISOString()}::timestamp
        GROUP BY 1
        ORDER BY 1`,
      prisma.user.findMany({
        orderBy: {
          createdAt: 'desc',
        },
        take: 5,
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          emailVerified: true,
          createdAt: true,
        },
      }),
    ]);

    const inactiveUsers = totalUsers - activeUsers;

    const totalUsersChange =
      usersBeforeStart > 0
        ? Math.round(((totalUsers - usersBeforeStart) / usersBeforeStart) * 100 * 10) / 10
        : null;

    const newInPeriodChange =
      newPreviousPeriod > 0
        ? Math.round(((newInPeriod - newPreviousPeriod) / newPreviousPeriod) * 100 * 10) / 10
        : null;

    const counts = new Map<string, number>();
    for (const row of chartRows) {
      const key = getBucketKey(new Date(row.bucket), window.unit);
      counts.set(key, Number(row.count));
    }

    const chartData: ChartPoint[] = window.buckets.map((b) => ({
      key: b.key,
      label: b.label,
      value: counts.get(b.key) ?? 0,
    }));

    const recentUsers: RecentUser[] = recentUsersData.map((user) => ({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      status: user.emailVerified ? 'active' : 'pending',
      createdAt: user.createdAt.toISOString().slice(0, 10),
    }));

    return {
      response: 'success',
      message: 'Dashboard metrics fetched successfully',
      data: {
        range: validRange,
        unit: window.unit,
        metrics: {
          totalUsers,
          totalUsersChange,
          activeUsers,
          inactiveUsers,
          newInPeriod,
          newInPeriodChange,
        },
        chartData,
        recentUsers,
      },
    };
  } catch (error) {
    reportError(error, { area: 'dashboard.metrics' });
    return {
      response: 'error',
      message: 'Failed to fetch dashboard metrics',
      data: null,
    };
  }
};

// ============================================
// GET USER DATA ACTION
// ============================================

export const getUserData = async (): Promise<{
  response: 'success' | 'error';
  message: string;
  data: UserData | null;
}> => {
  try {
    const session = await getSession();
    if (!session) {
      return { response: 'error', message: 'Unauthorized', data: null };
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        name: true,
        email: true,
        emailVerified: true,
        createdAt: true,
        twoFactorEnabled: true,
      },
    });

    if (!user) {
      return {
        response: 'error',
        message: 'User not found',
        data: null,
      };
    }

    return {
      response: 'success',
      message: 'User data fetched successfully',
      data: {
        name: user.name,
        email: user.email,
        emailVerified: user.emailVerified,
        createdAt: user.createdAt.toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
        }),
        twoFactorEnabled: user.twoFactorEnabled ?? false,
      },
    };
  } catch (error) {
    reportError(error, { area: 'dashboard.user' });
    return {
      response: 'error',
      message: 'Failed to fetch user data',
      data: null,
    };
  }
};
