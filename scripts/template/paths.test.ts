import { describe, expect, test } from 'bun:test';
import { TEMPLATE_ONLY_PATHS, classifyPath, isThemeSyncedPath, isTemplateOnlyPath } from './paths';

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

describe('path classes', () => {
  test.each([
    ['scripts/project-init/index.ts', 'template-only'],
    ['docs/superpowers/a.md', 'template-only'],
    ['README.md', 'seeded'],
    ['app/page.tsx', 'seeded'],
    ['components/landing-content.tsx', 'seeded'],
    ['config/site.ts', 'seeded'],
    ['themes/classic/app/page.tsx', 'seeded'],
    ['themes/other/components/landing-content.tsx', 'seeded'],
    ['themes/classic/app/layout.tsx', 'template'],
    ['.env', 'project'],
    ['.env.local', 'project'],
    ['docker/.env', 'project'],
    ['.setup/project.json', 'project'],
    ['.setup/template-exclusions.json', 'project'],
    ['bun.lock', 'project'],
    ['.env.example', 'template'],
    ['docker/.env.example', 'template'],
    ['package.json', 'template'],
    ['prisma/migrations/20240101000000_init/migration.sql', 'template'],
    ['docs/en/README.md', 'template'],
    ['app/auth/login/page.tsx', 'template'],
    ['AGENTS.md', 'template'],
  ])('%s is %s', (file, expected) => {
    expect(classifyPath(file)).toBe(expected as ReturnType<typeof classifyPath>);
  });

  test('exclusions turn a template path into a project path', () => {
    const exclusions = ['.agents/skills/custom/', 'lib/special.ts'];
    expect(classifyPath('.agents/skills/custom/SKILL.md', exclusions)).toBe('project');
    expect(classifyPath('lib/special.ts', exclusions)).toBe('project');
    expect(classifyPath('lib/special.tsx', exclusions)).toBe('template');
    expect(classifyPath('.agents/skills/customer/SKILL.md', exclusions)).toBe('template');
  });

  test('theme-synced paths', () => {
    expect(isThemeSyncedPath('app/auth/login/page.tsx')).toBe(true);
    expect(isThemeSyncedPath('app/globals.css')).toBe(true);
    expect(isThemeSyncedPath('components/ui/button.tsx')).toBe(true);
    expect(isThemeSyncedPath('app/globals.css.bak')).toBe(false);
    expect(isThemeSyncedPath('lib/auth.ts')).toBe(false);
  });
});
