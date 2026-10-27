import * as z from 'zod';
import { ACTIVITY_ACTIONS } from './activity-log-query';
import { defineTableQuery, type TableParams } from './table-query';

export const PROFILE_TABS = [
  'general',
  'security',
  'sessions',
  'activity',
] as const;

export type ProfileTab = (typeof PROFILE_TABS)[number];

export interface ProfileParams {
  tab: ProfileTab;
}

export type ProfileSearchParams = Record<
  string,
  string | string[] | undefined
>;

function firstValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export function parseProfileSearchParams(
  input: ProfileSearchParams,
): ProfileParams {
  const tabParsed = z.enum(PROFILE_TABS).safeParse(firstValue(input?.tab));

  return { tab: tabParsed.success ? tabParsed.data : 'general' };
}

export type ProfileActivityFilter = 'action';

// The page number lives in `activityPage`; `pageSize` is shared with the sessions tab.
export const profileActivityTableQuery = defineTableQuery<ProfileActivityFilter>({
  paramNames: { page: 'activityPage' },
  filters: {
    action: { param: 'action', values: ACTIVITY_ACTIONS, multiple: true },
  },
});

// Sessions have no search or filters; the page number lives in `sessionsPage`.
export type ProfileSessionsFilter = never;

export const profileSessionsTableQuery =
  defineTableQuery<ProfileSessionsFilter>({
    paramNames: { page: 'sessionsPage' },
    filters: {},
  });

/**
 * The profile URL for a tab with the page of each list. `pageSize` is shared by both
 * lists and the `action` filter belongs to the activity list.
 */
export function buildProfileQueryString(
  tab: ProfileTab,
  activity: TableParams<ProfileActivityFilter>,
  sessions: TableParams<ProfileSessionsFilter>,
): string {
  const searchParams = new URLSearchParams();
  if (tab !== 'general') searchParams.set('tab', tab);

  const lists = [
    {
      queryString: profileActivityTableQuery.toQueryString(activity),
      pageParam: profileActivityTableQuery.paramNames.page,
      page: activity.page,
    },
    {
      queryString: profileSessionsTableQuery.toQueryString(sessions),
      pageParam: profileSessionsTableQuery.paramNames.page,
      page: sessions.page,
    },
  ];

  for (const list of lists) {
    new URLSearchParams(list.queryString).forEach((value, key) => {
      if (key === list.pageParam && list.page === 1) return;
      // `pageSize` is shared: both lists write the same value.
      if (key === 'pageSize') searchParams.set(key, value);
      else searchParams.append(key, value);
    });
  }

  return searchParams.toString();
}
