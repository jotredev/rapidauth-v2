import { describe, expect, test } from 'bun:test';
import { existsSync, lstatSync, readFileSync, readlinkSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { readProjectMetadata } from '../template/metadata';
import { runInit, suggestSlug } from './init';
import { DEFAULT_FLAGS, FakeTerminal, git, projectFrom, read, setup, templateFixture, treeState, type SetupOptions } from './testkit';
import type { FsOps } from './types';
import { nodeFs } from './transaction';

const template = templateFixture();

function freshProject(options: Parameters<typeof projectFrom>[2] = {}) {
  return projectFrom(template, template.shas.c3, options);
}

async function initialize(options: SetupOptions = {}, projectOptions: Parameters<typeof projectFrom>[2] = {}) {
  const root = freshProject(projectOptions);
  const kit = setup(root, options);
  const result = await runInit(kit.context);
  return { root, result, ...kit };
}

async function refusal(promise: Promise<unknown>): Promise<string> {
  try {
    await promise;
  } catch (error) {
    return (error as Error).message;
  }
  throw new Error('Expected the init to be refused.');
}

describe('suggestSlug', () => {
  test.each([
    ['Acme Portal', 'acme-portal'],
    ['  Café  Olé! ', 'cafe-ole'],
    ['Mi App v2', 'mi-app-v2'],
  ])('%s', (name, slug) => {
    expect(suggestSlug(name)).toBe(slug);
  });
});

describe('what the init changes', () => {
  test('renames, resets the version, deletes template-only paths and writes valid metadata', async () => {
    const { root, result } = await initialize();

    expect(result.answers).toEqual({ name: 'Acme Portal', slug: 'acme-portal', repo: 'acme/acme-portal', description: 'Customer portal for Acme' });
    expect(read(root, 'config/site.ts')).toContain("appName: 'Acme Portal'");
    expect(read(root, 'docker/compose.yaml')).toContain('name: acme-portal');

    const pkg = JSON.parse(read(root, 'package.json'));
    expect(pkg.name).toBe('acme-portal');
    expect(pkg.version).toBe('0.1.0');
    expect(pkg.scripts['project:init']).toBe(undefined);
    expect(pkg.scripts.dev).toBe('next dev');
    expect(read(root, 'package.json').endsWith('\n')).toBe(true);

    for (const gone of ['.forge614', 'docs/superpowers', 'scripts/project-init']) expect(existsSync(path.join(root, gone))).toBe(false);

    const metadata = readProjectMetadata(root);
    expect(metadata.mode).toBe('initialized');
    if (metadata.mode !== 'initialized') throw new Error('unreachable');
    expect(metadata.project).toEqual({ name: 'Acme Portal', slug: 'acme-portal', description: 'Customer portal for Acme', repo: 'acme/acme-portal' });
    expect(metadata.template.baseCommit).toBe(template.shas.c3);
    expect(metadata.template.version).toBe('1.1.0');
    expect(metadata.template.name).toBe('Sample Template');
  });

  test('keeps symbolic links as links, renames them and keeps the executable bit', async () => {
    const { root } = await initialize();
    const link = path.join(root, 'docs/acme-portal-latest.md');
    expect(lstatSync(link).isSymbolicLink()).toBe(true);
    expect(readlinkSync(link)).toBe('en/acme-portal-guide.md');
    expect(existsSync(path.join(root, 'docs/sample-template-latest.md'))).toBe(false);
    expect(read(root, 'docs/en/acme-portal-guide.md')).toBe('The Acme Portal guide.\n');
    expect(lstatSync(path.join(root, 'scripts/run.sh')).mode & 0o111).toBe(0o111);
  });

  test('replaces the README and the landing with neutral versions', async () => {
    const { root } = await initialize({ flags: { ...DEFAULT_FLAGS, description: 'He said "hi" <b>{now}</b>' } });
    const readme = read(root, 'README.md');
    expect(readme).toContain('# Acme Portal');
    expect(readme).toContain('He said "hi" <b>{now}</b>');
    expect(readme).toContain('bun dev');
    expect(readme).toContain('docs/en/README.md');
    expect(readme).not.toContain('fastest way');

    const landing = read(root, 'components/landing-content.tsx');
    expect(landing).toContain('siteConfig.appName');
    expect(landing).toContain(`const DESCRIPTION = ${JSON.stringify('He said "hi" <b>{now}</b>')};`);
    expect(landing).toContain('@/components/ui/button');
    expect(landing).not.toContain('FEATURES');
    expect(read(root, 'app/page.tsx')).toContain('redirectToFirstRunIfNoAdmin');
  });

  test('an empty description leaves no description in the landing', async () => {
    const { root } = await initialize({ flags: { ...DEFAULT_FLAGS, description: '' } });
    expect(read(root, 'components/landing-content.tsx')).not.toContain('DESCRIPTION');
    expect(read(root, 'README.md').startsWith('# Acme Portal\n\n## Getting started')).toBe(true);
  });

  test('the template release tag of the image becomes the project version', async () => {
    const { root } = await initialize();
    expect(read(root, 'docker/app.yaml')).toContain('image: ghcr.io/acme/acme-portal:0.1.0');
    expect(read(root, 'docs/en/guide.md')).toBe('Run ghcr.io/acme/acme-portal:0.1.0 on a server.\n');
  });

  test('without a repository the image uses the visible placeholder', async () => {
    const { root } = await initialize({ flags: { ...DEFAULT_FLAGS, repo: '' } });
    expect(read(root, 'docker/app.yaml')).toContain('image: ghcr.io/OWNER/acme-portal:0.1.0');
    expect(readProjectMetadata(root)).toMatchObject({ project: { repo: null } });
  });

  test('renames only the root workspace in bun.lock, leaving no mention', async () => {
    const { root } = await initialize();
    const lock = read(root, 'bun.lock');
    expect(lock).toContain('"": {\n      "name": "acme-portal",');
    expect(lock).toContain('"left-pad": ["left-pad@1.3.0", "", {}, "sha512-x"]');
    expect(lock).not.toMatch(/sample/i);
  });

  test('installs, syncs the theme and does not commit', async () => {
    const { root, commands } = await initialize();
    expect(commands.map((command) => command.line)).toEqual(['bun install', 'bun run theme:sync-classic']);
    expect(git(root, 'rev-list', '--count', 'HEAD')).toBe('1');
    expect(git(root, 'status', '--porcelain')).not.toBe('');
  });

  test('a failing install or theme sync is only a warning', async () => {
    const { result, terminal } = await initialize({ failing: ['bun install', 'bun run theme:sync-classic'] });
    expect(result.warnings).toHaveLength(2);
    expect(terminal.said('warn')).toContain('bun install');
  });
});

describe('guards', () => {
  test('a second run is refused and changes nothing', async () => {
    const { root } = await initialize();
    git(root, 'add', '-A');
    git(root, 'commit', '-q', '-m', 'Project');
    const before = treeState(root);
    const message = await refusal(runInit(setup(root).context));
    expect(message).toMatch(/already initialized as "Acme Portal"/);
    expect(treeState(root)).toEqual(before);
  });

  test('a dirty working tree is refused', async () => {
    const root = freshProject();
    writeFileSync(path.join(root, 'notes.txt'), 'unsaved');
    const before = treeState(root);
    expect(await refusal(runInit(setup(root).context))).toMatch(/unsaved changes/);
    expect(treeState(root)).toEqual(before);
  });

  test('a modified tracked file is refused too', async () => {
    const root = freshProject();
    writeFileSync(path.join(root, 'README.md'), 'edited');
    expect(await refusal(runInit(setup(root).context))).toMatch(/unsaved changes/);
  });

  test('the guards run before any question', async () => {
    const root = freshProject();
    writeFileSync(path.join(root, 'notes.txt'), 'unsaved');
    const terminal = new FakeTerminal({}, true);
    await refusal(runInit(setup(root, { terminal, flags: {} }).context));
    expect(terminal.prompts).toHaveLength(0);
  });

  test('a copy that matches no template version changes nothing', async () => {
    const root = freshProject({ modified: true });
    const before = treeState(root);
    expect(await refusal(runInit(setup(root).context))).toMatch(/does not match any published version/);
    expect(treeState(root)).toEqual(before);
    expect(git(root, 'for-each-ref', 'refs/template-init')).toBe('');
  });

  test('a missing metadata file is refused', async () => {
    const root = freshProject();
    git(root, 'rm', '-q', '.setup/project.json');
    git(root, 'commit', '-q', '-m', 'Remove');
    expect(await refusal(runInit(setup(root).context))).toMatch(/project\.json was not found/);
  });

  describe('running inside the template itself', () => {
    const origin = 'https://github.com/SampleOwner/Sample-Template-v2';

    test('needs the template slug typed', async () => {
      const root = freshProject({ origin });
      const before = treeState(root);
      expect(await refusal(runInit(setup(root).context))).toMatch(/Not confirmed/);
      expect(await refusal(runInit(setup(root, { flags: { ...DEFAULT_FLAGS, confirmTemplate: 'nope' } }).context))).toMatch(/Not confirmed/);
      expect(treeState(root)).toEqual(before);
    });

    test('an insteadOf rule does not hide the template: the raw origin URL is compared too', async () => {
      // projectFrom sets url.<local bare>.insteadOf <template origin>, so `git remote get-url` returns a local path.
      const root = freshProject({ origin: 'https://github.com/sampleowner/sample-template-v2.git' });
      expect(git(root, 'remote', 'get-url', 'origin')).not.toMatch(/github\.com/);
      const before = treeState(root);
      const kit = setup(root);
      expect(await refusal(runInit(kit.context))).toMatch(/Not confirmed/);
      expect(kit.terminal.said('warn')).toMatch(/points at the template repository itself/);
      expect(treeState(root)).toEqual(before);
      const confirmed = setup(root, { flags: { ...DEFAULT_FLAGS, confirmTemplate: 'sample-template' } });
      await runInit(confirmed.context);
      expect(confirmed.terminal.said('warn')).toMatch(/origin remote still points at the template/);
    });

    test('proceeds with the confirmation and warns to change origin at the end', async () => {
      const root = freshProject({ origin });
      const kit = setup(root, { flags: { ...DEFAULT_FLAGS, confirmTemplate: 'sample-template' } });
      await runInit(kit.context);
      expect(kit.terminal.said('warn')).toMatch(/origin remote still points at the template/);
      expect(existsSync(path.join(root, '.forge614'))).toBe(false);
    });

    test('asks the person to type the slug when interactive', async () => {
      const root = freshProject({ origin });
      const terminal = new FakeTerminal({ text: ['sample-template', 'Acme Portal', null, 'A portal', ''], select: ['later'] }, true);
      await runInit(setup(root, { terminal, flags: {} }).context);
      expect(terminal.prompts[0].message).toMatch(/Type "sample-template"/);
    });

    test('another origin needs no confirmation and no warning', async () => {
      const kit = await initialize({}, { origin: 'https://github.com/acme/acme-portal.git' });
      expect(kit.terminal.said('warn')).not.toMatch(/origin/);
    });
  });
});

describe('questions', () => {
  test('without a terminal and without flags it fails clearly', async () => {
    const root = freshProject();
    const before = treeState(root);
    expect(await refusal(runInit(setup(root, { flags: {} }).context))).toMatch(/no terminal[\s\S]*--name[\s\S]*--slug[\s\S]*--start/);
    expect(await refusal(runInit(setup(root, { flags: { start: 'later' } }).context))).toMatch(/--name/);
    expect(treeState(root)).toEqual(before);
  });

  test('invalid flag values are refused before anything changes', async () => {
    const root = freshProject();
    const before = treeState(root);
    for (const flags of [
      { ...DEFAULT_FLAGS, slug: 'Bad Slug' },
      { ...DEFAULT_FLAGS, name: 'Sample Template Two' },
      { ...DEFAULT_FLAGS, slug: 'sample-template-x' },
      { ...DEFAULT_FLAGS, repo: 'not a repo' },
    ]) {
      expect(await refusal(runInit(setup(root, { flags }).context))).toMatch(/Invalid value/);
    }
    expect(treeState(root)).toEqual(before);
  });

  test('asks name, slug, description and repository, suggesting slug and repository', async () => {
    const root = freshProject({ origin: 'git@github.com:acme/customer-portal.git' });
    const terminal = new FakeTerminal({ text: ['Acme Portal', null, 'A portal', null], select: ['later'] }, true);
    const result = await runInit(setup(root, { terminal, flags: {} }).context);
    expect(terminal.prompts.map((prompt) => prompt.message)).toEqual([
      'Project name',
      'Project slug (lowercase letters, digits and hyphens)',
      'One-line description',
      'GitHub repository (owner/repo, empty to set it later)',
    ]);
    expect(terminal.prompts[1].initialValue).toBe('acme-portal');
    expect(terminal.prompts[3].initialValue).toBe('acme/customer-portal');
    expect(result.answers).toEqual({ name: 'Acme Portal', slug: 'acme-portal', repo: 'acme/customer-portal', description: 'A portal' });
    // The start question comes after the changes are applied.
    expect(terminal.selects[0].message).toBe('How do you want to start?');
    expect(terminal.selects[0].options.map((option) => option.value)).toEqual(['docker', 'prod', 'later']);
  });

  test('an empty repository answer is allowed', async () => {
    const root = freshProject();
    const terminal = new FakeTerminal({ text: ['Acme Portal', null, '', ''], select: ['later'] }, true);
    expect((await runInit(setup(root, { terminal, flags: {} }).context)).answers.repo).toBe(null);
  });

  test('the prompts validate what is typed', async () => {
    const root = freshProject();
    const terminal = new FakeTerminal({ text: ['Acme Portal', null, '', ''], select: ['later'] }, true);
    await runInit(setup(root, { terminal, flags: {} }).context);
    const [name, slug, , repo] = terminal.prompts;
    expect(name.validate?.('Sample Template')).toMatch(/different from the template/);
    expect(name.validate?.('Acme Portal')).toBe(undefined);
    expect(slug.validate?.('Not Valid')).toMatch(/lowercase/i);
    expect(repo.validate?.('')).toBe(undefined);
    expect(repo.validate?.('x y')).toMatch(/owner\/repo/);
  });
});

describe('atomic changes', () => {
  function failingFs(on: keyof FsOps, nth: number): FsOps {
    let calls = 0;
    const wrapped = { ...nodeFs };
    (wrapped[on] as (...args: unknown[]) => void) = (...args: unknown[]) => {
      calls += 1;
      if (calls === nth) throw new Error(`injected ${on} failure`);
      (nodeFs[on] as (...rest: unknown[]) => void)(...args);
    };
    return wrapped;
  }

  test.each([
    ['writeFile', 1],
    ['writeFile', 6],
    ['writeFile', 9],
    ['removeFile', 2],
    ['removeDir', 1],
    ['symlink', 1],
  ] as const)('a failing %s (call %d) restores every byte', async (operation, nth) => {
    const root = freshProject();
    const before = treeState(root);
    const kit = setup(root, { fs: failingFs(operation, nth) });
    expect(await refusal(runInit(kit.context))).toMatch(/every change was undone: injected/);
    expect(treeState(root)).toEqual(before);
    expect(kit.commands).toHaveLength(0);
    expect(git(root, 'status', '--porcelain')).toBe('');
  });

  test('a mention left in the result undoes everything', async () => {
    // Mixed case is a mention for the check, but not a spelling the rename engine knows.
    const odd = templateFixture({ files: { 'notes/odd.txt': 'Written as sAmPlE-tEmPlAtE here.\n' } });
    const root = projectFrom(odd, odd.shas.c3);
    const before = treeState(root);
    const kit = setup(root);
    const message = await refusal(runInit(kit.context));
    expect(message).toMatch(/still mentions the template[\s\S]*notes\/odd\.txt:1/);
    expect(treeState(root)).toEqual(before);
    expect(kit.commands).toHaveLength(0);
  });
});

describe('ways to start', () => {
  const migrateUrl = 'postgresql://acme_portal:acme_portal@localhost:5432/acme_portal?sslmode=disable';

  test('Docker: local env, services up, database waited for, migrations applied', async () => {
    const kit = await initialize({ flags: { ...DEFAULT_FLAGS, start: 'docker' } });
    const env = read(kit.root, '.env');
    expect(env).toContain(`DATABASE_URL="${migrateUrl}"`);
    expect(env).toContain('BETTER_AUTH_URL="http://localhost:3000"');
    expect(env).toMatch(/BETTER_AUTH_SECRET="[0-9a-f]{64}"/);
    expect(env).not.toContain('DB_PORT');
    expect(existsSync(path.join(kit.root, 'docker/.env'))).toBe(false);

    const up = kit.commands.find((command) => command.line === 'docker compose up -d db mailpit');
    expect(up?.options.cwd).toBe(path.join(kit.root, 'docker'));
    expect(kit.migrations).toEqual([migrateUrl]);
    expect(kit.result.start).toEqual({ mode: 'docker', ready: true });
    expect(kit.terminal.said('success')).toContain('Run `bun dev` and open http://localhost:3000');
    expect(git(kit.root, 'status', '--porcelain', '--ignored')).toContain('!! .env');
  });

  test('Docker with port 5432 busy uses the next free port in both env files', async () => {
    const kit = await initialize({ flags: { ...DEFAULT_FLAGS, start: 'docker' }, busyPorts: [5432, 5433] });
    const url = 'postgresql://acme_portal:acme_portal@localhost:5434/acme_portal?sslmode=disable';
    expect(read(kit.root, '.env')).toContain(`DATABASE_URL="${url}"`);
    expect(read(kit.root, '.env')).toContain('DB_PORT="5434"');
    expect(read(kit.root, 'docker/.env')).toBe('DB_PORT="5434"\n');
    expect(kit.migrations).toEqual([url]);
    expect(kit.terminal.said('warn')).toContain('Port 5432 is busy');
  });

  test('Docker missing finishes successfully and says what to do', async () => {
    const kit = await initialize({ flags: { ...DEFAULT_FLAGS, start: 'docker' }, dockerProblem: 'Docker is not installed or is not available in PATH.' });
    expect(kit.result.start).toEqual({ mode: 'docker', ready: false });
    expect(existsSync(path.join(kit.root, '.env'))).toBe(false);
    expect(kit.commands.some((command) => command.line.startsWith('docker'))).toBe(false);
    expect(kit.terminal.said('warn')).toContain('Docker is not installed');
    expect(kit.terminal.said('info')).toContain('cd docker && docker compose up -d db mailpit');
  });

  test('Docker that fails to start the services, wait or migrate still finishes', async () => {
    const down = await initialize({ flags: { ...DEFAULT_FLAGS, start: 'docker' }, failing: ['docker compose up -d db mailpit'] });
    expect(down.result.start.ready).toBe(false);
    expect(down.terminal.said('warn')).toContain('Docker could not start');

    const slow = await initialize({ flags: { ...DEFAULT_FLAGS, start: 'docker' }, databaseNeverReady: true });
    expect(slow.terminal.said('warn')).toContain('did not accept connections');
    expect(slow.migrations).toHaveLength(0);

    const broken = await initialize({ flags: { ...DEFAULT_FLAGS, start: 'docker' }, migrateError: new Error('boom') });
    expect(broken.terminal.said('warn')).toContain('bun run db:deploy');
  });

  test('Docker leaves an existing .env alone', async () => {
    const root = freshProject();
    writeFileSync(path.join(root, '.env'), 'DATABASE_URL="postgresql://mine"\n');
    const kit = setup(root, { flags: { ...DEFAULT_FLAGS, start: 'docker' } });
    await runInit(kit.context);
    expect(readFileSync(path.join(root, '.env'), 'utf8')).toBe('DATABASE_URL="postgresql://mine"\n');
    expect(kit.commands.some((command) => command.line.startsWith('docker'))).toBe(false);
  });

  test('production values: warns and runs setup:prod in the same terminal', async () => {
    const kit = await initialize({ flags: { ...DEFAULT_FLAGS, start: 'prod' } });
    const call = kit.commands.find((command) => command.line === 'bun run setup:prod');
    expect(call?.options.inherit).toBe(true);
    expect(call?.options.cwd).toBe(kit.root);
    expect(kit.terminal.said('warn')).toMatch(/database you configure now is the one the app will use/);
    expect(existsSync(path.join(kit.root, '.env'))).toBe(false);
  });

  test('later: leaves .env alone and shows both paths', async () => {
    const kit = await initialize();
    expect(existsSync(path.join(kit.root, '.env'))).toBe(false);
    const info = kit.terminal.said('info');
    expect(info).toContain('docker compose up -d db mailpit');
    expect(info).toContain('bun run setup:prod');
    expect(kit.commands.map((command) => command.line)).not.toContain('bun run setup:prod');
  });
});
