import { describe, expect, test } from 'bun:test';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { EXCLUSIONS_PATH, readExclusions } from './exclusions';

function withFile(content: string | null): string {
  const root = mkdtempSync(path.join(tmpdir(), 'exclusions-'));
  process.on('exit', () => rmSync(root, { recursive: true, force: true }));
  if (content !== null) {
    mkdirSync(path.join(root, '.setup'));
    writeFileSync(path.join(root, EXCLUSIONS_PATH), content);
  }
  return root;
}

describe('template exclusions file', () => {
  test('no file means no exclusions', () => {
    expect(readExclusions(withFile(null))).toEqual([]);
  });

  test('reads files and folders', () => {
    const root = withFile(JSON.stringify({ schemaVersion: 1, exclude: ['a/b.ts', 'dir/'] }));
    expect(readExclusions(root)).toEqual(['a/b.ts', 'dir/']);
  });

  test.each([
    ['not json', '{ nope'],
    ['wrong version', JSON.stringify({ schemaVersion: 2, exclude: [] })],
    ['extra key', JSON.stringify({ schemaVersion: 1, exclude: [], other: 1 })],
    ['not an array', JSON.stringify({ schemaVersion: 1, exclude: 'a' })],
    ['glob star', JSON.stringify({ schemaVersion: 1, exclude: ['a/*.ts'] })],
    ['glob brace', JSON.stringify({ schemaVersion: 1, exclude: ['a/{b,c}'] })],
    ['negation', JSON.stringify({ schemaVersion: 1, exclude: ['!a'] })],
    ['absolute', JSON.stringify({ schemaVersion: 1, exclude: ['/etc/passwd'] })],
    ['parent', JSON.stringify({ schemaVersion: 1, exclude: ['../x'] })],
    ['empty', JSON.stringify({ schemaVersion: 1, exclude: [''] })],
  ])('%s is rejected', (_name, content) => {
    expect(() => readExclusions(withFile(content))).toThrow();
  });
});
