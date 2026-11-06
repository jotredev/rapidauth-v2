import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { chmodSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, readlinkSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { createGitRunner } from './git';
import { serializeProjectMetadata, type InitializedMetadata, type ProjectAnswers, type TemplateIdentity } from './metadata';
import { projectTemplateTree } from './projection';
import { runPull, type PullContext, type PullFlags, type PullResult } from './pull-run';
import { nodeFs } from './transaction';
import { readTree } from './tree';
import { TemplateError, type FsOps, type GitRunner, type Reporter } from './types';

/** Git without any global configuration, so the tests do not depend on the machine. */
export const GIT_ENV: NodeJS.ProcessEnv = {
  ...process.env,
  GIT_AUTHOR_NAME: 'Test',
  GIT_AUTHOR_EMAIL: 'test@example.invalid',
  GIT_COMMITTER_NAME: 'Test',
  GIT_COMMITTER_EMAIL: 'test@example.invalid',
  GIT_CONFIG_GLOBAL: '/dev/null',
  GIT_CONFIG_NOSYSTEM: '1',
  GIT_TERMINAL_PROMPT: '0',
};

export function git(cwd: string, ...args: string[]): string {
  return execFileSync('git', args, { cwd, env: GIT_ENV, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
}

const roots: string[] = [];
process.on('exit', () => {
  for (const root of roots) rmSync(root, { recursive: true, force: true });
});

export function tempDir(prefix = 'template-pull-'): string {
  const dir = mkdtempSync(path.join(tmpdir(), prefix));
  roots.push(dir);
  return dir;
}

/** The template's public address; Git rewrites it to the local bare repository (insteadOf) inside every project. */
export const TEMPLATE_ORIGIN = 'https://github.com/sampleowner/sample-template-v2.git';

export const ANSWERS: ProjectAnswers = { name: 'Acme Portal', slug: 'acme-portal', repo: 'acme/acme-portal' };

/** A file of a fixture commit: text, bytes with a mode, or a symbolic link. `null` deletes it. */
export type FileSpec = string | { content: string | Uint8Array; mode?: number } | { link: string } | null;

function writeSpec(root: string, file: string, spec: FileSpec): void {
  const absolute = path.join(root, file);
  rmSync(absolute, { force: true });
  if (spec === null) return;
  mkdirSync(path.dirname(absolute), { recursive: true });
  if (typeof spec === 'string') writeFileSync(absolute, spec);
  else if ('link' in spec) symlinkSync(spec.link, absolute);
  else {
    writeFileSync(absolute, spec.content);
    if (spec.mode !== undefined) chmodSync(absolute, spec.mode);
  }
}

/** Ten numbered lines, to merge changes that do not touch each other. */
export const LINES = Array.from({ length: 10 }, (_, index) => `line ${index + 1}\n`).join('');

export function replaceLine(text: string, line: number, value: string): string {
  const lines = text.split('\n');
  lines[line - 1] = value;
  return lines.join('\n');
}

export const BINARY_BASE = new Uint8Array([0, 1, 2, 3, 4]);

/** Files of the first release. Names: "Sample Template" in text and in paths, to prove the projection. */
export const BASE_FILES: Record<string, FileSpec> = {
  '.gitignore': '.env*\n!.env.example\n',
  '.env.example': 'DATABASE_URL=""\n',
  'package.json': `${JSON.stringify({ name: 'sample-template-app', version: '0.9.0', private: true, scripts: { dev: 'next dev', 'project:init': 'bun run scripts/project-init/index.ts' }, dependencies: { 'left-pad': '1.3.0' } }, null, 2)}\n`,
  'bun.lock': '{\n  "workspaces": {\n    "": {\n      "name": "sample-template-app"\n    }\n  }\n}\n',
  'README.md': '# Sample Template\n',
  'config/site.ts': "export const siteConfig = { appName: 'Sample Template' };\n",
  'app/page.tsx': 'export default () => "Sample Template marketing";\n',
  'components/landing-content.tsx': 'export const X = "Sample Template";\n',
  'themes/classic/app/page.tsx': 'export default () => "Sample Template marketing";\n',
  'app/auth/login.tsx': 'export const Login = "Sample Template login";\n',
  'docker/app.yaml': 'services:\n  app:\n    image: ghcr.io/sampleowner/sample-template-v2:1.0.0\n',
  'docker/compose.yaml': 'name: sample-template\n',
  'docs/en/sample-template-guide.md': 'The Sample Template guide.\n',
  'docs/latest.md': { link: 'en/sample-template-guide.md' },
  'scripts/run.sh': { content: '#!/bin/sh\necho 1\n', mode: 0o755 },
  'scripts/project-init/index.ts': '// template only: Sample Template\n',
  'docs/superpowers/plan.md': '# Plan\n',
  '.forge614/project.json': '{"projectId":"engram-template"}\n',
  'prisma/migrations/20240101000000_init/migration.sql': 'CREATE TABLE a ();\n',
  'skills/custom/SKILL.md': 'Sample Template skill v1\n',
  'lib/untouched.ts': LINES,
  'lib/template-only-change.ts': LINES,
  'lib/project-only-change.ts': LINES,
  'lib/clean-merge.ts': LINES,
  'lib/clash.ts': LINES,
  'lib/template-deletes.ts': LINES,
  'lib/template-deletes-clean.ts': LINES,
  'lib/project-deletes.ts': LINES,
  'lib/project-deletes-clean.ts': LINES,
  'assets/logo.bin': { content: BINARY_BASE },
};

/** A local bare repository standing in for the published template. */
export class TemplateRepo {
  readonly work = tempDir('template-work-');
  readonly bare = path.join(tempDir('template-bare-'), 'template.git');
  readonly url = pathToFileURL(this.bare).href;
  private readonly runner: GitRunner;

  constructor() {
    git(this.work, 'init', '-q', '-b', 'main');
    execFileSync('git', ['init', '-q', '--bare', this.bare], { env: GIT_ENV });
    git(this.work, 'remote', 'add', 'origin', this.bare);
    this.runner = createGitRunner(this.work, GIT_ENV);
  }

  /** Commits the given file changes on main, tags the commit when asked (annotated by default) and publishes both. */
  release(files: Record<string, FileSpec>, tag?: string, annotated = true): string {
    for (const [file, spec] of Object.entries(files)) writeSpec(this.work, file, spec);
    git(this.work, 'add', '-A');
    git(this.work, 'commit', '-q', '--allow-empty', '-m', tag ? `release ${tag}` : 'change');
    const sha = git(this.work, 'rev-parse', 'HEAD');
    if (tag) {
      if (annotated) git(this.work, 'tag', '-a', tag, '-m', `release ${tag}`);
      else git(this.work, 'tag', tag);
    }
    git(this.work, 'push', '-q', 'origin', 'main', '--tags');
    return sha;
  }

  tree(sha: string) {
    return readTree(this.runner, sha);
  }

  identity(): TemplateIdentity {
    return {
      name: 'Sample Template',
      slug: 'sample-template',
      aliases: ['sample-template-v2', 'sample-template-app'],
      origin: TEMPLATE_ORIGIN,
    };
  }
}

/** A repository with the base files tagged 1.0.0. */
export function templateWithBase(extra: Record<string, FileSpec> = {}): { repo: TemplateRepo; base: string } {
  const repo = new TemplateRepo();
  const base = repo.release({ ...BASE_FILES, ...extra }, '1.0.0');
  return { repo, base };
}

export interface ProjectOptions {
  /** Recorded template version (default `1.0.0`). */
  version?: string | null;
  mode?: 'initialized' | 'template';
  /** Overrides for the stored base commit. */
  baseCommit?: string;
  /** Files written on top of the projected base, in one commit (the project's own changes). */
  changes?: Record<string, FileSpec>;
  /** `.setup/template-exclusions.json` content. */
  exclusions?: unknown;
}

/** An initialized project: the projected base tree, the seeded files, the metadata and one commit. */
export function makeProject(repo: TemplateRepo, base: string, options: ProjectOptions = {}): string {
  const root = tempDir('project-');
  const identity = repo.identity();
  const projected = projectTemplateTree(repo.tree(base), { template: identity, project: ANSWERS });
  for (const [file, entry] of projected) {
    if (file.startsWith('.setup/')) continue;
    if (entry.symlink) writeSpec(root, file, { link: String(entry.content) });
    else writeSpec(root, file, { content: entry.content, mode: entry.mode });
  }
  // What the init writes for the project itself.
  writeSpec(root, 'README.md', '# Acme Portal\n\nProject readme.\n');
  writeSpec(root, 'app/page.tsx', 'export default () => "Acme landing";\n');
  writeSpec(root, 'themes/classic/app/page.tsx', 'export default () => "Acme landing";\n');
  writeSpec(root, 'config/site.ts', "export const siteConfig = { appName: 'Acme Portal', custom: true };\n");

  const mode = options.mode ?? 'initialized';
  if (mode === 'template') {
    writeSpec(root, '.setup/project.json', `${JSON.stringify({ schemaVersion: 1, mode: 'template', template: identity }, null, 2)}\n`);
  } else {
    const metadata: InitializedMetadata = {
      schemaVersion: 1,
      mode: 'initialized',
      project: { ...ANSWERS, description: 'Customer portal' },
      template: { ...identity, baseCommit: options.baseCommit ?? base, version: options.version === undefined ? '1.0.0' : options.version },
    };
    writeSpec(root, '.setup/project.json', serializeProjectMetadata(metadata));
  }
  if (options.exclusions !== undefined) writeSpec(root, '.setup/template-exclusions.json', `${JSON.stringify(options.exclusions, null, 2)}\n`);
  for (const [file, spec] of Object.entries(options.changes ?? {})) writeSpec(root, file, spec);

  git(root, 'init', '-q', '-b', 'main');
  git(root, 'config', `url.${repo.url}.insteadOf`, TEMPLATE_ORIGIN);
  git(root, 'add', '-A');
  git(root, 'commit', '-q', '-m', 'Initial commit');
  // Local files Git ignores.
  writeSpec(root, '.env', 'SECRET=1\n');
  return root;
}

/** Every path under the root except `.git`, with its content, mode or link target: for byte-for-byte comparisons. */
export function treeState(root: string): Record<string, string> {
  const state: Record<string, string> = {};
  const walk = (relative: string) => {
    for (const entry of readdirSync(path.join(root, relative)).sort()) {
      if (relative === '' && entry === '.git') continue;
      const file = path.join(relative, entry);
      const absolute = path.join(root, file);
      const stat = lstatSync(absolute);
      if (stat.isSymbolicLink()) state[file] = `link:${readlinkSync(absolute)}`;
      else if (stat.isDirectory()) {
        state[file] = 'dir';
        walk(file);
      } else state[file] = `file:${(stat.mode & 0o7777).toString(8)}:${createHash('sha1').update(readFileSync(absolute)).digest('hex')}`;
    }
  };
  walk('');
  return state;
}

export function read(root: string, file: string): string {
  return readFileSync(path.join(root, file), 'utf8');
}

export function exists(root: string, file: string): boolean {
  try {
    lstatSync(path.join(root, file));
    return true;
  } catch {
    return false;
  }
}

export class Recorder implements Reporter {
  readonly messages: { level: string; text: string }[] = [];
  info = (text: string) => void this.messages.push({ level: 'info', text });
  warn = (text: string) => void this.messages.push({ level: 'warn', text });
  error = (text: string) => void this.messages.push({ level: 'error', text });
  success = (text: string) => void this.messages.push({ level: 'success', text });
  said(level?: string): string {
    return this.messages.filter((message) => !level || message.level === level).map((message) => message.text).join('\n');
  }
}

export interface PullSetup {
  flags?: Partial<PullFlags>;
  fs?: FsOps;
  /** Wraps the Git runner, to make a command fail on purpose. */
  wrapGit?: (git: GitRunner) => GitRunner;
}

export function pullContext(root: string, setup: PullSetup = {}): { context: PullContext; terminal: Recorder } {
  const terminal = new Recorder();
  const real = createGitRunner(root, GIT_ENV);
  const context: PullContext = {
    root,
    flags: { allowMajor: false, dryRun: false, ...setup.flags },
    terminal,
    git: setup.wrapGit ? setup.wrapGit(real) : real,
    fs: setup.fs ?? nodeFs,
  };
  return { context, terminal };
}

export function pull(root: string, setup: PullSetup = {}): { result: PullResult; terminal: Recorder } {
  const { context, terminal } = pullContext(root, setup);
  return { result: runPull(context), terminal };
}

/** The message of the refusal, or fails the test when the pull went through. */
export function refusal(root: string, setup: PullSetup = {}): string {
  const { context } = pullContext(root, setup);
  try {
    runPull(context);
  } catch (error) {
    if (error instanceof TemplateError) return error.message;
    throw error;
  }
  throw new Error('Expected the pull to be refused.');
}
