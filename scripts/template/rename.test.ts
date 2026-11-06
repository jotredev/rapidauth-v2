import { describe, expect, test } from 'bun:test';
import type { TemplateIdentity } from './metadata';
import { RenameError, planRename } from './rename';

const template: TemplateIdentity = {
  name: 'Sample Template',
  slug: 'sample-template',
  aliases: ['sample-template-v2', 'sample-template-starter'],
  origin: 'https://github.com/octo/sample-template-v2.git',
};

const answers = { name: 'Acme Portal', slug: 'acme-portal', repo: 'acme/acme-portal' as string | null };

/** Renames one text and returns the result (the input when nothing changes). */
function rename(content: string, overrides: Partial<typeof answers> = {}, path = 'file.txt'): string {
  const changes = planRename(template, { ...answers, ...overrides }, [{ path, content }]);
  return changes[0]?.content ?? content;
}

describe('name forms', () => {
  test.each([
    ['display', 'Sample Template', 'Acme Portal'],
    ['UPPER display', 'SAMPLE TEMPLATE', 'ACME PORTAL'],
    ['lower display', 'sample template', 'acme portal'],
    ['kebab', 'sample-template', 'acme-portal'],
    ['snake', 'sample_template', 'acme_portal'],
    ['no separator', 'sampletemplate', 'acme-portal'],
    ['no separator upper', 'SAMPLETEMPLATE', 'ACME PORTAL'],
    ['camel', 'sampleTemplate', 'acmePortal'],
    ['Pascal', 'SampleTemplate', 'AcmePortal'],
    ['UPPER_SNAKE', 'SAMPLE_TEMPLATE', 'ACME_PORTAL'],
    ['UPPER-KEBAB', 'SAMPLE-TEMPLATE', 'ACME-PORTAL'],
  ])('%s', (_label, from, to) => {
    expect(rename(`before ${from} after`)).toBe(`before ${to} after`);
  });

  test('replaces every occurrence, also several on one line', () => {
    expect(rename('Sample Template and sample-template, Sample Template')).toBe(
      'Acme Portal and acme-portal, Acme Portal',
    );
  });

  test('leaves a file without mentions untouched (no change planned)', () => {
    expect(planRename(template, answers, [{ path: 'a.txt', content: 'nothing here' }])).toEqual([]);
  });
});

describe('longest and most specific first', () => {
  test('an alias wins over the slug it contains', () => {
    expect(rename('pkg sample-template-starter and sample-template-v2 and sample-template')).toBe(
      'pkg acme-portal and acme-portal and acme-portal',
    );
  });

  test('the repository name alias follows the GitHub repository answer', () => {
    expect(rename('cd sample-template-v2', { repo: 'acme/portal-app' })).toBe('cd portal-app');
    expect(rename('cd sample-template-v2', { repo: null })).toBe('cd acme-portal');
  });

  test('the full owner/repo wins over the alias inside it', () => {
    expect(rename('https://github.com/octo/sample-template-v2.git')).toBe('https://github.com/acme/acme-portal.git');
  });

  test('a repository that only starts with the template repository is not the template repository', () => {
    expect(rename('octo/sample-template-v2-extra')).toBe('octo/acme-portal-extra');
  });
});

describe('GitHub repository', () => {
  test('GHCR image, clone URL and badge use the answer', () => {
    const text = [
      'image: ghcr.io/octo/sample-template-v2:2.3.0',
      'git clone https://github.com/octo/sample-template-v2.git',
      '[![CI](https://github.com/octo/sample-template-v2/actions/workflows/ci.yml/badge.svg)]',
    ].join('\n');
    expect(rename(text, { repo: 'Acme/Acme-Portal' })).toBe(
      [
        'image: ghcr.io/acme/acme-portal:2.3.0',
        'git clone https://github.com/Acme/Acme-Portal.git',
        '[![CI](https://github.com/Acme/Acme-Portal/actions/workflows/ci.yml/badge.svg)]',
      ].join('\n'),
    );
  });

  test('without a repository a visible placeholder is used', () => {
    const text = 'image: ghcr.io/octo/sample-template-v2:1.0.0\ngit clone https://github.com/octo/sample-template-v2.git';
    expect(rename(text, { repo: null })).toBe(
      'image: ghcr.io/OWNER/acme-portal:1.0.0\ngit clone https://github.com/OWNER/acme-portal.git',
    );
  });
});

describe('database identifiers', () => {
  test('connection URLs use one consistent identifier without hyphens', () => {
    expect(rename('postgresql://sample-template:sample-template@localhost:5432/sample-template?sslmode=disable')).toBe(
      'postgresql://acme_portal:acme_portal@localhost:5432/acme_portal?sslmode=disable',
    );
    expect(rename('url: postgres://sample-template:sample-template@db:5432/sample-template')).toBe(
      'url: postgres://acme_portal:acme_portal@db:5432/acme_portal',
    );
  });

  test('only Postgres connection strings get the database form, not an npm scope', () => {
    expect(rename('@sample-template/ui and @sample-template/sample-template')).toBe('@acme-portal/ui and @acme-portal/acme-portal');
    expect(rename('import x from "@scope/sample-template"')).toBe('import x from "@scope/acme-portal"');
    expect(rename('postgresql://u:p@db:5432/sample-template')).toBe('postgresql://u:p@db:5432/acme_portal');
  });

  test('a URL inside a template string keeps the placeholders', () => {
    expect(
      rename('`postgresql://sample-template:sample-template@localhost:${port}/sample-template?sslmode=disable`'),
    ).toBe('`postgresql://acme_portal:acme_portal@localhost:${port}/acme_portal?sslmode=disable`');
  });

  test('compose service environment, pg tools and URL checks match the URL', () => {
    const text = [
      '      POSTGRES_USER: sample-template',
      '      PGDATABASE: sample-template',
      '      test: ["CMD-SHELL", "pg_isready -U sample-template -d sample-template"]',
      'docker compose -p sample-template-ci exec -T db psql -U sample-template -d sample-template -c "select 1"',
      "decodeURIComponent(url.username) === 'sample-template' &&",
      "url.pathname === '/sample-template'",
    ].join('\n');
    expect(rename(text)).toBe(
      [
        '      POSTGRES_USER: acme_portal',
        '      PGDATABASE: acme_portal',
        '      test: ["CMD-SHELL", "pg_isready -U acme_portal -d acme_portal"]',
        'docker compose -p acme-portal-ci exec -T db psql -U acme_portal -d acme_portal -c "select 1"',
        "decodeURIComponent(url.username) === 'acme_portal' &&",
        "url.pathname === '/acme_portal'",
      ].join('\n'),
    );
  });

  test('prose that names the credentials follows the same identifier', () => {
    expect(rename('user `sample-template`, password `sample-template`, database `sample-template`')).toBe(
      'user `acme_portal`, password `acme_portal`, database `acme_portal`',
    );
  });
});

describe('Docker and other lowercase contexts', () => {
  test('compose project name, network and image tags keep the hyphenated slug', () => {
    expect(rename('name: sample-template')).toBe('name: acme-portal');
    expect(rename('--network sample-template_default')).toBe('--network acme-portal_default');
    expect(rename('tags: sample-template-ci-production:local')).toBe('tags: acme-portal-ci-production:local');
    expect(rename('S3_BUCKET:-sample-template-avatars')).toBe('S3_BUCKET:-acme-portal-avatars');
  });

  test('the display name in an email local part becomes the slug', () => {
    expect(rename('FROM_EMAIL: Sample Template-ci@example.invalid')).toBe('FROM_EMAIL: acme-portal-ci@example.invalid');
    expect(rename('"Sample Template <noreply@example.com>"')).toBe('"Acme Portal <noreply@example.com>"');
  });
});

describe('identifiers stay valid', () => {
  test('names glued to identifier characters become camel, Pascal or UPPER_SNAKE', () => {
    expect(rename('const sampleTemplateClient = new SampleTemplateClient(useSampleTemplate())')).toBe(
      'const acmePortalClient = new AcmePortalClient(useAcmePortal())',
    );
    expect(rename('process.env.SAMPLETEMPLATE_URL')).toBe('process.env.ACME_PORTAL_URL');
    expect(rename('SAMPLE_TEMPLATE_URL')).toBe('ACME_PORTAL_URL');
    expect(rename('SampleTemplate_default')).toBe('AcmePortal_default');
  });

  test('a lowercase name glued before a capital becomes camelCase', () => {
    expect(rename('const sampletemplateConfig = 1; const sampleTemplateConfig = 2')).toBe(
      'const acmePortalConfig = 1; const acmePortalConfig = 2',
    );
  });

  test('a multi-word slug yields identifiers without hyphens or spaces', () => {
    const out = rename('SampleTemplateClient sampleTemplateClient SAMPLE_TEMPLATE_KEY sample_template_key', {
      name: 'My Great App',
      slug: 'my-great-app',
    });
    expect(out).toBe('MyGreatAppClient myGreatAppClient MY_GREAT_APP_KEY my_great_app_key');
    expect(out).not.toMatch(/[ ]\w*-|\s{2}/);
  });
});

describe('paths', () => {
  test('a path with a template form is renamed, with hyphens instead of spaces', () => {
    const changes = planRename(template, answers, [
      { path: 'docs/sample-template-guide.md', content: 'x' },
      { path: 'assets/Sample Template logo.svg', content: 'x' },
      { path: 'plain.md', content: 'x' },
    ]);
    expect(changes).toEqual([
      { path: 'docs/sample-template-guide.md', newPath: 'docs/acme-portal-guide.md', content: null },
      { path: 'assets/Sample Template logo.svg', newPath: 'assets/Acme-Portal logo.svg', content: null },
    ]);
  });

  test('a renamed file also gets new content in one change', () => {
    const [change] = planRename(template, answers, [{ path: 'sample-template.md', content: '# Sample Template' }]);
    expect(change).toEqual({ path: 'sample-template.md', newPath: 'acme-portal.md', content: '# Acme Portal' });
  });

  test('two files that would land on the same path are refused', () => {
    expect(() =>
      planRename(template, answers, [
        { path: 'sample-template.md', content: '' },
        { path: 'acme-portal.md', content: '' },
      ]),
    ).toThrow(RenameError);
  });
});

describe('skipped files', () => {
  test('binary files keep their content but still follow a path rename', () => {
    const bytes = new Uint8Array([0x89, 0x50, 0x00, ...new TextEncoder().encode('Sample Template')]);
    expect(planRename(template, answers, [{ path: 'logo.png', content: bytes }])).toEqual([]);
    const [renamed] = planRename(template, answers, [{ path: 'sample-template.png', content: bytes }]);
    expect(renamed).toEqual({ path: 'sample-template.png', newPath: 'acme-portal.png', content: null });
  });

  test('bun.lock and the metadata file are never rewritten', () => {
    const files = [
      { path: 'bun.lock', content: '"name": "sample-template"' },
      { path: '.setup/project.json', content: '{"template":{"name":"Sample Template"}}' },
    ];
    expect(planRename(template, answers, files)).toEqual([]);
  });

  test('external references kept on purpose are left untouched', () => {
    const content = '{"source":"github:octo/sample-template-v2-theme","preview":"https://sample-template.dev"}';
    expect(planRename(template, answers, [{ path: 'themes/registry.json', content }])).toEqual([]);
  });

  test('text given as bytes is decoded and renamed', () => {
    const [change] = planRename(template, answers, [
      { path: 'a.txt', content: new TextEncoder().encode('Sample Template') },
    ]);
    expect(change.content).toBe('Acme Portal');
  });
});

describe('answers', () => {
  const invalid: [Partial<typeof answers>][] = [
    [{ slug: 'Acme Portal' }],
    [{ slug: '1acme' }],
    [{ slug: 'acme--portal' }],
    [{ name: 'Acme "Portal"' }],
    [{ name: "Acme's" }],
    [{ name: '' }],
    [{ repo: 'no-owner' }],
  ];

  test.each(invalid)('invalid answers %o are refused', (override) => {
    expect(() => rename('Sample Template', override)).toThrow(RenameError);
  });

  test('answers that still carry the template name are refused', () => {
    expect(() => rename('x', { name: 'Sample Template Pro' })).toThrow(/template name/);
    expect(() => rename('x', { slug: 'sample-template-pro' })).toThrow(/template name/);
    expect(() => rename('x', { repo: 'acme/sampletemplate' })).toThrow(/template name/);
  });
});
