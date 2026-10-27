import { describe, expect, test } from 'bun:test';
import { readHiddenColumns } from './table-columns';

describe('readHiddenColumns', () => {
  test('splits the cookie value by dots', () => {
    expect(readHiddenColumns('role.status')).toEqual(['role', 'status']);
  });

  test('returns an empty list without a cookie', () => {
    expect(readHiddenColumns(undefined)).toEqual([]);
  });

  test('ignores values longer than 200 characters', () => {
    expect(readHiddenColumns('a'.repeat(201))).toEqual([]);
  });

  test('drops ids with characters outside [A-Za-z0-9_-]', () => {
    expect(readHiddenColumns('role.b@d.st atus.ok_1-x')).toEqual(['role', 'ok_1-x']);
  });

  test('removes duplicates', () => {
    expect(readHiddenColumns('role.role.status')).toEqual(['role', 'status']);
  });
});
