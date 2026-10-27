import type { Prisma } from '@prisma/client';
import { defineTableQuery, type TableParams } from './table-query';

export const USER_SEARCH_MAX_LENGTH = 100;

export const USER_ROLES = ['admin', 'moderator', 'user'] as const;
export const USER_STATUSES = ['active', 'pending', 'inactive'] as const;
export const USER_PROVIDERS = ['email', 'google', 'github'] as const;

export type UserProviderFilter = (typeof USER_PROVIDERS)[number];
export type UserTableFilter = 'role' | 'status' | 'provider';

export const userTableQuery = defineTableQuery<UserTableFilter>({
  searchMaxLength: USER_SEARCH_MAX_LENGTH,
  filters: {
    role: { param: 'role', values: USER_ROLES, multiple: true },
    status: { param: 'status', values: USER_STATUSES, multiple: true },
    provider: { param: 'provider', values: USER_PROVIDERS, multiple: true },
  },
});

export function getDisplayedAuthProvider(
  providerIds: readonly string[],
): UserProviderFilter {
  if (providerIds.includes('google')) return 'google';
  if (providerIds.includes('github')) return 'github';
  return 'email';
}

export function buildUsersWhere(
  params: TableParams<UserTableFilter>,
): Prisma.UserWhereInput {
  const conditions: Prisma.UserWhereInput[] = [];
  const { role: roles, status: statuses, provider: providers } = params.filters;

  if (params.q) {
    conditions.push({
      OR: [
        { name: { contains: params.q, mode: 'insensitive' } },
        { email: { contains: params.q, mode: 'insensitive' } },
      ],
    });
  }

  if (roles.length > 0) {
    conditions.push({ role: { in: roles } });
  }

  if (statuses.length > 0) {
    const statusConditions: Prisma.UserWhereInput[] = [];

    if (statuses.includes('pending')) {
      statusConditions.push({
        OR: [{ emailVerified: false }, { status: 'pending' }],
      });
    }
    if (statuses.includes('active')) {
      statusConditions.push({ emailVerified: true, status: 'active' });
    }
    if (statuses.includes('inactive')) {
      statusConditions.push({ emailVerified: true, status: 'inactive' });
    }

    conditions.push({ OR: statusConditions });
  }

  if (providers.length > 0) {
    const providerConditions: Prisma.UserWhereInput[] = [];

    if (providers.includes('google')) {
      providerConditions.push({ accounts: { some: { providerId: 'google' } } });
    }
    if (providers.includes('github')) {
      providerConditions.push({
        AND: [
          { accounts: { none: { providerId: 'google' } } },
          { accounts: { some: { providerId: 'github' } } },
        ],
      });
    }
    if (providers.includes('email')) {
      providerConditions.push({
        accounts: { none: { providerId: { in: ['google', 'github'] } } },
      });
    }

    conditions.push({ OR: providerConditions });
  }

  return conditions.length > 0 ? { AND: conditions } : {};
}
