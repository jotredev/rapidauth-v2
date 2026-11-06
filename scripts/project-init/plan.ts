import { lstatSync, readFileSync, readlinkSync } from 'node:fs';
import path from 'node:path';
import { decodeText, type SourceFile } from '../template/files';
import { escapeRegExp } from '../template/forms';
import { METADATA_PATH, serializeProjectMetadata, type InitializedMetadata, type TemplateIdentity } from '../template/metadata';
import { isTemplateOnlyPath } from '../template/paths';
import { renameLockWorkspace } from '../template/lockfile';
import { planRename } from '../template/rename';
import { renderLandingContent, renderLandingPage, renderReadme, type ProjectText } from './content';
import { InitError, type GitRunner } from './types';

/** Version every new project starts at, in `package.json` and in the image tag. */
export const INITIAL_VERSION = '0.1.0';

/** Folders where the published image and its tag are written. */
const IMAGE_TAG_PREFIXES = ['docker/', 'docs/'];

export interface Entry {
  /** Bytes of a file, or the target text of a symbolic link. */
  content: string | Uint8Array;
  symlink: boolean;
  mode: number;
}

export type PlanOp =
  | { kind: 'delete'; path: string }
  | { kind: 'write'; path: string; content: string | Uint8Array; mode: number }
  | { kind: 'symlink'; path: string; target: string };

export interface InitPlan {
  ops: PlanOp[];
  /** Every versioned path after the init; the mentions check reads them from disk. */
  finalPaths: string[];
}

/** Reads every file Git tracks, treating symbolic links as links. */
export function readTrackedFiles(root: string, git: GitRunner): Map<string, Entry> {
  const listed = git(['ls-files', '-z']);
  if (!listed.ok) throw new InitError(`Could not list the versioned files.\n${listed.stderr.trim()}`);
  const files = new Map<string, Entry>();
  for (const file of listed.stdout.split('\0').filter(Boolean)) {
    const absolute = path.join(root, file);
    let stat;
    try {
      stat = lstatSync(absolute);
    } catch {
      continue;
    }
    if (stat.isSymbolicLink()) files.set(file, { content: readlinkSync(absolute), symlink: true, mode: stat.mode & 0o7777 });
    else if (stat.isFile()) files.set(file, { content: new Uint8Array(readFileSync(absolute)), symlink: false, mode: stat.mode & 0o7777 });
  }
  return files;
}

function sameContent(a: string | Uint8Array, b: string | Uint8Array): boolean {
  if (typeof a === 'string' && typeof b === 'string') return a === b;
  const left = typeof a === 'string' ? new TextEncoder().encode(a) : a;
  const right = typeof b === 'string' ? new TextEncoder().encode(b) : b;
  return left.length === right.length && left.every((byte, index) => byte === right[index]);
}

function textOf(entry: Entry | undefined, file: string): string {
  const text = entry ? decodeText(entry.content) : null;
  if (text === null) throw new InitError(`${file} is missing or is not a text file, so the init cannot update it.`);
  return text;
}

/** Sets the version and drops the `project:init` command, keeping the rest of the file as it is. */
function resetPackageJson(text: string): string {
  let parsed: { version?: string; scripts?: Record<string, string> };
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new InitError('package.json is not valid JSON, so the init cannot update it.');
  }
  parsed.version = INITIAL_VERSION;
  if (parsed.scripts) delete parsed.scripts['project:init'];
  return `${JSON.stringify(parsed, null, 2)}\n`;
}

export interface PlanInput {
  root: string;
  git: GitRunner;
  template: TemplateIdentity;
  project: ProjectText;
  baseCommit: string;
  version: string | null;
}

/**
 * Computes every change of the init in memory: the rename over the versioned files, the template-only deletions, the
 * new README and landing, the package version, the image tag and the metadata. Nothing is written here.
 */
export function buildPlan(input: PlanInput): InitPlan {
  const { template, project } = input;
  const original = readTrackedFiles(input.root, input.git);
  const current = new Map<string, Entry>();
  for (const [file, entry] of original) if (!isTemplateOnlyPath(file)) current.set(file, entry);

  // 1. Rename every template spelling, in contents and in paths.
  const sources: SourceFile[] = [...current].map(([file, entry]) => ({ path: file, content: entry.content }));
  const renamed = new Map(planRename(template, { name: project.name, slug: project.slug, repo: project.repo }, sources).map((change) => [change.path, change]));
  const next = new Map<string, Entry>();
  for (const [file, entry] of current) {
    const change = renamed.get(file);
    next.set(change?.newPath ?? file, { ...entry, content: change?.content ?? entry.content });
  }

  // 2. The released image tag of the template becomes the project's first version (only where images are documented
  //    or deployed: tests and scripts keep their sample tags).
  const ghcrRepo = project.repo ? project.repo.toLowerCase() : `OWNER/${project.slug}`;
  const imageTag = new RegExp(`(ghcr\\.io/${escapeRegExp(ghcrRepo)}):\\d+\\.\\d+\\.\\d+`, 'gi');
  for (const [file, entry] of next) {
    if (entry.symlink || !IMAGE_TAG_PREFIXES.some((prefix) => file.startsWith(prefix))) continue;
    const text = decodeText(entry.content);
    if (text === null) continue;
    const updated = text.replace(imageTag, (_match, image: string) => `${image}:${INITIAL_VERSION}`);
    if (updated !== text) next.set(file, { ...entry, content: updated });
  }

  // 3. Files that start the project: package.json, README, landing and metadata.
  const replace = (file: string, content: string) => {
    const existing = next.get(file);
    next.set(file, { content, symlink: false, mode: existing?.mode ?? 0o644 });
  };
  const packageJson = resetPackageJson(textOf(next.get('package.json'), 'package.json'));
  replace('package.json', packageJson);
  // bun install keeps the root workspace name of the lockfile, so it is renamed here (and only it).
  const lock = next.get('bun.lock');
  if (lock) {
    const packageName = (JSON.parse(packageJson) as { name: string }).name;
    const lockText = textOf(lock, 'bun.lock');
    const updated = renameLockWorkspace(lockText, packageName);
    if (updated !== lockText) next.set('bun.lock', { ...lock, content: updated });
  }
  replace('README.md', renderReadme(project));
  replace('app/page.tsx', renderLandingPage());
  replace('components/landing-content.tsx', renderLandingContent(project));
  const metadata: InitializedMetadata = {
    schemaVersion: 1,
    mode: 'initialized',
    project: { name: project.name, slug: project.slug, description: project.description, repo: project.repo },
    template: { ...template, baseCommit: input.baseCommit, version: input.version },
  };
  replace(METADATA_PATH, serializeProjectMetadata(metadata));

  // 4. The difference between what is on disk and what should be.
  const ops: PlanOp[] = [];
  for (const file of original.keys()) if (!next.has(file)) ops.push({ kind: 'delete', path: file });
  for (const [file, entry] of next) {
    const before = original.get(file);
    if (before && before.symlink === entry.symlink && sameContent(before.content, entry.content)) continue;
    ops.push(
      entry.symlink
        ? { kind: 'symlink', path: file, target: String(entry.content) }
        : { kind: 'write', path: file, content: entry.content, mode: entry.mode },
    );
  }
  ops.sort((a, b) => Number(b.kind === 'delete') - Number(a.kind === 'delete'));
  return { ops, finalPaths: [...next.keys()] };
}
