import { expect, test } from '@playwright/test';
import { parsePageSize } from '../../lib/list-pagination';
import { buildUserListQueryString, parseUserListSearchParams } from '../../lib/user-list-query';
import {
  buildOperationalLogQueryString,
  parseOperationalLogSearchParams,
} from '../../lib/operational-log-query';

test('parsePageSize accepts only 20, 50 and 100', () => {
  expect(parsePageSize('20')).toBe(20);
  expect(parsePageSize('50')).toBe(50);
  expect(parsePageSize('100')).toBe(100);
  for (const value of [undefined, '', '7', 'abc', '-20', '100.5', '050', ' 50', '1000']) {
    expect(parsePageSize(value)).toBe(20);
  }
});

test('list parsers read pageSize and the first repeated value wins', () => {
  expect(parseUserListSearchParams({ pageSize: ['100', '20'] }).pageSize).toBe(100);
  expect(parseUserListSearchParams({ pageSize: '7' }).pageSize).toBe(20);
  expect(parseOperationalLogSearchParams({ pageSize: '50' }).pageSize).toBe(50);
  expect(parseOperationalLogSearchParams({}).pageSize).toBe(20);
});

test('query strings write pageSize only when it is not the default', () => {
  const users = parseUserListSearchParams({ page: '2', pageSize: '50' });
  expect(new URLSearchParams(buildUserListQueryString(users)).get('pageSize')).toBe('50');
  expect(
    new URLSearchParams(buildUserListQueryString({ ...users, pageSize: 20 })).has('pageSize'),
  ).toBe(false);

  const logs = parseOperationalLogSearchParams({ pageSize: '100' });
  expect(new URLSearchParams(buildOperationalLogQueryString(logs)).get('pageSize')).toBe('100');
});
