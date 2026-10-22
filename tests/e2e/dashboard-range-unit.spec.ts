import { expect, test } from '@playwright/test';
import {
  getBucketKey,
  getRangeWindow,
  parseDashboardRange,
} from '../../lib/dashboard-range';

test.describe('dashboard range unit tests', () => {
  const now = new Date('2026-10-20T12:00:00Z');

  test('parseDashboardRange parses and falls back to default', () => {
    expect(parseDashboardRange('7d')).toBe('7d');
    expect(parseDashboardRange('foo')).toBe('30d');
    expect(parseDashboardRange(undefined)).toBe('30d');
    expect(parseDashboardRange(['12m', '7d'])).toBe('12m');
  });

  test('7d range window calculation', () => {
    const window = getRangeWindow('7d', now);
    expect(window.unit).toBe('day');
    expect(window.buckets).toHaveLength(7);
    expect(window.buckets[0].key).toBe('2026-10-14');
    expect(window.buckets[6].key).toBe('2026-10-20');
    expect(window.start.toISOString()).toBe('2026-10-14T00:00:00.000Z');
    expect(window.previousStart.toISOString()).toBe('2026-10-07T00:00:00.000Z');
  });

  test('30d range window calculation', () => {
    const window = getRangeWindow('30d', now);
    expect(window.unit).toBe('day');
    expect(window.buckets).toHaveLength(30);
    expect(window.buckets[0].key).toBe('2026-09-21');
    expect(window.buckets[29].key).toBe('2026-10-20');
  });

  test('90d range window calculation', () => {
    const window = getRangeWindow('90d', now);
    expect(window.unit).toBe('week');
    for (const bucket of window.buckets) {
      expect(bucket.start.getUTCDay()).toBe(1);
    }
    expect(window.buckets[0].key).toBe('2026-07-20');
    expect(window.buckets[window.buckets.length - 1].key).toBe('2026-10-19');
  });

  test('12m range window calculation', () => {
    const window = getRangeWindow('12m', now);
    expect(window.unit).toBe('month');
    expect(window.buckets).toHaveLength(12);
    expect(window.buckets[0].key).toBe('2025-11');
    expect(window.buckets[11].key).toBe('2026-10');
    expect(window.buckets[0].label).toBe('Nov 2025');
    expect(window.previousStart.toISOString()).toBe('2024-11-01T00:00:00.000Z');
  });

  test('getBucketKey for week starts on Monday', () => {
    expect(getBucketKey(new Date('2026-10-22T23:59:00Z'), 'week')).toBe('2026-10-19');
    expect(getBucketKey(new Date('2026-10-19T00:00:00Z'), 'week')).toBe('2026-10-19');
  });
});
