import { expect, test } from '@playwright/test';
import {
  buildProfileQueryString,
  parseProfileSearchParams,
} from '../../lib/profile-query';

test.describe('profile query unit tests', () => {
  test('parse descarta valores inválidos y aplica defaults', () => {
    expect(
      parseProfileSearchParams({
        tab: 'invented',
        activityPage: '0',
        sessionsPage: 'abc',
        pageSize: '7',
      }),
    ).toEqual({
      tab: 'general',
      activityPage: 1,
      sessionsPage: 1,
      pageSize: 20,
    });
  });

  test('parse extrae el primer valor de arreglos y respeta valores válidos', () => {
    expect(
      parseProfileSearchParams({
        tab: ['activity', 'sessions'],
        activityPage: '3',
        pageSize: '50',
      }),
    ).toEqual({
      tab: 'activity',
      activityPage: 3,
      sessionsPage: 1,
      pageSize: 50,
    });
  });

  test('buildProfileQueryString omite defaults y serializa correctamente', () => {
    expect(buildProfileQueryString(parseProfileSearchParams({}))).toBe('');

    const qs = buildProfileQueryString({
      tab: 'sessions',
      activityPage: 1,
      sessionsPage: 2,
      pageSize: 100,
    });
    const searchParams = new URLSearchParams(qs);

    expect(searchParams.get('tab')).toBe('sessions');
    expect(searchParams.get('sessionsPage')).toBe('2');
    expect(searchParams.get('pageSize')).toBe('100');
    expect(searchParams.has('activityPage')).toBe(false);
  });
});
