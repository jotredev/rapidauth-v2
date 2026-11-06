import { describe, expect, test } from 'bun:test';
import { normalizeGitUrl, sameGitUrl } from './git';

describe('git URL comparison', () => {
  test.each([
    ['https://github.com/Owner/Repo.git', 'github.com/owner/repo'],
    ['https://github.com/owner/repo/', 'github.com/owner/repo'],
    ['git@github.com:owner/repo.git', 'github.com/owner/repo'],
    ['ssh://git@github.com/owner/repo', 'github.com/owner/repo'],
    ['https://user:token@github.com/owner/repo.git', 'github.com/owner/repo'],
    ['file:///tmp/template.git', '/tmp/template'],
  ])('%s', (url, expected) => {
    expect(normalizeGitUrl(url)).toBe(expected);
  });

  test('different spellings of one repository are the same', () => {
    expect(sameGitUrl('git@github.com:Owner/Repo.git', 'https://github.com/owner/repo/')).toBe(true);
    expect(sameGitUrl('https://github.com/owner/repo', 'https://github.com/owner/other')).toBe(false);
  });
});
