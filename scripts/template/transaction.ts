import { chmodSync, existsSync, lstatSync, mkdirSync, readFileSync, readdirSync, readlinkSync, rmSync, rmdirSync, symlinkSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import type { FsOps } from './types';

/** The real file operations. */
export const nodeFs: FsOps = {
  writeFile(absolute, data, mode) {
    writeFileSync(absolute, data);
    if (mode !== undefined) chmodSync(absolute, mode);
  },
  symlink: (target, absolute) => symlinkSync(target, absolute),
  removeFile: (absolute) => rmSync(absolute, { force: true }),
  makeDir: (absolute) => mkdirSync(absolute),
  removeDir: (absolute) => rmdirSync(absolute),
};

type Snapshot =
  | { kind: 'missing' }
  | { kind: 'file'; bytes: Uint8Array; mode: number }
  | { kind: 'symlink'; target: string };

/**
 * Applies file changes under a root and can undo all of them byte for byte. Every path is snapshotted (content, mode,
 * existence, symlink) before its first change, and the directories it creates are remembered. Writes go through the
 * injected `FsOps`; the rollback uses the real file system so a failing writer cannot break it.
 */
export class Transaction {
  private readonly snapshots = new Map<string, Snapshot>();
  private readonly createdDirs: string[] = [];

  constructor(
    private readonly root: string,
    private readonly fs: FsOps,
  ) {}

  private absolute(relative: string): string {
    return path.join(this.root, relative);
  }

  private snapshot(relative: string): void {
    if (this.snapshots.has(relative)) return;
    const absolute = this.absolute(relative);
    let stat;
    try {
      stat = lstatSync(absolute);
    } catch {
      this.snapshots.set(relative, { kind: 'missing' });
      return;
    }
    if (stat.isSymbolicLink()) this.snapshots.set(relative, { kind: 'symlink', target: readlinkSync(absolute) });
    else if (stat.isFile()) this.snapshots.set(relative, { kind: 'file', bytes: new Uint8Array(readFileSync(absolute)), mode: stat.mode & 0o7777 });
    else throw new Error(`${relative} is not a regular file or a symbolic link.`);
  }

  private ensureParent(relative: string): void {
    const missing: string[] = [];
    for (let dir = path.dirname(relative); dir !== '.' && dir !== '' && !existsSync(this.absolute(dir)); dir = path.dirname(dir)) {
      missing.unshift(dir);
    }
    for (const dir of missing) {
      this.fs.makeDir(this.absolute(dir));
      this.createdDirs.push(dir);
    }
  }

  write(relative: string, data: string | Uint8Array, mode?: number): void {
    this.snapshot(relative);
    // A file is rewritten in place (keeps its mode); a link must go first or the write would follow it.
    if (isSymlink(this.absolute(relative))) this.fs.removeFile(this.absolute(relative));
    this.ensureParent(relative);
    this.fs.writeFile(this.absolute(relative), data, mode);
  }

  symlink(relative: string, target: string): void {
    this.snapshot(relative);
    this.remove(relative, true);
    this.ensureParent(relative);
    this.fs.symlink(target, this.absolute(relative));
  }

  /** Deletes a file or link and then the directories it leaves empty. */
  remove(relative: string, keepDirs = false): void {
    this.snapshot(relative);
    if (isPresent(this.absolute(relative))) this.fs.removeFile(this.absolute(relative));
    if (keepDirs) return;
    for (let dir = path.dirname(relative); dir !== '.' && dir !== ''; dir = path.dirname(dir)) {
      const absolute = this.absolute(dir);
      if (!existsSync(absolute) || readdirSync(absolute).length > 0) break;
      this.fs.removeDir(absolute);
    }
  }

  /** Puts every touched path back as it was and removes the directories this transaction created. */
  rollback(): void {
    for (const [relative, snapshot] of [...this.snapshots].reverse()) {
      const absolute = this.absolute(relative);
      rmSync(absolute, { force: true });
      if (snapshot.kind === 'missing') continue;
      mkdirSync(path.dirname(absolute), { recursive: true });
      if (snapshot.kind === 'symlink') symlinkSync(snapshot.target, absolute);
      else {
        writeFileSync(absolute, snapshot.bytes);
        chmodSync(absolute, snapshot.mode);
      }
    }
    for (const dir of [...this.createdDirs].reverse()) {
      try {
        rmdirSync(this.absolute(dir));
      } catch {
        // Not empty or already gone: leave it.
      }
    }
  }
}

function isPresent(absolute: string): boolean {
  try {
    lstatSync(absolute);
    return true;
  } catch {
    return false;
  }
}

function isSymlink(absolute: string): boolean {
  try {
    return lstatSync(absolute).isSymbolicLink();
  } catch {
    return false;
  }
}
