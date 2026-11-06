import { describe, expect, setDefaultTimeout, test } from 'bun:test';
import { lstatSync, readFileSync, readlinkSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { readProjectMetadata } from './metadata';
import { conflictFilePath } from './merge';
import { PULL_REF_PREFIX } from './pull-run';
import { nodeFs } from './transaction';
import type { FsOps } from './types';
import {
  LINES,
  git,
  exists,
  makeProject,
  pull,
  read,
  refusal,
  replaceLine,
  templateWithBase,
  treeState,
  type FileSpec,
  type ProjectOptions,
} from './testkit';

// Every test builds real Git repositories; a busy machine can need more than the default 5 seconds.
setDefaultTimeout(60_000);

function scenario(projectOptions: ProjectOptions = {}, extra: Record<string, FileSpec> = {}) {
  const { repo, base } = templateWithBase(extra);
  const root = makeProject(repo, base, projectOptions);
  return { repo, base, root };
}

/** Text with a conflict block, built so that no line of this file starts with a marker. */
function conflictText(): string {
  return ['before', '<<<<<<< project', 'mine', '=======', 'theirs', '>>>>>>> template 1.1.0', 'after', ''].join('\n');
}

function refs(root: string): string {
  return git(root, 'for-each-ref', PULL_REF_PREFIX);
}

describe('guards', () => {
  test('the template itself is refused', () => {
    const { root } = scenario({ mode: 'template' });
    expect(refusal(root)).toMatch(/This is the template itself/);
  });

  test('missing metadata is refused', () => {
    const { root } = scenario();
    writeFileSync(path.join(root, '.setup/project.json'), '{ nope');
    expect(refusal(root)).toMatch(/not valid JSON/);
  });

  test('unsaved changes are refused', () => {
    const { repo, root } = scenario();
    repo.release({}, '1.1.0');
    writeFileSync(path.join(root, 'lib/untouched.ts'), 'edited\n');
    expect(refusal(root)).toMatch(/unsaved changes/);
    writeFileSync(path.join(root, 'lib/untouched.ts'), LINES);
    writeFileSync(path.join(root, 'lib/untracked.ts'), 'x\n');
    expect(refusal(root)).toMatch(/unsaved changes/);
  });

  test('conflict markers left by a previous pull are refused', () => {
    const { repo, root } = scenario({ changes: { 'lib/clash.ts': conflictText() } });
    repo.release({}, '1.1.0');
    expect(refusal(root)).toMatch(/left conflicts[\s\S]*lib\/clash\.ts/);
  });

  test('side files left by a previous pull are refused, committed or not', () => {
    const { repo, root } = scenario({ changes: { 'assets/logo.bin.pull-conflict-1.1.0': 'x' } });
    repo.release({}, '1.1.0');
    expect(refusal(root)).toMatch(/assets\/logo\.bin\.pull-conflict-1\.1\.0/);
  });

  test('a marker inside a sentence or a lone marker is not a leftover conflict', () => {
    const text = 'Conflict blocks start with <<<<<<< project and end with >>>>>>> template 1.0.0.\n<<<<<<< project\nnothing closes it\n';
    const { repo, root } = scenario({ changes: { 'lib/clash.ts': text } });
    repo.release({ 'lib/added.ts': 'new\n' }, '1.1.0');
    expect(pull(root).result.status).toBe('applied');
  });

  test('an invalid exclusions file is refused', () => {
    const { repo, root } = scenario({ exclusions: { schemaVersion: 1, exclude: ['skills/*.md'] } });
    repo.release({}, '1.1.0');
    expect(refusal(root)).toMatch(/template-exclusions\.json is invalid[\s\S]*Globs/);
    const other = scenario({ exclusions: { schemaVersion: 2, exclude: [] } });
    other.repo.release({}, '1.1.0');
    expect(refusal(other.root)).toMatch(/is invalid/);
  });
});

describe('choosing the version', () => {
  test('already up to date changes nothing', () => {
    const { root } = scenario();
    const before = treeState(root);
    const { result, terminal } = pull(root);
    expect(result.status).toBe('up-to-date');
    expect(terminal.said('success')).toMatch(/Already up to date/);
    expect(treeState(root)).toEqual(before);
    expect(refs(root)).toBe('');
  });

  test('a recorded version above every tag is never downgraded', () => {
    const { root } = scenario({ version: '1.5.0' });
    const before = treeState(root);
    expect(pull(root).result.status).toBe('up-to-date');
    expect(treeState(root)).toEqual(before);
  });

  test('the highest version is chosen numerically and the versions crossed are listed', () => {
    const { repo, root } = scenario();
    repo.release({ 'lib/added.ts': '1.9\n' }, '1.9.0', false);
    repo.release({ 'lib/added.ts': '1.10\n' }, '1.10.0');
    repo.release({ 'lib/added.ts': 'v3\n' }, 'v3.0.0');
    repo.release({ 'lib/added.ts': 'x\n' }, 'not-a-version');
    const { result, terminal } = pull(root);
    expect(result.to).toBe('1.10.0');
    expect(read(root, 'lib/added.ts')).toBe('1.10\n');
    expect(terminal.said('info')).toMatch(/versions crossed: 1\.9\.0, 1\.10\.0/);
    expect(readProjectMetadata(root).template).toMatchObject({ version: '1.10.0' });
  });

  test('a new major version is refused without the flag and nothing changes', () => {
    const { repo, root } = scenario();
    repo.release({ 'lib/added.ts': 'v2\n' }, '2.0.0');
    const before = treeState(root);
    expect(refusal(root)).toMatch(/--allow-major/);
    expect(treeState(root)).toEqual(before);
    expect(refs(root)).toBe('');
  });

  test('a new major version is applied with --allow-major', () => {
    const { repo, root } = scenario();
    repo.release({ 'lib/added.ts': 'v2\n' }, '2.0.0');
    expect(pull(root, { flags: { allowMajor: true } }).result.to).toBe('2.0.0');
    expect(read(root, 'lib/added.ts')).toBe('v2\n');
  });

  test('without a recorded version there is no major check', () => {
    const { repo, root } = scenario({ version: null });
    repo.release({ 'lib/added.ts': 'v3\n' }, '3.0.0');
    const { result } = pull(root);
    expect(result.from).toBe(null);
    expect(result.to).toBe('3.0.0');
  });

  test('a template without tags has nothing to pull', () => {
    const { repo, base } = templateWithBase();
    const root = makeProject(repo, base, { version: null });
    git(repo.bare, 'tag', '-d', '1.0.0');
    const { result, terminal } = pull(root);
    expect(result.status).toBe('up-to-date');
    expect(terminal.said('info')).toMatch(/no published versions/);
  });
});

describe('applying a release', () => {
  test('brings changes, additions and deletions, applies the project name and updates the metadata', () => {
    const { repo, root } = scenario();
    const head = git(root, 'rev-parse', 'HEAD');
    const sha = repo.release(
      {
        'lib/template-only-change.ts': replaceLine(LINES, 2, 'template line 2'),
        'lib/added.ts': 'brand new\n',
        'lib/template-deletes-clean.ts': null,
        'docs/en/sample-template-guide.md': 'The Sample Template guide v2.\n',
        // The release image tag moves with every release; the project keeps its own 0.1.0.
        'docker/app.yaml': 'services:\n  app:\n    image: ghcr.io/sampleowner/sample-template-v2:1.1.0\n',
        'scripts/project-init/new.ts': 'template only\n',
        'docs/superpowers/x.md': 'template only\n',
        '.forge614/other.json': '{}\n',
      },
      '1.1.0',
    );
    const { result, terminal } = pull(root);

    expect(result).toMatchObject({ status: 'applied', from: '1.0.0', to: '1.1.0' });
    expect(result.updated.sort()).toEqual(['docs/en/acme-portal-guide.md', 'lib/template-only-change.ts']);
    expect(result.added).toEqual(['lib/added.ts']);
    expect(result.deleted).toEqual(['lib/template-deletes-clean.ts']);
    expect(result.conflicts).toEqual([]);
    expect(read(root, 'lib/template-only-change.ts')).toContain('template line 2');
    expect(read(root, 'lib/added.ts')).toBe('brand new\n');
    expect(exists(root, 'lib/template-deletes-clean.ts')).toBe(false);
    expect(read(root, 'docs/en/acme-portal-guide.md')).toBe('The Acme Portal guide v2.\n');
    expect(read(root, 'docker/app.yaml')).toContain('ghcr.io/acme/acme-portal:0.1.0');
    for (const never of ['scripts/project-init', 'docs/superpowers', '.forge614']) expect(exists(root, never)).toBe(false);

    const metadata = readProjectMetadata(root);
    if (metadata.mode !== 'initialized') throw new Error('unreachable');
    expect(metadata.template.baseCommit).toBe(sha);
    expect(metadata.template.version).toBe('1.1.0');
    expect(metadata.project.name).toBe('Acme Portal');
    expect(read(root, '.setup/project.json').endsWith('\n')).toBe(true);

    expect(git(root, 'rev-parse', 'HEAD')).toBe(head);
    expect(git(root, 'status', '--porcelain')).not.toBe('');
    expect(refs(root)).toBe('');
    expect(git(root, 'tag')).toBe('');
    expect(terminal.said('success')).toMatch(/1\.0\.0 -> 1\.1\.0/);
    expect(terminal.said('success')).toMatch(/2 updated, 1 added, 1 deleted, 0 in conflict/);
    expect(terminal.said('info')).toMatch(/Nothing was committed/);
    expect(terminal.said('warn')).toBe('');
  });

  test('the next pull from the new base is up to date', () => {
    const { repo, root } = scenario();
    repo.release({ 'lib/added.ts': 'x\n' }, '1.1.0');
    pull(root);
    git(root, 'add', '-A');
    git(root, 'commit', '-q', '-m', 'pull');
    expect(pull(root).result.status).toBe('up-to-date');
  });

  test('a second release merges against the first one as the new base', () => {
    const { repo, root } = scenario();
    repo.release({ 'lib/template-only-change.ts': replaceLine(LINES, 2, 'one') }, '1.1.0');
    pull(root);
    git(root, 'add', '-A');
    git(root, 'commit', '-q', '-m', 'pull');
    repo.release({ 'lib/template-only-change.ts': replaceLine(replaceLine(LINES, 2, 'one'), 3, 'two') }, '1.2.0');
    const { result } = pull(root);
    expect(result.updated).toEqual(['lib/template-only-change.ts']);
    expect(result.conflicts).toEqual([]);
    expect(read(root, 'lib/template-only-change.ts')).toContain('two');
  });

  test('a new spelling of the template name that the engine does not know is only a warning', () => {
    const { repo, root } = scenario();
    repo.release({ 'docs/en/note.md': 'Powered by sample.template here.\n' }, '1.1.0');
    const { result, terminal } = pull(root);
    expect(result.status).toBe('applied');
    expect(terminal.said('warn')).toMatch(/still mention the template[\s\S]*docs\/en\/note\.md/);
  });
});

describe('--dry-run', () => {
  test('plans and reports without writing anything', () => {
    const { repo, root } = scenario();
    repo.release({ 'lib/added.ts': 'x\n', 'lib/template-only-change.ts': replaceLine(LINES, 1, 'changed') }, '1.1.0');
    const before = treeState(root);
    const { result, terminal } = pull(root, { flags: { dryRun: true } });
    expect(result.status).toBe('dry-run');
    expect(result.added).toEqual(['lib/added.ts']);
    expect(result.updated).toEqual(['lib/template-only-change.ts']);
    expect(terminal.said('success')).toMatch(/Would update template 1\.0\.0 -> 1\.1\.0/);
    expect(treeState(root)).toEqual(before);
    expect(git(root, 'status', '--porcelain')).toBe('');
    expect(refs(root)).toBe('');
  });
});

describe('merging one path', () => {
  const projectLines = (edit: (text: string) => string) => edit(LINES);

  test('only the template changed: its version is taken', () => {
    const { repo, root } = scenario();
    repo.release({ 'lib/template-only-change.ts': replaceLine(LINES, 4, 'from template') }, '1.1.0');
    pull(root);
    expect(read(root, 'lib/template-only-change.ts')).toBe(replaceLine(LINES, 4, 'from template'));
  });

  test('only the project changed: the project is kept and nothing is reported', () => {
    const mine = replaceLine(LINES, 4, 'mine');
    const { repo, root } = scenario({ changes: { 'lib/project-only-change.ts': mine } });
    repo.release({ 'lib/added.ts': 'x\n' }, '1.1.0');
    const { result } = pull(root);
    expect(read(root, 'lib/project-only-change.ts')).toBe(mine);
    expect(result.conflicts).toEqual([]);
    expect(result.updated).toEqual([]);
  });

  test('both made the same change: nothing to do', () => {
    const same = replaceLine(LINES, 4, 'same');
    const { repo, root } = scenario({ changes: { 'lib/clean-merge.ts': same } });
    repo.release({ 'lib/clean-merge.ts': same }, '1.1.0');
    const { result } = pull(root);
    expect(result.updated).toEqual([]);
    expect(result.conflicts).toEqual([]);
  });

  test('both changed different places: a clean three-way merge', () => {
    const { repo, root } = scenario({ changes: { 'lib/clean-merge.ts': projectLines((text) => replaceLine(text, 1, 'mine')) } });
    repo.release({ 'lib/clean-merge.ts': replaceLine(LINES, 9, 'theirs') }, '1.1.0');
    const { result } = pull(root);
    expect(read(root, 'lib/clean-merge.ts')).toBe(replaceLine(replaceLine(LINES, 1, 'mine'), 9, 'theirs'));
    expect(result.updated).toEqual(['lib/clean-merge.ts']);
    expect(result.conflicts).toEqual([]);
  });

  test('both changed the same place: markers with the three labels, reported as a conflict', () => {
    const { repo, root } = scenario({ changes: { 'lib/clash.ts': replaceLine(LINES, 5, 'project five') } });
    repo.release({ 'lib/clash.ts': replaceLine(LINES, 5, 'template five') }, '1.1.0');
    const { result, terminal } = pull(root);
    const text = read(root, 'lib/clash.ts');
    expect(text).toContain('<<<<<<< project\nproject five\n');
    expect(text).toContain('||||||| template 1.0.0\nline 5\n');
    expect(text).toContain('=======\ntemplate five\n>>>>>>> template 1.1.0\n');
    expect(result.conflicts).toEqual([{ path: 'lib/clash.ts', reason: '1 conflicting region, marked in the file', conflictFile: undefined }]);
    expect(result.updated).toEqual([]);
    expect(terminal.said('warn')).toMatch(/lib\/clash\.ts/);
    // The leftover is detected by the next run.
    git(root, 'add', '-A');
    git(root, 'commit', '-q', '-m', 'half-resolved');
    expect(refusal(root)).toMatch(/left conflicts/);
  });

  test('template deleted, project changed: the project file stays and it is a conflict', () => {
    const mine = replaceLine(LINES, 2, 'mine');
    const { repo, root } = scenario({ changes: { 'lib/template-deletes.ts': mine } });
    repo.release({ 'lib/template-deletes.ts': null }, '1.1.0');
    const { result } = pull(root);
    expect(read(root, 'lib/template-deletes.ts')).toBe(mine);
    expect(result.conflicts.map((conflict) => conflict.path)).toEqual(['lib/template-deletes.ts']);
    expect(result.conflicts[0].conflictFile).toBeUndefined();
    expect(exists(root, conflictFilePath('lib/template-deletes.ts', '1.1.0'))).toBe(false);
  });

  test('template deleted, project untouched: it is deleted', () => {
    const { repo, root } = scenario();
    repo.release({ 'lib/template-deletes-clean.ts': null }, '1.1.0');
    expect(pull(root).result.deleted).toEqual(['lib/template-deletes-clean.ts']);
    expect(exists(root, 'lib/template-deletes-clean.ts')).toBe(false);
  });

  test('project deleted, template changed: it stays deleted and the template version is written next to it', () => {
    const { repo, root } = scenario({ changes: { 'lib/project-deletes.ts': null } });
    const theirs = replaceLine(LINES, 3, 'theirs');
    repo.release({ 'lib/project-deletes.ts': theirs }, '1.1.0');
    const { result } = pull(root);
    expect(exists(root, 'lib/project-deletes.ts')).toBe(false);
    expect(read(root, 'lib/project-deletes.ts.pull-conflict-1.1.0')).toBe(theirs);
    expect(result.conflicts).toEqual([
      { path: 'lib/project-deletes.ts', reason: 'changed in the template, deleted in the project', conflictFile: 'lib/project-deletes.ts.pull-conflict-1.1.0' },
    ]);
  });

  test('project deleted, template unchanged: it stays deleted without a conflict', () => {
    const { repo, root } = scenario({ changes: { 'lib/project-deletes-clean.ts': null } });
    repo.release({ 'lib/added.ts': 'x\n' }, '1.1.0');
    const { result } = pull(root);
    expect(exists(root, 'lib/project-deletes-clean.ts')).toBe(false);
    expect(result.conflicts).toEqual([]);
  });

  test('a binary changed on both sides keeps the project version and writes the template one next to it', () => {
    const mine = new Uint8Array([0, 9, 9]);
    const theirs = new Uint8Array([0, 7, 7, 255]);
    const { repo, root } = scenario({ changes: { 'assets/logo.bin': { content: mine } } });
    repo.release({ 'assets/logo.bin': { content: theirs } }, '1.1.0');
    const { result } = pull(root);
    expect(new Uint8Array(readFileSync(path.join(root, 'assets/logo.bin')))).toEqual(mine);
    expect(new Uint8Array(readFileSync(path.join(root, 'assets/logo.bin.pull-conflict-1.1.0')))).toEqual(theirs);
    expect(result.conflicts.map((conflict) => conflict.path)).toEqual(['assets/logo.bin']);
  });

  test('a binary changed only by the template is taken as is', () => {
    const theirs = new Uint8Array([0, 7, 7, 255]);
    const { repo, root } = scenario();
    repo.release({ 'assets/logo.bin': { content: theirs } }, '1.1.0');
    pull(root);
    expect(new Uint8Array(readFileSync(path.join(root, 'assets/logo.bin')))).toEqual(theirs);
  });

  test('a symbolic link retargeted only by the template follows it', () => {
    const { repo, root } = scenario();
    repo.release({ 'docs/en/sample-template-other.md': 'other\n', 'docs/latest.md': { link: 'en/sample-template-other.md' } }, '1.1.0');
    pull(root);
    expect(lstatSync(path.join(root, 'docs/latest.md')).isSymbolicLink()).toBe(true);
    expect(readlinkSync(path.join(root, 'docs/latest.md'))).toBe('en/acme-portal-other.md');
  });

  test('a symbolic link retargeted on both sides keeps the project link and writes the template link next to it', () => {
    const { repo, root } = scenario({ changes: { 'docs/latest.md': { link: 'en/mine.md' } } });
    repo.release({ 'docs/latest.md': { link: 'en/sample-template-other.md' } }, '1.1.0');
    const { result } = pull(root);
    expect(readlinkSync(path.join(root, 'docs/latest.md'))).toBe('en/mine.md');
    expect(readlinkSync(path.join(root, 'docs/latest.md.pull-conflict-1.1.0'))).toBe('en/acme-portal-other.md');
    expect(result.conflicts.map((conflict) => conflict.path)).toEqual(['docs/latest.md']);
  });

  test('a new file takes the template mode and an existing file keeps its own', () => {
    const { repo, root } = scenario({ changes: { 'scripts/run.sh': { content: BASE_RUN, mode: 0o644 } } });
    repo.release(
      { 'bin/tool.sh': { content: '#!/bin/sh\n', mode: 0o755 }, 'bin/plain.txt': 'x\n', 'scripts/run.sh': { content: '#!/bin/sh\necho 2\n', mode: 0o755 } },
      '1.1.0',
    );
    pull(root);
    expect(lstatSync(path.join(root, 'bin/tool.sh')).mode & 0o777).toBe(0o755);
    expect(lstatSync(path.join(root, 'bin/plain.txt')).mode & 0o111).toBe(0);
    expect(read(root, 'scripts/run.sh')).toContain('echo 2');
    expect(lstatSync(path.join(root, 'scripts/run.sh')).mode & 0o777).toBe(0o644);
  });

  test('package.json: the project keeps its version, gets the new dependency and is told to install', () => {
    const projectPackage = `${JSON.stringify({ name: 'acme-portal', version: '0.2.0', private: true, scripts: { dev: 'next dev' }, dependencies: { 'left-pad': '1.3.0' } }, null, 2)}\n`;
    const { repo, root } = scenario({ changes: { 'package.json': projectPackage } });
    const templatePackage = `${JSON.stringify({ name: 'sample-template-app', version: '1.1.0', private: true, scripts: { dev: 'next dev', 'project:init': 'x' }, dependencies: { 'left-pad': '1.3.0', zod: '4.0.0' } }, null, 2)}\n`;
    repo.release({ 'package.json': templatePackage }, '1.1.0');
    const { result, terminal } = pull(root);
    const merged = JSON.parse(read(root, 'package.json'));
    expect(merged.version).toBe('0.2.0');
    expect(merged.name).toBe('acme-portal');
    expect(merged.dependencies.zod).toBe('4.0.0');
    expect(merged.scripts['project:init']).toBeUndefined();
    expect(result.conflicts).toEqual([]);
    expect(terminal.said('info')).toMatch(/bun install/);
  });
});

const BASE_RUN = '#!/bin/sh\necho 1\n';

describe('paths that never travel', () => {
  test('seeded, project, excluded and ignored paths are left alone', () => {
    const { repo, root } = scenario(
      { exclusions: { schemaVersion: 1, exclude: ['skills/custom/', 'lib/untouched.ts'] }, changes: { '.gitignore': '.env*\n!.env.example\ngenerated/\n' } },
    );
    repo.release(
      {
        'README.md': '# Template readme changed\n',
        'config/site.ts': "export const siteConfig = { appName: 'Sample Template', other: 1 };\n",
        'app/page.tsx': 'export default () => "changed";\n',
        'components/landing-content.tsx': 'export const X = "changed";\n',
        'themes/classic/app/page.tsx': 'export default () => "changed";\n',
        'bun.lock': '{ "changed": true }\n',
        '.env.example': 'DATABASE_URL=""\nNEW_VALUE=""\n',
        'skills/custom/SKILL.md': 'Sample Template skill v2\n',
        'lib/untouched.ts': replaceLine(LINES, 1, 'template'),
        'generated/file.ts': 'ignored\n',
        'lib/added.ts': 'x\n',
      },
      '1.1.0',
    );
    const before = treeState(root);
    const { result } = pull(root);
    const after = treeState(root);
    for (const file of ['README.md', 'config/site.ts', 'app/page.tsx', 'components/landing-content.tsx', 'themes/classic/app/page.tsx', 'bun.lock', '.env', 'skills/custom/SKILL.md', 'lib/untouched.ts']) {
      expect(after[file]).toBe(before[file]);
    }
    expect(exists(root, 'generated/file.ts')).toBe(false);
    expect(read(root, '.env.example')).toContain('NEW_VALUE');
    expect(result.added).toEqual(['lib/added.ts']);
    expect(result.updated).toEqual(['.env.example']);
  });
});

describe('next steps', () => {
  test('a new migration is applied to the project folder and db:deploy is suggested', () => {
    const { repo, root } = scenario();
    repo.release({ 'prisma/migrations/20250101000000_more/migration.sql': 'ALTER TABLE a ADD COLUMN b int;\n' }, '1.1.0');
    const { result, terminal } = pull(root);
    expect(result.added).toEqual(['prisma/migrations/20250101000000_more/migration.sql']);
    expect(read(root, 'prisma/migrations/20240101000000_init/migration.sql')).toBe('CREATE TABLE a ();\n');
    expect(terminal.said('info')).toMatch(/bun run db:deploy/);
    expect(terminal.said('info')).not.toMatch(/bun install/);
    expect(terminal.said('info')).not.toMatch(/theme:sync-classic/);
  });

  test('theme-synced files suggest the theme sync, and no hint appears when nothing relevant changed', () => {
    const { repo, root } = scenario();
    repo.release({ 'app/auth/login.tsx': 'export const Login = "Sample Template login v2";\n' }, '1.1.0');
    const { terminal } = pull(root);
    expect(terminal.said('info')).toMatch(/bun run theme:sync-classic/);
    expect(terminal.said('info')).not.toMatch(/db:deploy/);
  });
});

describe('failures change nothing', () => {
  function failingFs(on: keyof FsOps, nth: number): FsOps {
    let calls = 0;
    const wrapped = { ...nodeFs };
    (wrapped[on] as unknown) = (...args: unknown[]) => {
      calls += 1;
      if (calls === nth) throw new Error('disk failure on purpose');
      (nodeFs[on] as (...rest: unknown[]) => void)(...args);
    };
    return wrapped;
  }

  test('a failing write rolls everything back byte for byte', () => {
    const { repo, root } = scenario();
    repo.release(
      {
        'lib/template-only-change.ts': replaceLine(LINES, 2, 'changed'),
        'lib/template-deletes-clean.ts': null,
        'new/deep/dir/file.ts': 'x\n',
        'docs/latest.md': { link: 'en/sample-template-other.md' },
        'package.json': `${JSON.stringify({ name: 'sample-template-app', version: '1.1.0' }, null, 2)}\n`,
      },
      '1.1.0',
    );
    const before = treeState(root);
    for (const nth of [1, 2, 3]) {
      const message = refusal(root, { fs: failingFs('writeFile', nth) });
      expect(message).toMatch(/every change was undone/);
      expect(treeState(root)).toEqual(before);
      expect(git(root, 'status', '--porcelain')).toBe('');
      expect(refs(root)).toBe('');
    }
    expect(refusal(root, { fs: failingFs('removeFile', 1) })).toMatch(/undone/);
    expect(treeState(root)).toEqual(before);
    // Without the failure the same pull works.
    expect(pull(root).result.status).toBe('applied');
  });

  test('a failure while writing the last file (the metadata) also rolls back', () => {
    const { repo, root } = scenario();
    repo.release({ 'lib/added.ts': 'x\n' }, '1.1.0');
    const before = treeState(root);
    expect(refusal(root, { fs: failingFs('writeFile', 2) })).toMatch(/undone/);
    expect(treeState(root)).toEqual(before);
  });

  test('an unreachable template stops the pull before anything', () => {
    const { repo, root } = scenario();
    repo.release({ 'lib/added.ts': 'x\n' }, '1.1.0');
    const before = treeState(root);
    expect(refusal(root, { wrapGit: (runner) => (args, input) => (args[0] === 'ls-remote' ? { ok: false, status: 128, stdout: '', stderr: 'offline', stdoutBytes: new Uint8Array() } : runner(args, input)) })).toMatch(/Could not reach the template[\s\S]*Nothing was changed/);
    expect(treeState(root)).toEqual(before);
  });

  test('a download failure after the version check changes nothing and leaves no temporary references', () => {
    const { repo, root } = scenario();
    repo.release({ 'lib/added.ts': 'x\n' }, '1.1.0');
    const before = treeState(root);
    const message = refusal(root, {
      wrapGit: (runner) => (args, input) => (args[0] === 'fetch' ? { ok: false, status: 128, stdout: '', stderr: 'dropped', stdoutBytes: new Uint8Array() } : runner(args, input)),
    });
    expect(message).toMatch(/Could not download the template[\s\S]*Nothing was changed/);
    expect(treeState(root)).toEqual(before);
    expect(refs(root)).toBe('');
  });

  test('a base commit missing from the template history stops the pull', () => {
    const { repo, root } = scenario({ baseCommit: 'a'.repeat(40) });
    repo.release({ 'lib/added.ts': 'x\n' }, '1.1.0');
    const before = treeState(root);
    expect(refusal(root)).toMatch(/not in the template history any more/);
    expect(treeState(root)).toEqual(before);
    expect(refs(root)).toBe('');
  });

  test('a symbolic link standing where the template needs a folder is refused before writing', () => {
    const { repo, root } = scenario({ changes: { newdir: { link: '/tmp' } } });
    repo.release({ 'newdir/file.ts': 'x\n', 'lib/added.ts': 'y\n' }, '1.1.0');
    const before = treeState(root);
    expect(refusal(root)).toMatch(/newdir is a symbolic link/);
    expect(treeState(root)).toEqual(before);
  });
});
