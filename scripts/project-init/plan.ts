import { lstatSync, readFileSync, readlinkSync } from 'node:fs';
import path from 'node:path';
import { METADATA_PATH, serializeProjectMetadata, type InitializedMetadata, type TemplateIdentity } from '../template/metadata';
import { projectTemplateTree } from '../template/projection';
import { sameContent } from '../template/tree';
import type { TreeEntry } from '../template/types';
import { renderLandingContent, renderLandingPage, renderReadme, type ProjectText } from './content';
import { InitError, type GitRunner } from './types';

export { INITIAL_VERSION } from '../template/projection';

export type Entry = TreeEntry;

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

  // 1. Everything the template content goes through: the same projection `template:pull` applies to both trees.
  const next = projectTemplateTree(original, { template, project });

  // 2. Files the init writes from scratch: README, landing and metadata.
  const replace = (file: string, content: string) => {
    const existing = next.get(file);
    next.set(file, { content, symlink: false, mode: existing?.mode ?? 0o644 });
  };
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

  // 3. The difference between what is on disk and what should be.
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
