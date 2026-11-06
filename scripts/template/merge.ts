import { decodeText } from './files';
import { mergeText, type TextMergeResult } from './merge-text';
import { sameEntry } from './tree';
import type { GitRunner, TreeEntry } from './types';

export type ChangeAction = 'updated' | 'added' | 'deleted' | 'conflict';

/** One write to the project. A write without a mode keeps the mode the existing file has. */
export type MergeOp =
  | { kind: 'delete'; path: string }
  | { kind: 'write'; path: string; content: string | Uint8Array; mode?: number }
  | { kind: 'symlink'; path: string; target: string };

export interface PathChange {
  path: string;
  action: ChangeAction;
  ops: MergeOp[];
  /** Why a conflict needs a person. */
  reason?: string;
  /** Where the template side was written when the project's file was kept. */
  conflictFile?: string;
}

export interface MergeInput {
  path: string;
  base: TreeEntry | undefined;
  next: TreeEntry | undefined;
  project: TreeEntry | undefined;
  /** Label for the base side in conflict markers (`template 1.0.0`). */
  baseLabel: string;
  nextLabel: string;
  /** Version of the new template release, used in the name of the side file. */
  nextVersion: string;
}

/** Name of the file that holds the template's side when the project's file is kept. */
export function conflictFilePath(file: string, version: string): string {
  return `${file}.pull-conflict-${version}`;
}

function writeEntry(file: string, entry: TreeEntry, keepMode: boolean): MergeOp {
  return entry.symlink
    ? { kind: 'symlink', path: file, target: String(entry.content) }
    : { kind: 'write', path: file, content: entry.content, mode: keepMode ? undefined : entry.mode };
}

/** Keeps what the project has and writes the template's side next to it (when the template has content). */
function keepProject(input: MergeInput, reason: string): PathChange {
  const ops: MergeOp[] = [];
  let conflictFile: string | undefined;
  if (input.next) {
    conflictFile = conflictFilePath(input.path, input.nextVersion);
    ops.push(writeEntry(conflictFile, input.next, false));
  }
  return { path: input.path, action: 'conflict', ops, reason, conflictFile };
}

/**
 * Decides what happens to one path given its three states: the projected base template, the projected new template
 * and the project as it is on disk. Returns null when nothing changes. Only `git merge-file` is called, for text
 * changed on both sides.
 */
export function mergePath(git: GitRunner, input: MergeInput): PathChange | null {
  const { path: file, base, next, project } = input;

  if (sameEntry(project, next)) return null; // Same result on both sides (or both gone).
  if (sameEntry(base, next)) return null; // Only the project changed: keep it.

  if (sameEntry(base, project)) {
    // Only the template changed: take its version (additions and deletions too).
    if (!next) return { path: file, action: 'deleted', ops: [{ kind: 'delete', path: file }] };
    return { path: file, action: project ? 'updated' : 'added', ops: [writeEntry(file, next, project !== undefined && !project.symlink)] };
  }

  // Both sides changed, differently.
  if (!next) return keepProject(input, 'deleted in the template, changed in the project');
  if (!project) return keepProject(input, 'changed in the template, deleted in the project');
  if (project.symlink || next.symlink || (base?.symlink ?? false)) {
    return keepProject(input, 'a symbolic link changed on both sides');
  }

  const projectText = decodeText(project.content);
  const nextText = decodeText(next.content);
  const baseText = base ? decodeText(base.content) : '';
  if (projectText === null || nextText === null || baseText === null) {
    return keepProject(input, 'a binary file changed on both sides');
  }

  const merged: TextMergeResult = mergeText(git, {
    project: projectText,
    base: baseText,
    next: nextText,
    baseLabel: input.baseLabel,
    nextLabel: input.nextLabel,
  });
  const ops: MergeOp[] = merged.text === projectText ? [] : [{ kind: 'write', path: file, content: merged.text }];
  if (merged.conflicts > 0) {
    const regions = merged.conflicts === 1 ? '1 conflicting region' : `${merged.conflicts} conflicting regions`;
    return { path: file, action: 'conflict', ops, reason: `${regions}, marked in the file` };
  }
  return ops.length > 0 ? { path: file, action: 'updated', ops } : null;
}
