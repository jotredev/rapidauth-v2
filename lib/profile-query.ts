import * as z from 'zod';
import {
  DEFAULT_PAGE_SIZE,
  type PageSize,
  pageSizeSchema,
  parsePageSize,
} from './list-pagination';

export const PROFILE_TABS = [
  'general',
  'security',
  'sessions',
  'activity',
] as const;

export type ProfileTab = (typeof PROFILE_TABS)[number];

export interface ProfileListParams {
  tab: ProfileTab;
  activityPage: number;
  sessionsPage: number;
  pageSize: PageSize;
}

export type ProfileSearchParams = Record<
  string,
  string | string[] | undefined
>;

export const profileListParamsSchema: z.ZodType<ProfileListParams> = z.object({
  tab: z.enum(PROFILE_TABS),
  activityPage: z.number().int().min(1),
  sessionsPage: z.number().int().min(1),
  pageSize: pageSizeSchema,
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

export function parseProfileSearchParams(
  input: ProfileSearchParams,
): ProfileListParams {
  const rawTab = firstValue(input?.tab);
  const tabParsed = z.enum(PROFILE_TABS).safeParse(rawTab);

  return {
    tab: tabParsed.success ? tabParsed.data : 'general',
    activityPage: pageSchema.parse(firstValue(input?.activityPage) ?? 1),
    sessionsPage: pageSchema.parse(firstValue(input?.sessionsPage) ?? 1),
    pageSize: parsePageSize(firstValue(input?.pageSize)),
  };
}

export function buildProfileQueryString(params: ProfileListParams): string {
  const searchParams = new URLSearchParams();

  if (params.tab !== 'general') {
    searchParams.set('tab', params.tab);
  }
  if (params.activityPage !== 1) {
    searchParams.set('activityPage', String(params.activityPage));
  }
  if (params.sessionsPage !== 1) {
    searchParams.set('sessionsPage', String(params.sessionsPage));
  }
  if (params.pageSize !== DEFAULT_PAGE_SIZE) {
    searchParams.set('pageSize', String(params.pageSize));
  }

  return searchParams.toString();
}
