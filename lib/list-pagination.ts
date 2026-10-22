import * as z from 'zod';

export const PAGE_SIZE_OPTIONS = [20, 50, 100] as const;
export type PageSize = (typeof PAGE_SIZE_OPTIONS)[number];
export const DEFAULT_PAGE_SIZE: PageSize = 20;

export const pageSizeSchema = z.union([z.literal(20), z.literal(50), z.literal(100)]);

export function parsePageSize(value: string | undefined): PageSize {
  if (value === '50') return 50;
  if (value === '100') return 100;
  return DEFAULT_PAGE_SIZE;
}
