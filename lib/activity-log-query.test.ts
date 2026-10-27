import { describe, expect, test } from 'bun:test';
import {
  activityLogTableQuery,
  buildActivityLogWhere,
} from './activity-log-query';

describe('activityLogTableQuery', () => {
  test('keeps valid actions and drops unknown ones', () => {
    const result = activityLogTableQuery.parse({ action: ['login', 'nope'] });
    expect(result.filters.action).toEqual(['login']);
  });

  test('keeps the existing parameter names in the query string', () => {
    const params = activityLogTableQuery.parse({ action: 'login', q: 'ana' });
    expect(activityLogTableQuery.toQueryString(params)).toBe(
      'page=1&q=ana&action=login',
    );
  });

  test('limits the search text to 100 characters', () => {
    expect(activityLogTableQuery.parse({ q: 'a'.repeat(150) }).q).toHaveLength(
      100,
    );
  });
});

describe('buildActivityLogWhere', () => {
  test('returns an empty filter without params', () => {
    expect(buildActivityLogWhere(activityLogTableQuery.empty())).toEqual({});
  });

  test('filters by action', () => {
    const params = activityLogTableQuery.parse({ action: ['login', 'logout'] });
    expect(buildActivityLogWhere(params)).toEqual({
      AND: [{ action: { in: ['login', 'logout'] } }],
    });
  });

  test('searches user, email, action and IP without case sensitivity', () => {
    const params = activityLogTableQuery.parse({ q: 'ana' });
    expect(buildActivityLogWhere(params)).toEqual({
      AND: [
        {
          OR: [
            { user: { name: { contains: 'ana', mode: 'insensitive' } } },
            { user: { email: { contains: 'ana', mode: 'insensitive' } } },
            { action: { contains: 'ana', mode: 'insensitive' } },
            { ipAddress: { contains: 'ana', mode: 'insensitive' } },
          ],
        },
      ],
    });
  });
});
