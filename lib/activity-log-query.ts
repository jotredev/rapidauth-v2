import type { Prisma } from '@prisma/client';
import * as z from 'zod';
import { defineTableQuery, type TableParams } from './table-query';
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

export type ActivityTableFilter = 'action';

export const activityLogTableQuery = defineTableQuery<ActivityTableFilter>({
  searchMaxLength: ACTIVITY_SEARCH_MAX_LENGTH,
  filters: {
    action: { param: 'action', values: ACTIVITY_ACTIONS, multiple: true },
  },
});

export function buildActivityLogWhere(
  params: TableParams<ActivityTableFilter>,
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

  if (params.filters.action.length > 0) {
    conditions.push({
      action: { in: params.filters.action },
    });
  }

  return conditions.length > 0 ? { AND: conditions } : {};
}
