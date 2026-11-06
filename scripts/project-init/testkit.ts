import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { chmodSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, readlinkSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { createGitRunner } from './real-context';
import { nodeFs } from './transaction';
import type { CommandRunner, InitContext, InitFlags, RunOptions, SelectPrompt, Services, Terminal, TextPrompt } from './types';

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

export function tempDir(prefix = 'project-init-'): string {
  const dir = mkdtempSync(path.join(tmpdir(), prefix));
  roots.push(dir);
  return dir;
}

/** The identity the fixture template declares. Its origin is a GitHub URL that Git rewrites to a local bare repository. */
export const TEMPLATE_ORIGIN = 'https://github.com/sampleowner/sample-template-v2.git';

function put(root: string, file: string, content: string, mode?: number): void {
  const absolute = path.join(root, file);
  mkdirSync(path.dirname(absolute), { recursive: true });
  writeFileSync(absolute, content);
  if (mode !== undefined) chmodSync(absolute, mode);
}

const metadata = JSON.stringify(
  {
    schemaVersion: 1,
    mode: 'template',
    template: { name: 'Sample Template', slug: 'sample-template', aliases: ['sample-template-v2', 'sample-template-app'], origin: TEMPLATE_ORIGIN },
  },
  null,
  2,
);

function writeTemplateFiles(root: string, release: string, extra: Record<string, string>): void {
  put(root, '.setup/project.json', `${metadata}\n`);
  put(
    root,
    'package.json',
    `${JSON.stringify({ name: 'sample-template-app', version: '0.9.0', private: true, scripts: { dev: 'next dev', 'project:init': 'bun run scripts/project-init/index.ts', test: 'bun test' } }, null, 2)}\n`,
  );
  put(root, 'bun.lock', '{\n  "lockfileVersion": 1,\n  "workspaces": {\n    "": {\n      "name": "sample-template-app",\n      "dependencies": {\n        "left-pad": "1.3.0"\n      }\n    }\n  },\n  "packages": {\n    "left-pad": ["left-pad@1.3.0", "", {}, "sha512-x"]\n  }\n}\n');
  put(root, '.gitignore', '.env*\n!.env.example\n');
  put(root, '.env.example', 'DATABASE_URL=""\nBETTER_AUTH_SECRET=""\nBETTER_AUTH_URL=""\nSUPPORT_EMAIL=""\n');
  put(root, 'README.md', '# Sample Template\n\nThe fastest way to ship Sample Template.\n');
  put(root, 'config/site.ts', "export const siteConfig = {\n  appName: 'Sample Template',\n} as const;\n");
  put(root, 'app/page.tsx', 'export default function Home() {\n  return <main>Sample Template marketing</main>;\n}\n');
  put(root, 'components/landing-content.tsx', 'export const FEATURES = ["Sample Template is fast"];\n');
  put(root, 'docker/compose.yaml', 'name: sample-template\ninclude:\n  - db.yaml\n');
  put(root, 'docker/app.yaml', `services:\n  app:\n    image: ghcr.io/sampleowner/sample-template-v2:${release}\n`);
  put(root, 'docs/en/guide.md', `Run ghcr.io/sampleowner/sample-template-v2:${release} on a server.\n`);
  put(root, 'docs/en/sample-template-guide.md', 'The Sample Template guide.\n');
  rmSync(path.join(root, 'docs/sample-template-latest.md'), { force: true });
  symlinkSync('en/sample-template-guide.md', path.join(root, 'docs/sample-template-latest.md'));
  put(root, 'scripts/run.sh', '#!/bin/sh\necho Sample Template\n', 0o755);
  put(root, '.forge614/project.json', '{"projectId":"engram-template"}\n');
  put(root, 'docs/superpowers/plans/plan.md', '# Plan for Sample Template\n');
  put(root, 'scripts/project-init/index.ts', '// template only: Sample Template\n');
  for (const [file, content] of Object.entries(extra)) put(root, file, content);
}

export interface TemplateFixture {
  bare: string;
  url: string;
  /** c0 has no tag, c1 is tagged 1.0.0 (annotated), c2 is tagged 1.1.0 (lightweight), c3 comes after the last tag. */
  shas: { c0: string; c1: string; c2: string; c3: string; c4?: string };
}

const templates = new Map<string, TemplateFixture>();

export interface TemplateOptions {
  tags?: boolean;
  /** Files added to every commit. */
  files?: Record<string, string>;
  /** A last commit with the same tree as c3. */
  emptyCommitAtEnd?: boolean;
}

/** A local bare repository standing in for the published template, with a small history. Built once per variant. */
export function templateFixture(options: TemplateOptions = {}): TemplateFixture {
  const key = JSON.stringify(options);
  const cached = templates.get(key);
  if (cached) return cached;

  const work = tempDir('template-work-');
  const extra = options.files ?? {};
  git(work, 'init', '-q', '-b', 'main');
  const commit = (message: string) => {
    git(work, 'add', '-A');
    git(work, 'commit', '-q', '-m', message);
    return git(work, 'rev-parse', 'HEAD');
  };
  writeTemplateFiles(work, '0.0.1', extra);
  const c0 = commit('first');
  writeTemplateFiles(work, '1.0.0', extra);
  const c1 = commit('release 1.0.0');
  if (options.tags !== false) git(work, 'tag', '-a', '1.0.0', '-m', 'release 1.0.0');
  writeTemplateFiles(work, '1.1.0', extra);
  put(work, 'docs/en/new-in-1.1.md', 'More.\n');
  const c2 = commit('release 1.1.0');
  if (options.tags !== false) {
    git(work, 'tag', '1.1.0');
    git(work, 'tag', 'not-a-version');
  }
  put(work, 'docs/en/after.md', 'After the last tag.\n');
  const c3 = commit('after 1.1.0');
  let c4: string | undefined;
  if (options.emptyCommitAtEnd) {
    git(work, 'commit', '-q', '--allow-empty', '-m', 'same tree again');
    c4 = git(work, 'rev-parse', 'HEAD');
  }

  const bare = path.join(tempDir('template-bare-'), 'template.git');
  git(work, 'clone', '-q', '--bare', work, bare);
  const fixture = { bare, url: pathToFileURL(bare).href, shas: { c0, c1, c2, c3, c4 } };
  templates.set(key, fixture);
  return fixture;
}

export interface ProjectOptions {
  /** Add an `origin` remote with this URL. */
  origin?: string;
  /** Extra commit changing a tracked file, so no template commit matches. */
  modified?: boolean;
}

/** A copy made like "Use this template": the files of one template commit as a single commit with no history. */
export function projectFrom(template: TemplateFixture, sha: string, options: ProjectOptions = {}): string {
  const archive = path.join(tempDir('template-archive-'), 'copy.tar');
  git(template.bare, 'archive', '--format=tar', '-o', archive, sha);
  const root = tempDir('project-');
  execFileSync('tar', ['-xf', archive, '-C', root]);
  git(root, 'init', '-q', '-b', 'main');
  git(root, 'config', `url.${template.url}.insteadOf`, TEMPLATE_ORIGIN);
  if (options.origin) git(root, 'remote', 'add', 'origin', options.origin);
  git(root, 'add', '-A');
  git(root, 'commit', '-q', '-m', 'Initial commit');
  if (options.modified) {
    writeFileSync(path.join(root, 'README.md'), '# Changed by the project\n');
    git(root, 'commit', '-q', '-am', 'Change');
  }
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

type Scripted = string | null;

/** A terminal that answers from a script. `null` accepts the suggested value. */
export class FakeTerminal implements Terminal {
  readonly messages: { level: string; text: string }[] = [];
  readonly prompts: TextPrompt[] = [];
  readonly selects: SelectPrompt<string>[] = [];

  constructor(
    private readonly script: { text?: Scripted[]; select?: string[] } = {},
    readonly interactive = false,
  ) {}

  async text(prompt: TextPrompt): Promise<string> {
    this.prompts.push(prompt);
    const next = this.script.text?.shift();
    if (next === undefined) throw new Error(`Unexpected question: ${prompt.message}`);
    return next === null ? (prompt.initialValue ?? '') : next;
  }

  async select<T extends string>(prompt: SelectPrompt<T>): Promise<T> {
    this.selects.push(prompt);
    const next = this.script.select?.shift();
    if (next === undefined) throw new Error(`Unexpected question: ${prompt.message}`);
    return next as T;
  }

  private add(level: string, text: string) {
    this.messages.push({ level, text });
  }
  info = (text: string) => this.add('info', text);
  warn = (text: string) => this.add('warn', text);
  error = (text: string) => this.add('error', text);
  success = (text: string) => this.add('success', text);

  said(level: string): string {
    return this.messages.filter((message) => message.level === level).map((message) => message.text).join('\n');
  }
  get all(): string {
    return this.messages.map((message) => message.text).join('\n');
  }
}

export interface RecordedCommand {
  line: string;
  options: RunOptions;
}

export interface TestSetup {
  context: InitContext;
  terminal: FakeTerminal;
  commands: RecordedCommand[];
  migrations: string[];
}

export interface SetupOptions {
  flags?: InitFlags;
  terminal?: FakeTerminal;
  busyPorts?: number[];
  dockerProblem?: string;
  /** Command lines (like `bun install`) that fail. */
  failing?: string[];
  fs?: InitContext['fs'];
  migrateError?: Error;
  databaseNeverReady?: boolean;
}

export const DEFAULT_FLAGS: InitFlags = {
  name: 'Acme Portal',
  slug: 'acme-portal',
  description: 'Customer portal for Acme',
  repo: 'acme/acme-portal',
  start: 'later',
};

export function setup(root: string, options: SetupOptions = {}): TestSetup {
  const terminal = options.terminal ?? new FakeTerminal();
  const commands: RecordedCommand[] = [];
  const migrations: string[] = [];
  const run: CommandRunner = (command, args, runOptions) => {
    const line = [command, ...args].join(' ');
    commands.push({ line, options: runOptions });
    return options.failing?.includes(line) ? { status: 1, error: 'failed on purpose' } : { status: 0 };
  };
  const services: Services = {
    dockerProblem: () => options.dockerProblem,
    isPortFree: async (port) => !options.busyPorts?.includes(port),
    waitForDatabase: async () => (options.databaseNeverReady ? { ok: false, reason: 'timed out' } : { ok: true }),
    migrate: (url) => {
      if (options.migrateError) throw options.migrateError;
      migrations.push(url);
    },
  };
  const context: InitContext = {
    root,
    flags: options.flags ?? DEFAULT_FLAGS,
    terminal,
    git: createGitRunner(root, GIT_ENV),
    run,
    services,
    fs: options.fs ?? nodeFs,
  };
  return { context, terminal, commands, migrations };
}
