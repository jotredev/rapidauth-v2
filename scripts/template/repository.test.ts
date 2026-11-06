import { execFileSync } from 'node:child_process';
import { lstatSync, readFileSync, readlinkSync, realpathSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, test } from 'bun:test';
import { decodeText, type SourceFile } from './files';
import { findMentions, formatMentions } from './mentions';
import { readProjectMetadata, templateIdentityOf, type TemplateIdentity } from './metadata';
import { renameLockWorkspace } from './lockfile';
import { isTemplateOnlyPath } from './paths';
import { planRename } from './rename';

const root = fileURLToPath(new URL('../..', import.meta.url));

/** Git stores a symbolic link as its target text; everything else is read as bytes. */
function readContent(file: string): Uint8Array | string {
  return lstatSync(file).isSymbolicLink() ? readlinkSync(file) : new Uint8Array(readFileSync(file));
}

function versionedFiles(): SourceFile[] {
  const listed = execFileSync('git', ['ls-files', '-z'], { cwd: root, maxBuffer: 64 * 1024 * 1024 })
    .toString('utf8')
    .split('\0')
    .filter(Boolean);
  return listed
    .filter((file) => !isTemplateOnlyPath(file))
    .map((file) => ({ path: file, content: readContent(path.join(root, file)) }));
}

function textOf(files: SourceFile[], file: string): string {
  const found = files.find((candidate) => candidate.path === file);
  const text = found ? decodeText(found.content) : null;
  if (text === null) throw new Error(`${file} is not a text file in the repository`);
  return text;
}

function apply(files: SourceFile[], changes: ReturnType<typeof planRename>): SourceFile[] {
  const byPath = new Map(changes.map((change) => [change.path, change]));
  return files.map((file) => {
    // The init also renames the root workspace of the lockfile, to the new package name.
    if (file.path === 'bun.lock') return { path: file.path, content: renameLockWorkspace(decodeText(file.content) ?? '', 'acme-portal') };
    const change = byPath.get(file.path);
    return change ? { path: change.newPath, content: change.content ?? file.content } : file;
  });
}

/**
 * This check only makes sense in the template itself: it needs `mode: "template"` metadata and a Git work tree whose
 * top level is this folder. Anywhere else (an initialized project, a copy without .git) it is skipped.
 */
function templateIdentityIfApplicable(): TemplateIdentity | null {
  try {
    const metadata = readProjectMetadata(root);
    if (metadata.mode !== 'template') return null;
    const top = execFileSync('git', ['rev-parse', '--show-toplevel'], { cwd: root, stdio: ['ignore', 'pipe', 'ignore'] })
      .toString()
      .trim();
    return realpathSync(top) === realpathSync(root) ? templateIdentityOf(metadata) : null;
  } catch {
    return null;
  }
}

const templateIdentity = templateIdentityIfApplicable();

if (templateIdentity) describe('rename over the versioned files of this repository', () => {
  const template = templateIdentity;
  const answers = { name: 'Acme Portal', slug: 'acme-portal', repo: 'acme/acme-portal' as string | null };
  const files = versionedFiles();

  test('the template still mentions itself before the rename (the check can see real mentions)', () => {
    expect(findMentions(template, files).length).toBeGreaterThan(50);
  });

  test('no mention is left after the rename', () => {
    const renamed = apply(files, planRename(template, answers, files));
    const left = findMentions(template, renamed);
    expect(formatMentions(left)).toBe('');
  });

  test('no mention is left without a GitHub repository either', () => {
    const noRepo = { ...answers, repo: null };
    const renamed = apply(files, planRename(template, noRepo, files));
    expect(formatMentions(findMentions(template, renamed))).toBe('');
    expect(textOf(renamed, 'docker/app.yaml')).toContain('image: ghcr.io/OWNER/acme-portal:');
  });

  test('database identifiers stay consistent between Docker, dev-setup and the URL check', () => {
    const renamed = apply(files, planRename(template, answers, files));
    const text = (file: string) => textOf(renamed, file);

    expect(text('docker/db.yaml')).toContain('POSTGRES_USER: acme_portal');
    expect(text('docker/db.yaml')).toContain('POSTGRES_PASSWORD: acme_portal');
    expect(text('docker/db.yaml')).toContain('POSTGRES_DB: acme_portal');
    expect(text('docker/db.yaml')).toContain('pg_isready -U acme_portal -d acme_portal');
    expect(text('scripts/dev-setup.ts')).toContain(
      "'postgresql://acme_portal:acme_portal@localhost:5432/acme_portal?sslmode=disable'",
    );
    const env = text('lib/env.ts');
    expect(env).toContain("decodeURIComponent(url.username) === 'acme_portal'");
    expect(env).toContain("decodeURIComponent(url.password) === 'acme_portal'");
    expect(env).toContain("url.pathname === '/acme_portal'");
    for (const file of ['docker/app.yaml', 'docker/app.dev.yaml']) {
      expect(text(file)).toContain('postgresql://acme_portal:acme_portal@db:5432/acme_portal?sslmode=disable');
    }
    expect(text('docker/compose.yaml')).toMatch(/^name: acme-portal$/m);
    expect(text('docker/compose.dev.yaml')).toMatch(/^name: acme-portal$/m);
  });

  test('package name, GHCR image and display name are renamed', () => {
    const renamed = apply(files, planRename(template, answers, files));
    const text = (file: string) => textOf(renamed, file);
    expect(JSON.parse(text('package.json')).name).toBe('acme-portal');
    expect(text('docker/app.yaml')).toContain('image: ghcr.io/acme/acme-portal:');
    expect(text('config/site.ts')).toContain("appName: 'Acme Portal'");
  });
});
