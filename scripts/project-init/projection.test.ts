import { describe, expect, test } from 'bun:test';
import { readProjectMetadata } from '../template/metadata';
import { classifyPath } from '../template/paths';
import { projectTemplateTree } from '../template/projection';
import { readDiskEntry, sameEntry } from '../template/tree';
import { runInit } from './init';
import { readTrackedFiles } from './plan';
import { DEFAULT_FLAGS, git, projectFrom, setup, templateFixture } from './testkit';

const template = templateFixture();

/**
 * The invariant `template:pull` relies on: for every path of the *template* class, what the init leaves in the
 * project is exactly the projection of the template tree it started from. If the two ever drift, every pull would
 * show changes the person never made.
 */
describe('init output equals the projection of its base tree', () => {
  test.each([
    ['with a repository', 'acme/acme-portal'],
    ['without a repository', ''],
  ])('%s', async (_name, repo) => {
    const root = projectFrom(template, template.shas.c3);
    const baseTree = readTrackedFiles(root, setup(root).context.git);
    await runInit(setup(root, { flags: { ...DEFAULT_FLAGS, repo } }).context);

    const metadata = readProjectMetadata(root);
    if (metadata.mode !== 'initialized') throw new Error('unreachable');
    const projected = projectTemplateTree(baseTree, metadata);

    const onDisk = git(root, 'ls-files', '-z', '--cached', '--others', '--exclude-standard').split('\0').filter(Boolean);
    const paths = new Set([...projected.keys(), ...onDisk]);
    const travelling = [...paths].filter((file) => classifyPath(file) === 'template');
    expect(travelling.length).toBeGreaterThan(5);
    for (const file of travelling) {
      const actual = readDiskEntry(root, file);
      const expected = projected.get(file);
      if (!sameEntry(actual, expected)) {
        throw new Error(`${file} differs between the init output and the projection of the base tree.`);
      }
    }
    // Sanity: the renamed and reset content is really there.
    expect(projected.has('docs/en/acme-portal-guide.md')).toBe(true);
  });
});
