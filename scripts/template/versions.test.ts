import { describe, expect, test } from 'bun:test';
import { compareVersions, isVersion, majorOf, parseLsRemoteTags } from './versions';

describe('versions', () => {
  test('only X.Y.Z is a release', () => {
    expect(['1.2.3', '10.0.0'].every(isVersion)).toBe(true);
    expect(['v1.2.3', '1.2', '1.2.3-beta', 'latest', '1.2.3.4'].some(isVersion)).toBe(false);
  });

  test('compares numerically, not as text', () => {
    expect(['1.10.0', '1.9.0', '2.0.0', '1.9.10'].sort(compareVersions)).toEqual(['1.9.0', '1.9.10', '1.10.0', '2.0.0']);
    expect(compareVersions('1.2.3', '1.2.3')).toBe(0);
    expect(majorOf('12.0.1')).toBe(12);
  });

  test('ls-remote output: peeled commits win, other tags are ignored', () => {
    const output = [
      'aaaa\trefs/tags/1.0.0',
      'bbbb\trefs/tags/1.0.0^{}',
      'cccc\trefs/tags/1.1.0',
      'dddd\trefs/tags/v2.0.0',
      'eeee\trefs/tags/nightly',
      'ffff\trefs/heads/main',
      'gggg\trefs/tags/not-a-version^{}',
      '',
    ].join('\n');
    expect([...parseLsRemoteTags(output)]).toEqual([
      ['1.0.0', 'bbbb'],
      ['1.1.0', 'cccc'],
    ]);
  });
});
