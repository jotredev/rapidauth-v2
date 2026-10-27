import { describe, expect, test } from 'bun:test';
import {
  buildOperationalLogsWhere,
  operationalLogTableQuery,
} from './operational-log-query';

describe('operationalLogTableQuery', () => {
  test('reads the user filter from userId', () => {
    const result = operationalLogTableQuery.parse({
      userId: 'abc',
      source: 'emails',
    });
    expect(result.filters.user).toEqual(['abc']);
    expect(result.filters.source).toEqual(['emails']);
  });

  test('ignores an invalid user id', () => {
    expect(
      operationalLogTableQuery.parse({ userId: 'a b' }).filters.user,
    ).toEqual([]);
  });

  test('supports several levels and drops unknown ones', () => {
    const result = operationalLogTableQuery.parse({
      level: ['error', 'warn', 'bad'],
    });
    expect(result.filters.level).toEqual(['error', 'warn']);
  });

  test('has no search', () => {
    expect(operationalLogTableQuery.parse({ q: 'ana' }).q).toBe('');
  });

  test('keeps the existing parameter names in the query string', () => {
    const params = operationalLogTableQuery.parse({
      level: ['error', 'warn'],
      userId: 'abc',
      source: 'emails',
    });
    expect(operationalLogTableQuery.toQueryString(params)).toBe(
      'page=1&level=error&level=warn&source=emails&userId=abc',
    );
  });
});

describe('buildOperationalLogsWhere', () => {
  test('returns an empty filter without params', () => {
    expect(buildOperationalLogsWhere(operationalLogTableQuery.empty())).toEqual(
      {},
    );
  });

  test('filters by user and source with equality', () => {
    const params = operationalLogTableQuery.parse({
      userId: 'abc',
      source: 'emails',
    });
    expect(buildOperationalLogsWhere(params)).toEqual({
      AND: [{ source: 'emails' }, { userId: 'abc' }],
    });
  });

  test('filters by levels and code', () => {
    const params = operationalLogTableQuery.parse({
      level: ['error', 'critical'],
      code: 'email.delivery.failed',
    });
    expect(buildOperationalLogsWhere(params)).toEqual({
      AND: [
        { level: { in: ['error', 'critical'] } },
        { code: 'email.delivery.failed' },
      ],
    });
  });
});
