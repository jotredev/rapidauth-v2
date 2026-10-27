import { describe, expect, test } from 'bun:test';
import {
  buildUsersWhere,
  getDisplayedAuthProvider,
  userTableQuery,
} from './user-list-query';

describe('userTableQuery', () => {
  test('parses valid filters and drops unknown values', () => {
    const result = userTableQuery.parse({
      role: 'admin',
      status: ['active', 'x'],
      provider: 'github',
    });
    expect(result.filters).toEqual({
      role: ['admin'],
      status: ['active'],
      provider: ['github'],
    });
  });

  test('keeps the existing parameter names in the query string', () => {
    const params = userTableQuery.parse({
      page: '2',
      q: 'ana',
      role: ['admin', 'user'],
      provider: 'google',
    });
    expect(userTableQuery.toQueryString(params)).toBe(
      'page=2&q=ana&role=admin&role=user&provider=google',
    );
  });

  test('limits the search text to 100 characters', () => {
    expect(userTableQuery.parse({ q: 'a'.repeat(150) }).q).toHaveLength(100);
  });
});

describe('buildUsersWhere', () => {
  test('returns an empty filter without params', () => {
    expect(buildUsersWhere(userTableQuery.empty())).toEqual({});
  });

  test('filters by role', () => {
    const params = userTableQuery.parse({ role: 'admin' });
    expect(buildUsersWhere(params)).toEqual({
      AND: [{ role: { in: ['admin'] } }],
    });
  });

  test('searches name and email without case sensitivity', () => {
    const params = userTableQuery.parse({ q: 'ana' });
    expect(buildUsersWhere(params)).toEqual({
      AND: [
        {
          OR: [
            { name: { contains: 'ana', mode: 'insensitive' } },
            { email: { contains: 'ana', mode: 'insensitive' } },
          ],
        },
      ],
    });
  });

  test('pending status includes unverified emails', () => {
    const params = userTableQuery.parse({ status: 'pending' });
    expect(buildUsersWhere(params)).toEqual({
      AND: [{ OR: [{ OR: [{ emailVerified: false }, { status: 'pending' }] }] }],
    });
  });
});

describe('getDisplayedAuthProvider', () => {
  test('prefers google, then github, then email', () => {
    expect(getDisplayedAuthProvider(['github', 'google'])).toBe('google');
    expect(getDisplayedAuthProvider(['github'])).toBe('github');
    expect(getDisplayedAuthProvider(['credential'])).toBe('email');
  });
});
