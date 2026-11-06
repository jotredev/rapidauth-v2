import { describe, expect, test } from 'bun:test';
import { TEMPLATE_ONLY_PATHS, isTemplateOnlyPath } from './paths';

describe('template-only paths', () => {
  test('lists the folders the init deletes and template:pull never brings', () => {
    expect([...TEMPLATE_ONLY_PATHS]).toEqual(['.forge614/', 'docs/superpowers/', 'scripts/project-init/']);
  });

  test('matches files below them and nothing else', () => {
    expect(isTemplateOnlyPath('.forge614/project.json')).toBe(true);
    expect(isTemplateOnlyPath('scripts/project-init/index.ts')).toBe(true);
    expect(isTemplateOnlyPath('docs/superpowers/plans/a.md')).toBe(true);
    expect(isTemplateOnlyPath('scripts/project-init-notes.md')).toBe(false);
    expect(isTemplateOnlyPath('docs/en/README.md')).toBe(false);
  });
});
