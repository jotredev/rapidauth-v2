import { lstatSync, readFileSync, readlinkSync } from 'node:fs';
import path from 'node:path';
import { TemplateError, type GitRunner, type TreeEntry } from './types';

const decoder = new TextDecoder();

/** Reads every file of a commit (contents, executable bit, symbolic links as links). Submodules are skipped. */
export function readTree(git: GitRunner, commit: string): Map<string, TreeEntry> {
  const listed = git(['ls-tree', '-r', '-z', commit]);
  if (!listed.ok) throw new TemplateError(`Could not read the files of template commit ${commit.slice(0, 7)}.\n${listed.stderr.trim()}`);

  const records: { mode: string; sha: string; file: string }[] = [];
  for (const record of listed.stdout.split('\0').filter(Boolean)) {
    const tab = record.indexOf('\t');
    const [mode, type, sha] = record.slice(0, tab).split(' ');
    if (type === 'blob') records.push({ mode, sha, file: record.slice(tab + 1) });
  }

  const shas = [...new Set(records.map((record) => record.sha))];
  const blobs = new Map<string, Uint8Array>();
  if (shas.length > 0) {
    const batch = git(['cat-file', '--batch'], `${shas.join('\n')}\n`);
    if (!batch.ok) throw new TemplateError(`Could not read the file contents of template commit ${commit.slice(0, 7)}.\n${batch.stderr.trim()}`);
    const bytes = batch.stdoutBytes;
    let offset = 0;
    for (const sha of shas) {
      const end = bytes.indexOf(10, offset);
      const [, type, size] = decoder.decode(bytes.subarray(offset, end)).split(' ');
      if (type !== 'blob' || size === undefined) throw new TemplateError(`Unexpected object ${sha} in template commit ${commit.slice(0, 7)}.`);
      const start = end + 1;
      blobs.set(sha, bytes.slice(start, start + Number(size)));
      offset = start + Number(size) + 1;
    }
  }

  const files = new Map<string, TreeEntry>();
  for (const { mode, sha, file } of records) {
    const content = blobs.get(sha) as Uint8Array;
    if (mode === '120000') files.set(file, { content: decoder.decode(content), symlink: true, mode: 0o644 });
    else files.set(file, { content: content.slice(), symlink: false, mode: mode === '100755' ? 0o755 : 0o644 });
  }
  return files;
}

/** The file or link at a project path, or undefined when nothing is there. */
export function readDiskEntry(root: string, file: string): TreeEntry | undefined {
  const absolute = path.join(root, file);
  let stat;
  try {
    stat = lstatSync(absolute);
  } catch {
    return undefined;
  }
  if (stat.isSymbolicLink()) return { content: readlinkSync(absolute), symlink: true, mode: stat.mode & 0o7777 };
  if (stat.isFile()) return { content: new Uint8Array(readFileSync(absolute)), symlink: false, mode: stat.mode & 0o7777 };
  throw new TemplateError(`${file} is a folder where a file is expected.`);
}

function bytesOf(content: string | Uint8Array): Uint8Array {
  return typeof content === 'string' ? new TextEncoder().encode(content) : content;
}

export function sameContent(a: string | Uint8Array, b: string | Uint8Array): boolean {
  if (typeof a === 'string' && typeof b === 'string') return a === b;
  const left = bytesOf(a);
  const right = bytesOf(b);
  return left.length === right.length && left.every((byte, index) => byte === right[index]);
}

/** Two entries are the same when both are missing, or both exist as the same kind with the same content. */
export function sameEntry(a: TreeEntry | undefined, b: TreeEntry | undefined): boolean {
  if (!a || !b) return !a && !b;
  return a.symlink === b.symlink && sameContent(a.content, b.content);
}
