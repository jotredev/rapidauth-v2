import type { Prisma } from '@prisma/client';
import * as z from 'zod';
import type {
  OperationalLogLevel,
  OperationalLogSource,
  OperationalLogCode,
} from './operational-log';

export const OPERATIONAL_LOGS_PAGE_SIZE = 20;

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

export const operationalLogLevelSchema = z.enum(OPERATIONAL_LOG_LEVELS);
export const operationalLogSourceSchema = z.enum(OPERATIONAL_LOG_SOURCES);
export const operationalLogCodeSchema = z.enum(OPERATIONAL_LOG_CODES);

export interface OperationalLogListParams {
  page: number;
  levels: OperationalLogLevel[];
  source: OperationalLogSource | null;
  code: OperationalLogCode | null;
  userId: string | null;
}

export type OperationalLogSearchParams = Record<
  string,
  string | string[] | undefined
>;

const USER_ID_REGEX = /^[A-Za-z0-9_-]{1,64}$/;

export const operationalLogListParamsSchema = z.object({
  page: z.number().int().min(1),
  levels: z.array(operationalLogLevelSchema),
  source: operationalLogSourceSchema.nullable(),
  code: operationalLogCodeSchema.nullable(),
  userId: z.string().regex(USER_ID_REGEX).nullable(),
});

const rawSearchParamsSchema = z.object({
  page: z.union([z.string(), z.array(z.string())]).optional(),
  level: z.union([z.string(), z.array(z.string())]).optional(),
  source: z.union([z.string(), z.array(z.string())]).optional(),
  code: z.union([z.string(), z.array(z.string())]).optional(),
  userId: z.union([z.string(), z.array(z.string())]).optional(),
});

const pageSchema = z.coerce
  .number()
  .int()
  .min(1)
  .max(1_000_000_000)
  .catch(1);

function firstValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function allValues(value: string | string[] | undefined): string[] {
  if (Array.isArray(value)) return value;
  return value === undefined ? [] : [value];
}

function parseAllowedValues<T extends string>(
  values: string[],
  schema: z.ZodType<T>,
): T[] {
  const validValues = values.flatMap((value) => {
    const result = schema.safeParse(value);
    return result.success ? [result.data] : [];
  });

  return [...new Set(validValues)];
}

export function parseOperationalLogSearchParams(
  input: OperationalLogSearchParams,
): OperationalLogListParams {
  const result = rawSearchParamsSchema.safeParse(input);
  const raw = result.success ? result.data : {};

  const sourceParsed = operationalLogSourceSchema.safeParse(
    firstValue(raw.source),
  );
  const codeParsed = operationalLogCodeSchema.safeParse(firstValue(raw.code));
  const rawUserId = firstValue(raw.userId);
  const validUserId =
    typeof rawUserId === 'string' && USER_ID_REGEX.test(rawUserId)
      ? rawUserId
      : null;

  return {
    page: pageSchema.parse(firstValue(raw.page) ?? 1),
    levels: parseAllowedValues(allValues(raw.level), operationalLogLevelSchema),
    source: sourceParsed.success ? sourceParsed.data : null,
    code: codeParsed.success ? codeParsed.data : null,
    userId: validUserId,
  };
}

export function buildOperationalLogQueryString(
  params: OperationalLogListParams,
): string {
  const searchParams = new URLSearchParams();
  searchParams.set('page', String(params.page));

  params.levels.forEach((lvl) => searchParams.append('level', lvl));
  if (params.source) searchParams.set('source', params.source);
  if (params.code) searchParams.set('code', params.code);
  if (params.userId) searchParams.set('userId', params.userId);

  return searchParams.toString();
}

export function buildOperationalLogsWhere(
  params: OperationalLogListParams,
): Prisma.OperationalLogWhereInput {
  const conditions: Prisma.OperationalLogWhereInput[] = [];

  if (params.levels.length > 0) {
    conditions.push({ level: { in: params.levels } });
  }

  if (params.source) {
    conditions.push({ source: params.source });
  }

  if (params.code) {
    conditions.push({ code: params.code });
  }

  if (params.userId) {
    conditions.push({ userId: params.userId });
  }

  return conditions.length > 0 ? { AND: conditions } : {};
}
