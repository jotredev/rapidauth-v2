import { describe, expect, test } from 'bun:test';
import { readdirSync } from 'node:fs';
import { findBaseVersion, TEMP_REF_PREFIX } from './git';
import { InitError } from './types';
import { createGitRunner } from '../template/git';
import { GIT_ENV, TEMPLATE_ORIGIN, git, projectFrom, templateFixture } from './testkit';

describe('base version by identical tree', () => {
  const template = templateFixture();

  function find(sha: string) {
    const root = projectFrom(template, sha);
    return { root, run: () => findBaseVersion(createGitRunner(root, GIT_ENV), TEMPLATE_ORIGIN) };
  }

  test('a copy of a tagged commit gets that tag (annotated)', () => {
    expect(find(template.shas.c1).run()).toEqual({ baseCommit: template.shas.c1, version: '1.0.0' });
  });

  test('a copy of a lightweight-tagged commit gets that tag', () => {
    expect(find(template.shas.c2).run()).toEqual({ baseCommit: template.shas.c2, version: '1.1.0' });
  });

  test('a copy of a commit after the last tag keeps the tag it descends from', () => {
    expect(find(template.shas.c3).run()).toEqual({ baseCommit: template.shas.c3, version: '1.1.0' });
  });

  test('a copy from before every tag has no version', () => {
    expect(find(template.shas.c0).run()).toEqual({ baseCommit: template.shas.c0, version: null });
  });

  test('with several commits of the same content, the newest wins', () => {
    const repeated = templateFixture({ emptyCommitAtEnd: true });
    const root = projectFrom(repeated, repeated.shas.c3);
    const result = findBaseVersion(createGitRunner(root, GIT_ENV), TEMPLATE_ORIGIN);
    expect(result.baseCommit).toBe(repeated.shas.c4 as string);
  });

  test('no template commit with the same tree stops the init', () => {
    const root = projectFrom(template, template.shas.c3, { modified: true });
    expect(() => findBaseVersion(createGitRunner(root, GIT_ENV), TEMPLATE_ORIGIN)).toThrow(/does not match any published version/);
  });

  test('an unreachable template stops the init and says nothing was changed', () => {
    const root = projectFrom(template, template.shas.c3);
    git(root, 'config', 'url.file:///does/not/exist.git.insteadOf', TEMPLATE_ORIGIN);
    git(root, 'config', '--unset-all', `url.${template.url}.insteadOf`);
    let message = '';
    try {
      findBaseVersion(createGitRunner(root, GIT_ENV), TEMPLATE_ORIGIN);
    } catch (error) {
      expect(error instanceof InitError).toBe(true);
      message = (error as Error).message;
    }
    expect(message).toMatch(/Could not download the template history/);
  });

  test('temporary references and tags are always removed', () => {
    for (const modified of [false, true]) {
      const root = projectFrom(template, template.shas.c3, { modified });
      try {
        findBaseVersion(createGitRunner(root, GIT_ENV), TEMPLATE_ORIGIN);
      } catch {
        // Expected for the modified copy.
      }
      expect(git(root, 'for-each-ref', TEMP_REF_PREFIX)).toBe('');
      expect(git(root, 'tag')).toBe('');
      expect(git(root, 'for-each-ref', '--format=%(refname)')).toBe('refs/heads/main');
      expect(readdirSync(root).includes('.git')).toBe(true);
    }
  });
});
