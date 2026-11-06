import { describe, expect, test } from 'bun:test';
import {
  MetadataError,
  parseProjectMetadata,
  projectAnswersOf,
  serializeProjectMetadata,
  templateIdentityOf,
} from './metadata';

const identity = {
  name: 'Sample Template',
  slug: 'sample-template',
  aliases: ['sample-template-v2'],
  origin: 'https://github.com/octo/sample-template-v2.git',
};

const templateMode = { schemaVersion: 1, mode: 'template', template: identity };

const initialized = {
  schemaVersion: 1,
  mode: 'initialized',
  project: { name: 'Acme Portal', slug: 'acme-portal', description: 'Customer portal', repo: 'acme/acme-portal' },
  template: { ...identity, baseCommit: 'a'.repeat(40), version: '2.3.0' },
};

const parse = (value: unknown) => parseProjectMetadata(JSON.stringify(value));

describe('parseProjectMetadata', () => {
  test('accepts template mode', () => {
    const metadata = parse(templateMode);
    expect(metadata.mode).toBe('template');
    expect(templateIdentityOf(metadata)).toEqual(identity);
    expect(projectAnswersOf(metadata)).toBeNull();
  });

  test('accepts initialized mode and exposes the project answers', () => {
    const metadata = parse(initialized);
    expect(metadata.mode).toBe('initialized');
    expect(projectAnswersOf(metadata)).toEqual({ name: 'Acme Portal', slug: 'acme-portal', repo: 'acme/acme-portal' });
  });

  test('accepts a project without a GitHub repository', () => {
    const metadata = parse({ ...initialized, project: { ...initialized.project, repo: null } });
    expect(projectAnswersOf(metadata)?.repo).toBeNull();
  });

  test('rejects text that is not JSON', () => {
    expect(() => parseProjectMetadata('{nope')).toThrow(/not valid JSON/);
  });

  test('rejects an unknown mode and a wrong schema version', () => {
    expect(() => parse({ ...templateMode, mode: 'other' })).toThrow(MetadataError);
    expect(() => parse({ ...templateMode, schemaVersion: 2 })).toThrow(MetadataError);
  });

  test('accepts a project that predates every template release (version null)', () => {
    const parsed = parse({ ...initialized, template: { ...initialized.template, version: null } });
    expect(parsed.mode === 'initialized' && parsed.template.version).toBe(null);
  });

  test('names the field that is wrong', () => {
    expect(() => parse({ ...initialized, template: { ...initialized.template, baseCommit: 'abc' } })).toThrow(
      /template\.baseCommit/,
    );
    expect(() => parse({ ...initialized, template: { ...initialized.template, version: 'v2.3' } })).toThrow(
      /template\.version/,
    );
    expect(() => parse({ ...initialized, project: { ...initialized.project, slug: 'Acme Portal' } })).toThrow(
      /project\.slug/,
    );
    expect(() => parse({ ...initialized, project: { ...initialized.project, repo: 'not a repo' } })).toThrow(
      /project\.repo/,
    );
  });

  test('rejects unknown keys and a missing template identity', () => {
    expect(() => parse({ ...templateMode, extra: true })).toThrow(MetadataError);
    expect(() => parse({ schemaVersion: 1, mode: 'template' })).toThrow(/template/);
  });

  test('rejects an origin that is not a URL', () => {
    expect(() => parse({ ...templateMode, template: { ...identity, origin: 'nope' } })).toThrow(/template\.origin/);
  });
});

describe('serializeProjectMetadata', () => {
  test('writes stable two-space JSON with a trailing newline that parses back', () => {
    const text = serializeProjectMetadata(parse(initialized));
    expect(text.endsWith('}\n')).toBe(true);
    expect(parseProjectMetadata(text)).toEqual(parse(initialized));
  });

  test('refuses to write invalid metadata', () => {
    const bad = { ...parse(templateMode), mode: 'initialized' } as never;
    expect(() => serializeProjectMetadata(bad)).toThrow(MetadataError);
  });
});
