import type { Prisma } from '@prisma/client';
import * as z from 'zod';
import {
  DEFAULT_PAGE_SIZE,
  type PageSize,
  pageSizeSchema,
  parsePageSize,
} from './list-pagination';
import type { ActivityAction } from './activity-log';

export type { ActivityAction };

export const ACTIVITY_SEARCH_MAX_LENGTH = 100;

export const ACTIVITY_ACTIONS = [
  'login',
  'logout',
  'register',
  'profile_update',
  'password_change',
  'email_change',
  'avatar_change',
  '2fa_enabled',
  '2fa_disabled',
  '2fa_verified',
  'email_verified',
  'oauth_login',
  'oauth_link',
  'terms_accepted',
  'invitation_accepted',
  'session_revoked',
] as const satisfies readonly ActivityAction[];

// Compile-time check: every ActivityAction must be listed above.
type MissingActivityActions = Exclude<ActivityAction, (typeof ACTIVITY_ACTIONS)[number]>;
const allActivityActionsListed: MissingActivityActions extends never ? true : never = true;
void allActivityActionsListed;

export const activityActionSchema = z.enum(ACTIVITY_ACTIONS);

export interface ActivityLogListParams {
  page: number;
  pageSize: PageSize;
  q: string;
  actions: ActivityAction[];
}

export type ActivityLogSearchParams = Record<
  string,
  string | string[] | undefined
>;

export const activityLogListParamsSchema: z.ZodType<ActivityLogListParams> = z.object({
  page: z.number().int().min(1),
  pageSize: pageSizeSchema,
  q: z.string().max(ACTIVITY_SEARCH_MAX_LENGTH),
  actions: z.array(activityActionSchema),
});

const rawSearchParamsSchema = z.object({
  page: z.union([z.string(), z.array(z.string())]).optional(),
  pageSize: z.union([z.string(), z.array(z.string())]).optional(),
  q: z.union([z.string(), z.array(z.string())]).optional(),
  action: z.union([z.string(), z.array(z.string())]).optional(),
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

export function parseActivityLogSearchParams(
  input: ActivityLogSearchParams,
): ActivityLogListParams {
  const result = rawSearchParamsSchema.safeParse(input);
  const raw = result.success ? result.data : {};
  const rawQ = firstValue(raw.q);
  const q =
    typeof rawQ === 'string'
      ? rawQ.trim().slice(0, ACTIVITY_SEARCH_MAX_LENGTH)
      : '';

  return {
    page: pageSchema.parse(firstValue(raw.page) ?? 1),
    pageSize: parsePageSize(firstValue(raw.pageSize)),
    q,
    actions: parseAllowedValues(allValues(raw.action), activityActionSchema),
  };
}

export function buildActivityLogQueryString(
  params: ActivityLogListParams,
): string {
  const searchParams = new URLSearchParams();
  searchParams.set('page', String(params.page));
  if (params.pageSize !== DEFAULT_PAGE_SIZE) {
    searchParams.set('pageSize', String(params.pageSize));
  }
  if (params.q.length > 0) {
    searchParams.set('q', params.q);
  }
  params.actions.forEach((act) => searchParams.append('action', act));

  return searchParams.toString();
}

export function buildActivityLogWhere(
  params: ActivityLogListParams,
): Prisma.ActivityLogWhereInput {
  const conditions: Prisma.ActivityLogWhereInput[] = [];

  if (params.q.length > 0) {
    conditions.push({
      OR: [
        { user: { name: { contains: params.q, mode: 'insensitive' } } },
        { user: { email: { contains: params.q, mode: 'insensitive' } } },
        { action: { contains: params.q, mode: 'insensitive' } },
        { ipAddress: { contains: params.q, mode: 'insensitive' } },
      ],
    });
  }

  if (params.actions.length > 0) {
    conditions.push({
      action: { in: params.actions },
    });
  }

  return conditions.length > 0 ? { AND: conditions } : {};
}
