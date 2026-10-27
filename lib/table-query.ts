import * as z from 'zod';
import {
  DEFAULT_PAGE_SIZE,
  type PageSize,
  pageSizeSchema,
  parsePageSize,
} from './list-pagination';

export type TableFilterDefinition =
  | { param: string; values: readonly string[]; multiple: boolean }
  | { param: string; pattern: RegExp; multiple: false };

export interface TableParamNames {
  page: string;
  pageSize: string;
  q: string;
}

export interface TableQueryConfig<F extends string> {
  searchMaxLength?: number;
  /** URL names of the page, page size and search. Defaults to `page`, `pageSize` and `q`. */
  paramNames?: Partial<TableParamNames>;
  filters: Record<F, TableFilterDefinition>;
}

export interface TableParams<F extends string> {
  page: number;
  pageSize: PageSize;
  q: string;
  filters: Record<F, string[]>;
}

export type RawSearchParams = Record<string, string | string[] | undefined>;

export interface TableQuery<F extends string> {
  config: TableQueryConfig<F>;
  /** The URL names in use, with the defaults applied. */
  paramNames: TableParamNames;
  schema: z.ZodType<TableParams<F>>;
  parse(input: RawSearchParams): TableParams<F>;
  toQueryString(params: TableParams<F>): string;
  empty(pageSize?: PageSize): TableParams<F>;
}

const MAX_PAGE = 1_000_000_000;

const pageSchema = z.coerce.number().int().min(1).max(MAX_PAGE).catch(1);

function firstValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function allValues(value: string | string[] | undefined): string[] {
  if (Array.isArray(value)) return value;
  return value === undefined ? [] : [value];
}

function isAllowed(definition: TableFilterDefinition, value: string): boolean {
  if ('values' in definition) return definition.values.includes(value);
  return definition.pattern.test(value);
}

export function getTableRange(
  page: number,
  pageSize: number,
  total: number,
): { from: number; to: number } {
  if (total <= 0) return { from: 0, to: 0 };
  return {
    from: (page - 1) * pageSize + 1,
    to: Math.min(page * pageSize, total),
  };
}

export function defineTableQuery<F extends string>(
  config: TableQueryConfig<F>,
): TableQuery<F> {
  const filterKeys = Object.keys(config.filters) as F[];
  const paramNames: TableParamNames = {
    page: config.paramNames?.page ?? 'page',
    pageSize: config.paramNames?.pageSize ?? 'pageSize',
    q: config.paramNames?.q ?? 'q',
  };

  function parseFilter(key: F, input: RawSearchParams): string[] {
    const definition = config.filters[key];
    const valid = allValues(input[definition.param]).filter((value) =>
      isAllowed(definition, value),
    );
    const unique = [...new Set(valid)];
    return definition.multiple ? unique : unique.slice(0, 1);
  }

  const filterSchemas = Object.fromEntries(
    filterKeys.map((key) => {
      const definition = config.filters[key];
      const item = z
        .string()
        .refine((value) => isAllowed(definition, value), 'Invalid filter value');
      const list = z.array(item);
      return [key, definition.multiple ? list : list.max(1)];
    }),
  );

  const schema = z.object({
    page: z.number().int().min(1).max(MAX_PAGE),
    pageSize: pageSizeSchema,
    q: z.string().max(config.searchMaxLength ?? 0),
    filters: z.object(filterSchemas),
  }) as unknown as z.ZodType<TableParams<F>>;

  return {
    config,
    paramNames,
    schema,
    parse(input) {
      const rawSearch =
        config.searchMaxLength === undefined
          ? ''
          : (firstValue(input[paramNames.q]) ?? '').trim().slice(0, config.searchMaxLength);

      const filters = Object.fromEntries(
        filterKeys.map((key) => [key, parseFilter(key, input)]),
      ) as Record<F, string[]>;

      return {
        page: pageSchema.parse(firstValue(input[paramNames.page]) ?? 1),
        pageSize: parsePageSize(firstValue(input[paramNames.pageSize])),
        q: rawSearch,
        filters,
      };
    },
    toQueryString(params) {
      const searchParams = new URLSearchParams();
      searchParams.set(paramNames.page, String(params.page));
      if (params.pageSize !== DEFAULT_PAGE_SIZE) {
        searchParams.set(paramNames.pageSize, String(params.pageSize));
      }
      if (params.q) searchParams.set(paramNames.q, params.q);
      filterKeys.forEach((key) => {
        params.filters[key].forEach((value) =>
          searchParams.append(config.filters[key].param, value),
        );
      });
      return searchParams.toString();
    },
    empty(pageSize = DEFAULT_PAGE_SIZE) {
      return {
        page: 1,
        pageSize,
        q: '',
        filters: Object.fromEntries(
          filterKeys.map((key) => [key, [] as string[]]),
        ) as Record<F, string[]>,
      };
    },
  };
}
