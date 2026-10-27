import { describe, expect, test } from 'bun:test';
import {
  defineTableQuery,
  getTableRange,
  type RawSearchParams,
  type TableParams,
} from './table-query';

const query = defineTableQuery({
  searchMaxLength: 100,
  filters: {
    role: { param: 'role', values: ['admin', 'user'], multiple: true },
    source: { param: 'source', values: ['emails', 'auth'], multiple: false },
    user: { param: 'userId', pattern: /^[A-Za-z0-9_-]{1,64}$/, multiple: false },
  },
});

const noSearchQuery = defineTableQuery({
  filters: {
    role: { param: 'role', values: ['admin', 'user'], multiple: true },
  },
});

describe('defineTableQuery parse', () => {
  test('returns defaults for empty input', () => {
    expect(query.parse({})).toEqual({
      page: 1,
      pageSize: 20,
      q: '',
      filters: { role: [], source: [], user: [] },
    });
  });

  test('falls back on invalid page and page size', () => {
    const result = query.parse({ page: 'abc', pageSize: '7' });
    expect(result.page).toBe(1);
    expect(result.pageSize).toBe(20);
  });

  test('accepts valid page and page size', () => {
    const result = query.parse({ page: '3', pageSize: '50' });
    expect(result.page).toBe(3);
    expect(result.pageSize).toBe(50);
  });

  test('trims and truncates the search text', () => {
    expect(query.parse({ q: '  ana  ' }).q).toBe('ana');
    expect(query.parse({ q: 'a'.repeat(150) }).q).toHaveLength(100);
  });

  test('ignores search when the list has no search box', () => {
    expect(noSearchQuery.parse({ q: 'ana' }).q).toBe('');
  });

  test('keeps valid unique values of multiple filters', () => {
    const result = query.parse({ role: ['admin', 'bad', 'admin', 'user'] });
    expect(result.filters.role).toEqual(['admin', 'user']);
  });

  test('keeps only the first valid value of single filters', () => {
    const result = query.parse({ source: ['bad', 'auth', 'emails'] });
    expect(result.filters.source).toEqual(['auth']);
  });

  test('reads pattern filters through their own parameter name', () => {
    const result = query.parse({ userId: 'abc', source: 'emails' });
    expect(result.filters.user).toEqual(['abc']);
    expect(result.filters.source).toEqual(['emails']);
    expect(query.parse({ userId: 'a b' }).filters.user).toEqual([]);
  });
});

describe('defineTableQuery toQueryString', () => {
  const params: TableParams<'role' | 'source' | 'user'> = {
    page: 2,
    pageSize: 20,
    q: 'ana',
    filters: { role: ['admin', 'user'], source: [], user: ['abc'] },
  };

  test('writes page always and the rest only when needed', () => {
    expect(query.toQueryString(params)).toBe(
      'page=2&q=ana&role=admin&role=user&userId=abc',
    );
    expect(query.toQueryString(query.empty())).toBe('page=1');
    expect(query.toQueryString({ ...query.empty(), pageSize: 50 })).toBe(
      'page=1&pageSize=50',
    );
  });

  test('round-trips through URLSearchParams', () => {
    const raw: RawSearchParams = {};
    new URLSearchParams(query.toQueryString(params)).forEach((value, key) => {
      const current = raw[key];
      if (current === undefined) raw[key] = value;
      else raw[key] = [...(Array.isArray(current) ? current : [current]), value];
    });
    expect(query.parse(raw)).toEqual(params);
  });
});

describe('defineTableQuery schema and empty', () => {
  test('schema rejects a filter value outside the allowed list', () => {
    const bad = {
      ...query.empty(),
      filters: { role: ['nope'], source: [], user: [] },
    };
    expect(query.schema.safeParse(bad).success).toBe(false);
  });

  test('schema accepts empty()', () => {
    expect(query.schema.safeParse(query.empty()).success).toBe(true);
  });
});

describe('getTableRange', () => {
  test('returns zeros when there are no rows', () => {
    expect(getTableRange(1, 20, 0)).toEqual({ from: 0, to: 0 });
  });

  test('returns the range of a partial last page', () => {
    expect(getTableRange(3, 20, 45)).toEqual({ from: 41, to: 45 });
  });
});

describe('defineTableQuery paramNames', () => {
  const named = defineTableQuery({
    searchMaxLength: 50,
    paramNames: { page: 'activityPage', q: 'search' },
    filters: {
      role: { param: 'role', values: ['admin', 'user'], multiple: true },
    },
  });

  test('exposes the defaults when none are given', () => {
    expect(query.paramNames).toEqual({ page: 'page', pageSize: 'pageSize', q: 'q' });
  });

  test('fills the names that were not overridden', () => {
    expect(named.paramNames).toEqual({
      page: 'activityPage',
      pageSize: 'pageSize',
      q: 'search',
    });
  });

  test('parse reads the custom names and ignores the default ones', () => {
    const result = named.parse({
      activityPage: '3',
      search: ' hi ',
      page: '9',
      q: 'no',
      role: 'admin',
    });
    expect(result.page).toBe(3);
    expect(result.q).toBe('hi');
    expect(result.filters.role).toEqual(['admin']);
  });

  test('toQueryString writes the custom names and round-trips', () => {
    const params: TableParams<'role'> = {
      page: 2,
      pageSize: 50,
      q: 'hi',
      filters: { role: ['admin'] },
    };
    const qs = named.toQueryString(params);
    expect(qs).toBe('activityPage=2&pageSize=50&search=hi&role=admin');
    const raw: RawSearchParams = {};
    new URLSearchParams(qs).forEach((value, key) => {
      raw[key] = [...(raw[key] ?? []), value];
    });
    expect(named.parse(raw)).toEqual(params);
  });
});
