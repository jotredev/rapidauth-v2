import { expect, test } from '@playwright/test';
import {
  buildOperationalLogQueryString,
  buildOperationalLogsWhere,
  parseOperationalLogSearchParams,
} from '../../lib/operational-log-query';

test.describe('operational log query unit tests', () => {
  test('parse descarta niveles desconocidos y deduplica', () => {
    const params = parseOperationalLogSearchParams({
      level: ['info', 'invalid-level', 'info', 'warn', 'another-bad', 'error', 'critical', 'warn'],
    });

    expect(params.levels).toEqual(['info', 'warn', 'error', 'critical']);
  });

  test('un userId inválido queda en null', () => {
    const invalidUserIds = [
      'user with spaces',
      'invalid@email.com',
      'user$special*chars!',
      '',
      'a'.repeat(65),
      '../traversal',
    ];

    for (const userId of invalidUserIds) {
      const parsed = parseOperationalLogSearchParams({ userId });
      expect(parsed.userId).toBeNull();
    }

    const validUserIds = ['usr_123', 'user-456_ABC', 'CUID1234567890'];
    for (const userId of validUserIds) {
      const parsed = parseOperationalLogSearchParams({ userId });
      expect(parsed.userId).toBe(userId);
    }
  });

  test('page inválido pasa a 1', () => {
    const invalidPages = ['not-a-number', '-5', '0', '', '1.5'];

    for (const page of invalidPages) {
      const parsed = parseOperationalLogSearchParams({ page });
      expect(parsed.page).toBe(1);
    }

    const validParsed = parseOperationalLogSearchParams({ page: '5' });
    expect(validParsed.page).toBe(5);
  });

  test('buildOperationalLogsWhere traduce cada filtro', () => {
    // Empty filters
    expect(
      buildOperationalLogsWhere({
        page: 1,
        pageSize: 20,
        levels: [],
        source: null,
        code: null,
        userId: null,
      }),
    ).toEqual({});

    // Individual filters
    expect(
      buildOperationalLogsWhere({
        page: 1,
        pageSize: 20,
        levels: ['error', 'critical'],
        source: null,
        code: null,
        userId: null,
      }),
    ).toEqual({
      AND: [{ level: { in: ['error', 'critical'] } }],
    });

    expect(
      buildOperationalLogsWhere({
        page: 1,
        pageSize: 20,
        levels: [],
        source: 'emails',
        code: null,
        userId: null,
      }),
    ).toEqual({
      AND: [{ source: 'emails' }],
    });

    expect(
      buildOperationalLogsWhere({
        page: 1,
        pageSize: 20,
        levels: [],
        source: null,
        code: 'email.delivery.sent',
        userId: null,
      }),
    ).toEqual({
      AND: [{ code: 'email.delivery.sent' }],
    });

    expect(
      buildOperationalLogsWhere({
        page: 1,
        pageSize: 20,
        levels: [],
        source: null,
        code: null,
        userId: 'usr_xyz',
      }),
    ).toEqual({
      AND: [{ userId: 'usr_xyz' }],
    });

    // All combined filters
    expect(
      buildOperationalLogsWhere({
        page: 1,
        pageSize: 20,
        levels: ['info'],
        source: 'emails',
        code: 'email.delivery.sent',
        userId: 'usr_xyz',
      }),
    ).toEqual({
      AND: [
        { level: { in: ['info'] } },
        { source: 'emails' },
        { code: 'email.delivery.sent' },
        { userId: 'usr_xyz' },
      ],
    });
  });

  test('buildOperationalLogQueryString deja de nuevo los mismos parámetros que parse', () => {
    const originalParams = {
      page: 3,
      pageSize: 20 as const,
      levels: ['warn', 'error'] as const,
      source: 'emails' as const,
      code: 'email.delivery.failed' as const,
      userId: 'usr_test_123',
    };

    const qs = buildOperationalLogQueryString({
      page: originalParams.page,
      pageSize: originalParams.pageSize,
      levels: [...originalParams.levels],
      source: originalParams.source,
      code: originalParams.code,
      userId: originalParams.userId,
    });

    const searchParams = new URLSearchParams(qs);
    const parsedAgain = parseOperationalLogSearchParams({
      page: searchParams.get('page') ?? undefined,
      pageSize: searchParams.get('pageSize') ?? undefined,
      level: searchParams.getAll('level'),
      source: searchParams.get('source') ?? undefined,
      code: searchParams.get('code') ?? undefined,
      userId: searchParams.get('userId') ?? undefined,
    });

    expect(parsedAgain).toEqual({
      page: originalParams.page,
      pageSize: 20,
      levels: originalParams.levels,
      source: originalParams.source,
      code: originalParams.code,
      userId: originalParams.userId,
    });
  });
});
