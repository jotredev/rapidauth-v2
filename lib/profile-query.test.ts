import { describe, expect, test } from 'bun:test';
import {
  buildProfileQueryString,
  parseProfileSearchParams,
  profileActivityTableQuery,
  profileSessionsTableQuery,
} from './profile-query';

describe('profileActivityTableQuery', () => {
  test('reads activityPage and keeps only valid actions', () => {
    const params = profileActivityTableQuery.parse({
      tab: 'activity',
      activityPage: '2',
      action: ['login', 'x'],
    });
    expect(params.page).toBe(2);
    expect(params.filters.action).toEqual(['login']);
    expect(params.q).toBe('');
  });

  test('ignores the plain page parameter', () => {
    expect(profileActivityTableQuery.parse({ page: '5' }).page).toBe(1);
  });

  test('writes activityPage and leaves tab and sessionsPage out', () => {
    const qs = profileActivityTableQuery.toQueryString(
      profileActivityTableQuery.parse({ activityPage: '2', action: 'login' }),
    );
    expect(qs).toBe('activityPage=2&action=login');
  });

  test('has no search', () => {
    expect(profileActivityTableQuery.config.searchMaxLength).toBe(undefined);
  });
});

describe('profileSessionsTableQuery', () => {
  test('reads sessionsPage and has no search or filters', () => {
    const params = profileSessionsTableQuery.parse({
      tab: 'sessions',
      sessionsPage: '3',
      pageSize: '50',
    });
    expect(params.page).toBe(3);
    expect(params.pageSize).toBe(50);
    expect(params.q).toBe('');
    expect(params.filters).toEqual({});
    expect(profileSessionsTableQuery.config.searchMaxLength).toBe(undefined);
  });

  test('ignores the plain page and activityPage parameters', () => {
    expect(
      profileSessionsTableQuery.parse({ page: '5', activityPage: '4' }).page,
    ).toBe(1);
  });

  test('writes sessionsPage and leaves tab and activityPage out', () => {
    const qs = profileSessionsTableQuery.toQueryString(
      profileSessionsTableQuery.parse({ sessionsPage: '2', activityPage: '4' }),
    );
    expect(qs).toBe('sessionsPage=2');
  });

  test('rejects pages out of range in the schema', () => {
    expect(
      profileSessionsTableQuery.schema.safeParse({
        page: 0,
        pageSize: 20,
        q: '',
        filters: {},
      }).success,
    ).toBe(false);
  });
});

describe('profile list links', () => {
  const raw = {
    tab: 'sessions',
    activityPage: '2',
    sessionsPage: '3',
    pageSize: '50',
    action: ['login'],
  };

  test('tab, activityPage and sessionsPage live together in one URL', () => {
    expect(parseProfileSearchParams(raw).tab).toBe('sessions');
    expect(profileActivityTableQuery.parse(raw)).toMatchObject({
      page: 2,
      pageSize: 50,
      filters: { action: ['login'] },
    });
    expect(profileSessionsTableQuery.parse(raw)).toMatchObject({
      page: 3,
      pageSize: 50,
    });
  });

  test('keeps the existing links working', () => {
    expect(parseProfileSearchParams({ tab: 'sessions', sessionsPage: '2' }).tab).toBe(
      'sessions',
    );
    expect(profileSessionsTableQuery.parse({ sessionsPage: '2' }).page).toBe(2);
    expect(profileActivityTableQuery.parse({ activityPage: '2' }).page).toBe(2);
    expect(parseProfileSearchParams({ tab: 'security' }).tab).toBe('security');
    expect(parseProfileSearchParams({ tab: 'nope' }).tab).toBe('general');
    expect(parseProfileSearchParams({ tab: ['activity', 'x'] }).tab).toBe('activity');
  });

  test('builds the corrected URL keeping tab, pageSize and action filters', () => {
    const qs = buildProfileQueryString(
      'sessions',
      profileActivityTableQuery.parse({ ...raw, activityPage: '1' }),
      profileSessionsTableQuery.parse({ ...raw, sessionsPage: '2' }),
    );
    expect(Object.fromEntries(new URLSearchParams(qs))).toMatchObject({
      tab: 'sessions',
      sessionsPage: '2',
      pageSize: '50',
      action: 'login',
    });
    expect(qs).not.toContain('activityPage');
  });

  test('builds an empty query for the first page of the general tab', () => {
    expect(
      buildProfileQueryString(
        'general',
        profileActivityTableQuery.empty(),
        profileSessionsTableQuery.empty(),
      ),
    ).toBe('');
  });

  test('the corrected URL parses back to the same params', () => {
    const activity = profileActivityTableQuery.parse(raw);
    const sessions = profileSessionsTableQuery.parse(raw);
    const back = Object.fromEntries(
      [...new URLSearchParams(buildProfileQueryString('sessions', activity, sessions))].map(
        ([k, v]) => [k, v],
      ),
    );
    expect(profileActivityTableQuery.parse(back)).toEqual(activity);
    expect(profileSessionsTableQuery.parse(back)).toEqual(sessions);
  });
});
