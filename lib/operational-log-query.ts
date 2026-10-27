import type { Prisma } from '@prisma/client';
import { defineTableQuery, type TableParams } from './table-query';
import type {
  OperationalLogLevel,
  OperationalLogSource,
  OperationalLogCode,
} from './operational-log';

export const OPERATIONAL_LOG_LEVELS = [
  'info',
  'warn',
  'error',
  'critical',
] as const satisfies readonly OperationalLogLevel[];

export const OPERATIONAL_LOG_SOURCES = [
  'emails',
] as const satisfies readonly OperationalLogSource[];

export const OPERATIONAL_LOG_CODES = [
  'email.delivery.sent',
  'email.delivery.failed',
] as const satisfies readonly OperationalLogCode[];

export type OperationalLogTableFilter = 'level' | 'source' | 'code' | 'user';

const USER_ID_REGEX = /^[A-Za-z0-9_-]{1,64}$/;

export const operationalLogTableQuery = defineTableQuery<OperationalLogTableFilter>({
  filters: {
    level: { param: 'level', values: OPERATIONAL_LOG_LEVELS, multiple: true },
    source: { param: 'source', values: OPERATIONAL_LOG_SOURCES, multiple: false },
    code: { param: 'code', values: OPERATIONAL_LOG_CODES, multiple: false },
    user: { param: 'userId', pattern: USER_ID_REGEX, multiple: false },
  },
});

export function buildOperationalLogsWhere(
  params: TableParams<OperationalLogTableFilter>,
): Prisma.OperationalLogWhereInput {
  const conditions: Prisma.OperationalLogWhereInput[] = [];
  const { level: levels, source: sources, code: codes, user: userIds } = params.filters;

  if (levels.length > 0) {
    conditions.push({ level: { in: levels } });
  }

  if (sources.length > 0) {
    conditions.push({ source: sources[0] });
  }

  if (codes.length > 0) {
    conditions.push({ code: codes[0] });
  }

  if (userIds.length > 0) {
    conditions.push({ userId: userIds[0] });
  }

  return conditions.length > 0 ? { AND: conditions } : {};
}
