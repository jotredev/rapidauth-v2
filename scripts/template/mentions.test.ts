import { describe, expect, test } from 'bun:test';
import { findMentions, formatMentions } from './mentions';
import type { TemplateIdentity } from './metadata';

const template: TemplateIdentity = {
  name: 'Sample Template',
  slug: 'sample-template',
  aliases: ['sample-template-v2', 'sample-template-starter'],
  origin: 'https://github.com/octo/sample-template-v2.git',
};

const find = (files: { path: string; content: string | Uint8Array }[]) => findMentions(template, files);

describe('findMentions', () => {
  test('reports every spelling with file and line', () => {
    const mentions = find([
      {
        path: 'a.txt',
        content: ['clean', 'Sample Template', 'x SAMPLETEMPLATE y', 'sample_template', 'sampleTemplate', 'sample-template-starter'].join('\n'),
      },
    ]);
    expect(mentions.map((m) => [m.line, m.match])).toEqual([
      [2, 'Sample Template'],
      [3, 'SAMPLETEMPLATE'],
      [4, 'sample_template'],
      [5, 'sampleTemplate'],
      [6, 'sample-template-starter'],
    ]);
  });

  test('reports the longest spelling of an alias, not its start', () => {
    expect(find([{ path: 'a', content: 'sample-template-v2' }])[0].match).toBe('sample-template-v2');
  });

  test('reports several mentions on one line', () => {
    expect(find([{ path: 'a', content: 'Sample Template / sample-template' }])).toHaveLength(2);
  });

  test('returns nothing for clean files and unrelated words', () => {
    expect(find([{ path: 'a', content: 'a sample of a template' }])).toEqual([]);
  });

  test('reports a mention in the path itself', () => {
    const [mention] = find([{ path: 'docs/sample-template.md', content: 'clean' }]);
    expect(mention).toMatchObject({ path: 'docs/sample-template.md', line: null });
  });

  test('handles Windows line endings', () => {
    expect(find([{ path: 'a', content: 'ok\r\nSample Template\r\n' }])[0].line).toBe(2);
  });

  test('does not read binary content or the lockfile', () => {
    const bytes = new Uint8Array([0, 1, 2, ...new TextEncoder().encode('Sample Template')]);
    expect(find([{ path: 'a.bin', content: bytes }, { path: 'bun.lock', content: 'sample-template' }])).toEqual([]);
  });

  test('external references kept on purpose are not reported', () => {
    expect(find([{ path: 'themes/registry.json', content: 'github:octo/sample-template-v2-theme' }])).toEqual([]);
  });

  test('formats a readable report', () => {
    const text = formatMentions(find([{ path: 'a.txt', content: 'x\nSample Template' }]));
    expect(text).toContain('a.txt:2');
    expect(text).toContain('Sample Template');
  });
});

describe('the metadata file', () => {
  const identityJson = (extra: Record<string, unknown>) =>
    JSON.stringify({ schemaVersion: 1, mode: 'initialized', ...extra, template });

  test('the stored template identity and origin URL are exempt', () => {
    const content = identityJson({ project: { name: 'Acme Portal', slug: 'acme-portal', description: '', repo: null } });
    expect(find([{ path: '.setup/project.json', content }])).toEqual([]);
  });

  test('anything else in the metadata file is still checked', () => {
    const content = identityJson({
      project: { name: 'Acme Portal', slug: 'acme-portal', description: 'Built on Sample Template', repo: null },
    });
    const mentions = find([{ path: '.setup/project.json', content }]);
    expect(mentions).toHaveLength(1);
    expect(mentions[0].match).toBe('Sample Template');
  });

  test('the exemption applies to that file only', () => {
    const content = JSON.stringify({ template });
    expect(find([{ path: 'other/project.json', content }]).length).toBeGreaterThan(0);
  });
});
