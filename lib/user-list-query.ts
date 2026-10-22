import type { Prisma } from '@prisma/client';
import * as z from 'zod';
import {
  DEFAULT_PAGE_SIZE,
  type PageSize,
  pageSizeSchema,
  parsePageSize,
} from './list-pagination';

export const USER_SEARCH_MAX_LENGTH = 100;

export const USER_ROLES = ['admin', 'moderator', 'user'] as const;
export const USER_STATUSES = ['active', 'pending', 'inactive'] as const;
export const USER_PROVIDERS = ['email', 'google', 'github'] as const;

const userRoleSchema = z.enum(USER_ROLES);
const userStatusSchema = z.enum(USER_STATUSES);
const userProviderSchema = z.enum(USER_PROVIDERS);

export type UserRoleFilter = z.infer<typeof userRoleSchema>;
export type UserStatusFilter = z.infer<typeof userStatusSchema>;
export type UserProviderFilter = z.infer<typeof userProviderSchema>;

export interface UserListParams {
  page: number;
  pageSize: PageSize;
  q: string;
  roles: UserRoleFilter[];
  statuses: UserStatusFilter[];
  providers: UserProviderFilter[];
}

export type UserListSearchParams = Record<
  string,
  string | string[] | undefined
>;

export const userListParamsSchema = z.object({
  page: z.number().int().min(1),
  pageSize: pageSizeSchema,
  q: z.string().max(USER_SEARCH_MAX_LENGTH),
  roles: z.array(userRoleSchema),
  statuses: z.array(userStatusSchema),
  providers: z.array(userProviderSchema),
});

const rawSearchParamsSchema = z.object({
  page: z.union([z.string(), z.array(z.string())]).optional(),
  pageSize: z.union([z.string(), z.array(z.string())]).optional(),
  q: z.union([z.string(), z.array(z.string())]).optional(),
  role: z.union([z.string(), z.array(z.string())]).optional(),
  status: z.union([z.string(), z.array(z.string())]).optional(),
  provider: z.union([z.string(), z.array(z.string())]).optional(),
});

const pageSchema = z.coerce
  .number()
  .int()
  .min(1)
  .max(1_000_000_000)
  .catch(1);

const searchSchema = z.string().trim().transform((value) =>
  value.slice(0, USER_SEARCH_MAX_LENGTH),
);

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

export function parseUserListSearchParams(
  input: UserListSearchParams,
): UserListParams {
  const result = rawSearchParamsSchema.safeParse(input);
  const raw = result.success ? result.data : {};
  const rawSearch = firstValue(raw.q) ?? '';

  return {
    page: pageSchema.parse(firstValue(raw.page) ?? 1),
    pageSize: parsePageSize(firstValue(raw.pageSize)),
    q: searchSchema.parse(rawSearch),
    roles: parseAllowedValues(allValues(raw.role), userRoleSchema),
    statuses: parseAllowedValues(allValues(raw.status), userStatusSchema),
    providers: parseAllowedValues(allValues(raw.provider), userProviderSchema),
  };
}

export function buildUserListQueryString(params: UserListParams): string {
  const searchParams = new URLSearchParams();
  searchParams.set('page', String(params.page));
  if (params.pageSize !== DEFAULT_PAGE_SIZE) searchParams.set('pageSize', String(params.pageSize));

  if (params.q) searchParams.set('q', params.q);
  params.roles.forEach((role) => searchParams.append('role', role));
  params.statuses.forEach((status) => searchParams.append('status', status));
  params.providers.forEach((provider) =>
    searchParams.append('provider', provider),
  );

  return searchParams.toString();
}

export function getDisplayedAuthProvider(
  providerIds: readonly string[],
): UserProviderFilter {
  if (providerIds.includes('google')) return 'google';
  if (providerIds.includes('github')) return 'github';
  return 'email';
}

export function buildUsersWhere(
  params: UserListParams,
): Prisma.UserWhereInput {
  const conditions: Prisma.UserWhereInput[] = [];

  if (params.q) {
    conditions.push({
      OR: [
        { name: { contains: params.q, mode: 'insensitive' } },
        { email: { contains: params.q, mode: 'insensitive' } },
      ],
    });
  }

  if (params.roles.length > 0) {
    conditions.push({ role: { in: params.roles } });
  }

  if (params.statuses.length > 0) {
    const statusConditions: Prisma.UserWhereInput[] = [];

    if (params.statuses.includes('pending')) {
      statusConditions.push({
        OR: [{ emailVerified: false }, { status: 'pending' }],
      });
    }
    if (params.statuses.includes('active')) {
      statusConditions.push({ emailVerified: true, status: 'active' });
    }
    if (params.statuses.includes('inactive')) {
      statusConditions.push({ emailVerified: true, status: 'inactive' });
    }

    conditions.push({ OR: statusConditions });
  }

  if (params.providers.length > 0) {
    const providerConditions: Prisma.UserWhereInput[] = [];

    if (params.providers.includes('google')) {
      providerConditions.push({ accounts: { some: { providerId: 'google' } } });
    }
    if (params.providers.includes('github')) {
      providerConditions.push({
        AND: [
          { accounts: { none: { providerId: 'google' } } },
          { accounts: { some: { providerId: 'github' } } },
        ],
      });
    }
    if (params.providers.includes('email')) {
      providerConditions.push({
        accounts: { none: { providerId: { in: ['google', 'github'] } } },
      });
    }

    conditions.push({ OR: providerConditions });
  }

  return conditions.length > 0 ? { AND: conditions } : {};
}
