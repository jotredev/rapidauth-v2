import { expect, test } from '@playwright/test';
import {
  getColumnsCookieName,
  readHiddenColumns,
  serializeHiddenColumns,
} from '../../lib/table-columns';

test.describe('table columns unit tests', () => {
  test('readHiddenColumns filters invalid, required and duplicate ids and preserves table order', () => {
    expect(
      readHiddenColumns('users', 'lastActive.name.role.invented.role'),
    ).toEqual(['role', 'lastActive']);
  });

  test('readHiddenColumns returns empty array for undefined, empty or overly long values', () => {
    expect(readHiddenColumns('users', undefined)).toEqual([]);
    expect(readHiddenColumns('users', '')).toEqual([]);
    expect(readHiddenColumns('users', 'a'.repeat(201))).toEqual([]);
  });

  test('readHiddenColumns excludes required columns on system-logs', () => {
    expect(readHiddenColumns('system-logs', 'time.details')).toEqual(['details']);
  });

  test('serializeHiddenColumns and round trip with readHiddenColumns', () => {
    const hidden = ['role', 'lastActive'];
    const serialized = serializeHiddenColumns(hidden);
    expect(serialized).toBe('role.lastActive');
    expect(readHiddenColumns('users', serialized)).toEqual(hidden);
  });

  test('getColumnsCookieName returns the correct cookie name for activity', () => {
    expect(getColumnsCookieName('activity')).toBe('rapidauth-columns-activity');
  });
});
