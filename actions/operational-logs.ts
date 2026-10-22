'use server';

import { getSession } from '@/lib/auth';
import {
  ADMIN_TWO_FACTOR_REQUIRED_MESSAGE,
  getAdminAccess,
} from '@/lib/admin-access';
import { prisma } from '@/lib/prisma';
import { reportError } from '@/lib/report-error';
import {
  buildOperationalLogsWhere,
  operationalLogListParamsSchema,
  type OperationalLogListParams,
} from '@/lib/operational-log-query';
import type {
  OperationalLogLevel,
  OperationalLogSource,
  OperationalLogCode,
} from '@/lib/operational-log';

export interface OperationalLogUser {
  id: string;
  name: string;
  email: string;
}

export interface OperationalLogMetadata {
  template?: string;
  durationMs?: number;
  errorCode?: string;
}

export interface OperationalLogItem {
  id: string;
  level: OperationalLogLevel;
  source: OperationalLogSource;
  code: OperationalLogCode;
  createdAt: string;
  userId: string | null;
  user: OperationalLogUser | null;
  metadata: OperationalLogMetadata | null;
}

export interface OperationalLogPage {
  logs: OperationalLogItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  filterUser: OperationalLogUser | null;
}

function extractMetadata(raw: unknown): OperationalLogMetadata | null {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    return null;
  }
  const obj = raw as Record<string, unknown>;
  const result: OperationalLogMetadata = {};
  if (typeof obj.template === 'string') {
    result.template = obj.template;
  }
  if (typeof obj.durationMs === 'number') {
    result.durationMs = obj.durationMs;
  }
  if (typeof obj.errorCode === 'string') {
    result.errorCode = obj.errorCode;
  }
  return Object.keys(result).length > 0 ? result : null;
}

export async function getOperationalLogs(
  params: OperationalLogListParams,
): Promise<{
  response: 'success' | 'error';
  message: string;
  data: OperationalLogPage | null;
}> {
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

    const parsedParams = operationalLogListParamsSchema.safeParse(params);
    if (!parsedParams.success) {
      return {
        response: 'error',
        message: 'Invalid operational log parameters',
        data: null,
      };
    }

    const where = buildOperationalLogsWhere(parsedParams.data);

    const [total, logsData, filterUserResult] = await prisma.$transaction([
      prisma.operationalLog.count({ where }),
      prisma.operationalLog.findMany({
        where,
        skip: (parsedParams.data.page - 1) * parsedParams.data.pageSize,
        take: parsedParams.data.pageSize,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
      }),
      ...(parsedParams.data.userId
        ? [
            prisma.user.findUnique({
              where: { id: parsedParams.data.userId },
              select: { id: true, name: true, email: true },
            }),
          ]
        : []),
    ]);

    const filterUser = (filterUserResult as OperationalLogUser | null | undefined) ?? null;

    const totalPages = Math.max(1, Math.ceil(total / parsedParams.data.pageSize));

    const logs: OperationalLogItem[] = logsData.map((log) => ({
      id: log.id,
      level: log.level as OperationalLogLevel,
      source: log.source as OperationalLogSource,
      code: log.code as OperationalLogCode,
      createdAt: log.createdAt.toISOString(),
      userId: log.userId,
      user: log.user,
      metadata: extractMetadata(log.metadata),
    }));

    return {
      response: 'success',
      message: 'Operational logs fetched successfully',
      data: {
        logs,
        total,
        page: Math.min(parsedParams.data.page, totalPages),
        pageSize: parsedParams.data.pageSize,
        totalPages,
        filterUser,
      },
    };
  } catch (error) {
    reportError(error, { area: 'operational-logs.list' });
    return {
      response: 'error',
      message: 'Failed to fetch operational logs',
      data: null,
    };
  }
}
