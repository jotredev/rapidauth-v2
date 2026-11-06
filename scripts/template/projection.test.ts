import { describe, expect, test } from 'bun:test';
import { INITIAL_VERSION, projectTemplateTree } from './projection';
import { ANSWERS, BASE_FILES, TemplateRepo, templateWithBase } from './testkit';
import type { TreeEntry } from './types';

function text(entry: TreeEntry | undefined): string {
  return typeof entry?.content === 'string' ? entry.content : new TextDecoder().decode(entry?.content as Uint8Array);
}

describe('projectTemplateTree', () => {
  const { repo, base } = templateWithBase();
  const tree = repo.tree(base);
  const projected = projectTemplateTree(tree, { template: repo.identity(), project: ANSWERS });

  test('drops the template-only paths', () => {
    expect([...projected.keys()].filter((file) => file.startsWith('scripts/project-init') || file.startsWith('docs/superpowers') || file.startsWith('.forge614'))).toEqual([]);
  });

  test('renames contents and paths, keeping links and modes', () => {
    expect(text(projected.get('docs/en/acme-portal-guide.md'))).toBe('The Acme Portal guide.\n');
    expect(projected.has('docs/en/sample-template-guide.md')).toBe(false);
    expect(projected.get('docs/latest.md')).toMatchObject({ symlink: true, content: 'en/acme-portal-guide.md' });
    expect(projected.get('scripts/run.sh')?.mode).toBe(0o755);
  });

  test('resets package.json and the image tag to the first version', () => {
    const pkg = JSON.parse(text(projected.get('package.json')));
    expect(pkg).toMatchObject({ name: 'acme-portal', version: INITIAL_VERSION });
    expect(pkg.scripts['project:init']).toBeUndefined();
    expect(text(projected.get('docker/app.yaml'))).toContain(`ghcr.io/acme/acme-portal:${INITIAL_VERSION}`);
    expect(text(projected.get('bun.lock'))).toContain('"name": "acme-portal"');
  });

  test('is pure and gives the same result for the same input', () => {
    const again = projectTemplateTree(tree, { template: repo.identity(), project: ANSWERS });
    expect([...again.keys()]).toEqual([...projected.keys()]);
    expect(text(tree.get('package.json'))).toContain('"sample-template-app"');
  });

  test('a repository without a project repo uses the visible marker', () => {
    const withoutRepo = projectTemplateTree(tree, { template: repo.identity(), project: { ...ANSWERS, repo: null } });
    expect(text(withoutRepo.get('docker/app.yaml'))).toContain(`ghcr.io/OWNER/acme-portal:${INITIAL_VERSION}`);
  });

  test('releases of the template do not change the projection of untouched files', () => {
    const other = new TemplateRepo();
    const sha = other.release({ ...BASE_FILES, 'docker/app.yaml': 'services:\n  app:\n    image: ghcr.io/sampleowner/sample-template-v2:7.7.7\n' }, '7.7.7');
    const again = projectTemplateTree(other.tree(sha), { template: other.identity(), project: ANSWERS });
    expect(text(again.get('docker/app.yaml'))).toBe(text(projected.get('docker/app.yaml')));
  });
});
