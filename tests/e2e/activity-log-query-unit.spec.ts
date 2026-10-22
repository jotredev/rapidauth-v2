import { expect, test } from '@playwright/test';
import {
  buildActivityLogQueryString,
  buildActivityLogWhere,
  parseActivityLogSearchParams,
} from '../../lib/activity-log-query';
import type { ActivityAction } from '../../lib/activity-log';

test.describe('activity log query unit tests', () => {
  test('parse ignores invalid values and keeps the first repeated ones', () => {
    const result = parseActivityLogSearchParams({
      page: 'abc',
      pageSize: '7',
      q: '  hello  ',
      action: ['login', 'invented', 'login', 'logout'],
    });

    expect(result).toEqual({
      page: 1,
      pageSize: 20,
      q: 'hello',
      actions: ['login', 'logout'],
    });

    const longQuery = 'a'.repeat(120);
    const withLongQ = parseActivityLogSearchParams({ q: longQuery });
    expect(withLongQ.q).toBe('a'.repeat(100));
    expect(withLongQ.q.length).toBe(100);
  });

  test('query string round-trips through parse', () => {
    const original = {
      page: 3,
      pageSize: 50 as const,
      q: 'ana',
      actions: ['login', '2fa_enabled'] as ActivityAction[],
    };

    const qs = buildActivityLogQueryString(original);
    const searchParams = new URLSearchParams(qs);
    const parsed = parseActivityLogSearchParams({
      page: searchParams.get('page') ?? undefined,
      pageSize: searchParams.get('pageSize') ?? undefined,
      q: searchParams.get('q') ?? undefined,
      action: searchParams.getAll('action'),
    });

    expect(parsed).toEqual(original);

    const qsDefault = buildActivityLogQueryString({
      page: 1,
      pageSize: 20,
      q: '',
      actions: [],
    });
    const defaultParams = new URLSearchParams(qsDefault);
    expect(defaultParams.has('pageSize')).toBe(false);
    expect(defaultParams.has('q')).toBe(false);
  });

  test('where translates search and actions', () => {
    expect(
      buildActivityLogWhere({
        page: 1,
        pageSize: 20,
        q: '',
        actions: [],
      }),
    ).toEqual({});

    expect(
      buildActivityLogWhere({
        page: 1,
        pageSize: 20,
        q: 'ana',
        actions: ['login'],
      }),
    ).toEqual({
      AND: [
        {
          OR: [
            { user: { name: { contains: 'ana', mode: 'insensitive' } } },
            { user: { email: { contains: 'ana', mode: 'insensitive' } } },
            { action: { contains: 'ana', mode: 'insensitive' } },
            { ipAddress: { contains: 'ana', mode: 'insensitive' } },
          ],
        },
        {
          action: { in: ['login'] },
        },
      ],
    });
  });
});
