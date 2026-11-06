import { describe, expect, test } from 'bun:test';
import { mergeText } from './merge-text';
import { GIT_ENV, tempDir } from './testkit';
import { createGitRunner } from './git';

const git = createGitRunner(tempDir(), GIT_ENV);
const labels = { baseLabel: 'template 1.0.0', nextLabel: 'template 1.1.0' };

describe('mergeText', () => {
  test('merges changes in different places', () => {
    const result = mergeText(git, { project: 'A\nb\nc\nd\ne\nf\ng\n', base: 'a\nb\nc\nd\ne\nf\ng\n', next: 'a\nb\nc\nd\ne\nf\nG\n', ...labels });
    expect(result).toEqual({ text: 'A\nb\nc\nd\ne\nf\nG\n', conflicts: 0 });
  });

  test('counts conflicting regions and labels the three sides', () => {
    const result = mergeText(git, { project: 'x\n', base: 'o\n', next: 'y\n', ...labels });
    expect(result.conflicts).toBe(1);
    expect(result.text).toBe('<<<<<<< project\nx\n||||||| template 1.0.0\no\n=======\ny\n>>>>>>> template 1.1.0\n');
  });

  test('a file added on both sides is merged against an empty base', () => {
    expect(mergeText(git, { project: 'same\n', base: '', next: 'same\n', ...labels }).conflicts).toBe(0);
    expect(mergeText(git, { project: 'one\n', base: '', next: 'two\n', ...labels }).conflicts).toBe(1);
  });
});
