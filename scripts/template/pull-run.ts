import { lstatSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { readExclusions } from './exclusions';
import { decodeText } from './files';
import { deleteRefs } from './git';
import { mergePath, type MergeOp, type PathChange } from './merge';
import { findMentions, formatMentions } from './mentions';
import {
  MetadataError,
  METADATA_PATH,
  projectAnswersOf,
  readProjectMetadata,
  serializeProjectMetadata,
  templateIdentityOf,
  type InitializedMetadata,
} from './metadata';
import { classifyPath, isThemeSyncedPath } from './paths';
import { projectTemplateTree } from './projection';
import { readDiskEntry, readTree } from './tree';
import { TemplateError, type FsOps, type GitRunner, type Reporter, type TreeEntry } from './types';
import { Transaction } from './transaction';
import { compareVersions, majorOf, parseLsRemoteTags } from './versions';

/** Temporary namespace for the template's branches and tags. Never the template name; always deleted. */
export const PULL_REF_PREFIX = 'refs/template-pull';

export interface PullFlags {
  /** Accept a jump to a new major version. */
  allowMajor: boolean;
  /** Plan and report, write nothing. */
  dryRun: boolean;
}

export interface PullContext {
  /** Project root: the folder with `.setup/project.json`. */
  root: string;
  flags: PullFlags;
  terminal: Reporter;
  git: GitRunner;
  fs: FsOps;
}

export interface PullResult {
  status: 'up-to-date' | 'dry-run' | 'applied';
  from: string | null;
  to: string | null;
  updated: string[];
  added: string[];
  deleted: string[];
  conflicts: { path: string; reason: string; conflictFile?: string }[];
}

/** A refusal or failure that leaves the project unchanged. The message is shown as is. */
export class PullError extends TemplateError {
  constructor(message: string) {
    super(message);
    this.name = 'PullError';
  }
}

const OPEN_MARKER = '<<<<<<< project';
const CLOSE_MARKER = '>>>>>>> template ';
const MAX_SCANNED_BYTES = 4 * 1024 * 1024;

/** Fails when an earlier pull left conflicts: side files, or text files with the markers this command writes. */
function assertNoLeftoverConflicts(root: string, git: GitRunner): void {
  const listed = git(['ls-files', '-z', '--cached', '--others', '--exclude-standard']);
  if (!listed.ok) throw new PullError(`Could not list the project files.\n${listed.stderr.trim()}`);
  const found: string[] = [];
  for (const file of listed.stdout.split('\0').filter(Boolean)) {
    if (/\.pull-conflict-[^/]*$/.test(file)) {
      found.push(file);
      continue;
    }
    const absolute = path.join(root, file);
    let stat;
    try {
      stat = lstatSync(absolute);
    } catch {
      continue; // Deleted in the work tree.
    }
    if (!stat.isFile() || stat.size > MAX_SCANNED_BYTES) continue;
    const text = decodeText(new Uint8Array(readFileSync(absolute)));
    if (text === null) continue;
    const lines = text.split(/\r?\n/);
    const open = lines.findIndex((line) => line.startsWith(OPEN_MARKER));
    if (open >= 0 && lines.slice(open + 1).some((line) => line.startsWith(CLOSE_MARKER))) found.push(file);
  }
  if (found.length > 0) {
    throw new PullError(
      `A previous template pull left conflicts to resolve. Fix these, delete the *.pull-conflict-* files, and run the pull again:\n${found.map((file) => `  ${file}`).join('\n')}`,
    );
  }
}

function assertCleanWorkTree(git: GitRunner): void {
  if (!git(['rev-parse', '--is-inside-work-tree']).ok) throw new PullError('This folder is not a Git repository.');
  const status = git(['status', '--porcelain']);
  if (!status.ok) throw new PullError(`Could not read the Git status.\n${status.stderr.trim()}`);
  if (status.stdout.trim()) {
    throw new PullError(
      `The Git working tree has unsaved changes. Commit or discard them first, so the pull is easy to review and to undo:\n${status.stdout.trimEnd()}`,
    );
  }
}

/** Paths Git ignores in this project: they do not exist for the pull. */
function ignoredPaths(git: GitRunner, paths: string[]): Set<string> {
  if (paths.length === 0) return new Set();
  const result = git(['check-ignore', '-z', '--stdin'], `${paths.join('\0')}\0`);
  if (result.status !== 0 && result.status !== 1) throw new PullError(`Could not check the ignored paths.\n${result.stderr.trim()}`);
  return new Set(result.stdout.split('\0').filter(Boolean));
}

/** A write must never go through a symbolic link or a file standing where a folder is needed. */
function assertSafeParents(root: string, file: string): void {
  const parts = file.split('/');
  for (let index = 1; index < parts.length; index++) {
    const relative = parts.slice(0, index).join('/');
    let stat;
    try {
      stat = lstatSync(path.join(root, relative));
    } catch {
      return; // Nothing from here down exists yet.
    }
    if (stat.isSymbolicLink()) throw new PullError(`Cannot write ${file}: ${relative} is a symbolic link. Nothing was changed.`);
    if (!stat.isDirectory()) throw new PullError(`Cannot write ${file}: ${relative} is a file. Nothing was changed.`);
  }
}

function releaseWord(version: string | null, commit: string): string {
  return version ?? commit.slice(0, 7);
}

/**
 * Brings the latest published template release into an initialized project. Guards, version choice, projection of the
 * base and new template trees, a per-path merge, one atomic write, and a report. Throws `PullError` (nothing changed).
 */
export function runPull(context: PullContext): PullResult {
  const { root, git, terminal, flags } = context;

  // Guards, before any network.
  let metadata;
  try {
    metadata = readProjectMetadata(root);
  } catch (error) {
    if (error instanceof MetadataError) throw new PullError(`${error.message}\nRun this command from the root of a project made from the template.`);
    throw error;
  }
  if (metadata.mode !== 'initialized') {
    throw new PullError('This is the template itself, not a project made from it. Run `bun run project:init` in a copy of the template first.');
  }
  const exclusions = readExclusions(root);
  assertNoLeftoverConflicts(root, git);
  assertCleanWorkTree(git);

  // Which release.
  const origin = metadata.template.origin;
  const recorded = metadata.template.version;
  terminal.info(`Checking the template for new versions (${origin})...`);
  const listed = git(['ls-remote', '--tags', origin]);
  if (!listed.ok) {
    throw new PullError(`Could not reach the template at ${origin}. Check your connection and try again. Nothing was changed.\n${listed.stderr.trim()}`.trim());
  }
  const versions = [...parseLsRemoteTags(listed.stdout).keys()].sort(compareVersions);
  const latest = versions.at(-1);
  const emptyResult = (to: string | null): PullResult => ({ status: 'up-to-date', from: recorded, to, updated: [], added: [], deleted: [], conflicts: [] });
  if (!latest) {
    terminal.info('The template has no published versions yet. Nothing to pull.');
    return emptyResult(null);
  }
  if (recorded !== null && compareVersions(latest, recorded) <= 0) {
    terminal.success(`Already up to date (template version ${recorded}).`);
    return emptyResult(recorded);
  }
  if (recorded !== null && majorOf(latest) > majorOf(recorded) && !flags.allowMajor) {
    throw new PullError(
      `Version ${latest} is a new major version after ${recorded}, which can contain breaking changes. Read the template release notes, then run again with --allow-major. Nothing was changed.`,
    );
  }
  const crossed = versions.filter((version) => (recorded === null || compareVersions(version, recorded) > 0) && compareVersions(version, latest) <= 0);
  terminal.info(`Pulling template ${recorded ?? 'history'} -> ${latest}${crossed.length > 1 ? ` (versions crossed: ${crossed.join(', ')})` : ''}.`);

  // Trees: base and new, from a temporary namespace that is always removed.
  const baseCommit = metadata.template.baseCommit;
  let baseTree: Map<string, TreeEntry>;
  let newTree: Map<string, TreeEntry>;
  let newCommit: string;
  deleteRefs(git, PULL_REF_PREFIX);
  try {
    const fetched = git([
      'fetch',
      '--quiet',
      '--no-tags',
      '--force',
      origin,
      `+refs/heads/*:${PULL_REF_PREFIX}/heads/*`,
      `+refs/tags/*:${PULL_REF_PREFIX}/tags/*`,
    ]);
    if (!fetched.ok) {
      throw new PullError(`Could not download the template from ${origin}. Check your connection and try again. Nothing was changed.\n${fetched.stderr.trim()}`.trim());
    }
    if (!git(['cat-file', '-e', `${baseCommit}^{commit}`]).ok) {
      throw new PullError(
        `The template commit this project is based on (${baseCommit.slice(0, 7)}) is not in the template history any more, so the changes cannot be merged. Nothing was changed.`,
      );
    }
    const resolved = git(['rev-parse', '--verify', `${PULL_REF_PREFIX}/tags/${latest}^{commit}`]);
    if (!resolved.ok) throw new PullError(`Could not find the commit of template version ${latest}. Nothing was changed.\n${resolved.stderr.trim()}`);
    newCommit = resolved.stdout.trim();
    baseTree = readTree(git, baseCommit);
    newTree = readTree(git, newCommit);
  } finally {
    deleteRefs(git, PULL_REF_PREFIX);
  }

  // Projection with the project's own answers, then the merge path by path.
  const identity = templateIdentityOf(metadata);
  const answers = projectAnswersOf(metadata);
  if (!answers) throw new PullError('The project metadata has no project answers.');
  const projection = { template: identity, project: answers };
  const baseProjected = projectTemplateTree(baseTree, projection);
  const newProjected = projectTemplateTree(newTree, projection);

  const baseLabel = `template ${releaseWord(recorded, baseCommit)}`;
  const nextLabel = `template ${latest}`;
  const changes: PathChange[] = [];
  const candidates = [...new Set([...baseProjected.keys(), ...newProjected.keys()])]
    .filter((file) => classifyPath(file, exclusions) === 'template')
    .sort();
  for (const file of candidates) {
    const change = mergePath(git, {
      path: file,
      base: baseProjected.get(file),
      next: newProjected.get(file),
      project: readDiskEntry(root, file),
      baseLabel,
      nextLabel,
      nextVersion: latest,
    });
    if (change) changes.push(change);
  }
  for (const change of changes) for (const op of change.ops) assertSafeParents(root, op.path);
  const ignored = ignoredPaths(git, changes.map((change) => change.path));
  const plan = changes.filter((change) => !ignored.has(change.path));

  const ops: MergeOp[] = plan.flatMap((change) => change.ops);
  const updatedMetadata: InitializedMetadata = { ...metadata, template: { ...metadata.template, baseCommit: newCommit, version: latest } };

  const result: PullResult = {
    status: flags.dryRun ? 'dry-run' : 'applied',
    from: recorded,
    to: latest,
    updated: plan.filter((change) => change.action === 'updated').map((change) => change.path),
    added: plan.filter((change) => change.action === 'added').map((change) => change.path),
    deleted: plan.filter((change) => change.action === 'deleted').map((change) => change.path),
    conflicts: plan
      .filter((change) => change.action === 'conflict')
      .map((change) => ({ path: change.path, reason: change.reason ?? 'conflict', conflictFile: change.conflictFile })),
  };

  if (!flags.dryRun) {
    const transaction = new Transaction(root, context.fs);
    try {
      for (const op of ops) {
        if (op.kind === 'delete') transaction.remove(op.path);
        else if (op.kind === 'symlink') transaction.symlink(op.path, op.target);
        else transaction.write(op.path, op.content, op.mode);
      }
      transaction.write(METADATA_PATH, serializeProjectMetadata(updatedMetadata));
    } catch (error) {
      transaction.rollback();
      throw new PullError(`The pull failed and every change was undone: ${error instanceof Error ? error.message : String(error)}`);
    }
    warnAboutMentions(context, identity, ops);
  }
  report(context, result, plan, flags.dryRun);
  return result;
}

/** A new spelling of the template name that the project's rename engine does not know yet: only worth a warning. */
function warnAboutMentions(context: PullContext, identity: ReturnType<typeof templateIdentityOf>, ops: MergeOp[]): void {
  try {
    const files = ops
      .filter((op) => op.kind !== 'delete')
      .map((op) => ({ path: op.path, content: readDiskEntry(context.root, op.path)?.content ?? '' }));
    const mentions = findMentions(identity, files);
    if (mentions.length > 0) {
      context.terminal.warn(
        `Some pulled files still mention the template. Its newest release uses a spelling the rename engine of this project does not know yet; the engine is updated by this pull, so the next pull handles it. Rename these by hand:\n${formatMentions(mentions)}`,
      );
    }
  } catch {
    // The check is a courtesy: never let it hide a finished pull.
  }
}

function listPaths(paths: string[]): string {
  return paths.map((file) => `  ${file}`).join('\n');
}

function report(context: PullContext, result: PullResult, plan: PathChange[], dryRun: boolean): void {
  const { terminal } = context;
  const lines = [
    `${dryRun ? 'Would update' : 'Updated'} template ${result.from ?? 'history'} -> ${result.to}`,
    `${result.updated.length} updated, ${result.added.length} added, ${result.deleted.length} deleted, ${result.conflicts.length} in conflict`,
  ];
  terminal.success(lines.join('\n'));
  if (dryRun) {
    const detail = [
      result.updated.length ? `Would update:\n${listPaths(result.updated)}` : '',
      result.added.length ? `Would add:\n${listPaths(result.added)}` : '',
      result.deleted.length ? `Would delete:\n${listPaths(result.deleted)}` : '',
    ].filter(Boolean);
    if (detail.length > 0) terminal.info(detail.join('\n'));
  }
  if (result.conflicts.length > 0) {
    terminal.warn(
      `${dryRun ? 'Conflicts you would have to resolve' : 'Conflicts to resolve by hand'}:\n${result.conflicts
        .map((conflict) => `  ${conflict.path}: ${conflict.reason}${conflict.conflictFile ? ` (template side: ${conflict.conflictFile})` : ''}`)
        .join('\n')}`,
    );
  }

  const touched = plan.map((change) => change.path);
  const steps: string[] = [];
  if (result.conflicts.length > 0) steps.push('Resolve the conflicts above (remove the markers, or delete the *.pull-conflict-* files after merging by hand).');
  if (touched.includes('package.json')) steps.push('package.json changed: resolve its conflicts if any, then run `bun install` (it also refreshes bun.lock).');
  if (plan.some((change) => change.path.startsWith('prisma/migrations/') && change.action !== 'deleted')) {
    steps.push('New or changed migrations arrived: run `bun run db:deploy`.');
  }
  if (touched.some(isThemeSyncedPath)) steps.push('Theme files changed: run `bun run theme:sync-classic`.');
  if (!dryRun) steps.push('Review the changes with git diff, then commit them on your own branch. Nothing was committed.');
  if (steps.length > 0) terminal.info(`Next steps:\n${steps.map((step) => `  - ${step}`).join('\n')}`);
}
