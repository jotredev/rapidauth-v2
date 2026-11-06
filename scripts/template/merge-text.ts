import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { TemplateError, type GitRunner } from './types';

export interface TextMergeInput {
  /** The project's current text. */
  project: string;
  /** The text both sides started from (empty when the file was added on both sides). */
  base: string;
  /** The template's new text. */
  next: string;
  baseLabel: string;
  nextLabel: string;
}

export interface TextMergeResult {
  text: string;
  /** Number of conflicting regions left in `text`, marked with conflict markers. */
  conflicts: number;
}

/** Three-way merge of text with `git merge-file`; the exit code is the number of conflicts (above 127 is a Git error). */
export function mergeText(git: GitRunner, input: TextMergeInput): TextMergeResult {
  const dir = mkdtempSync(path.join(tmpdir(), 'template-merge-'));
  try {
    const files = [input.project, input.base, input.next].map((text, index) => {
      const file = path.join(dir, ['project', 'base', 'next'][index]);
      writeFileSync(file, text);
      return file;
    });
    const result = git(['merge-file', '-p', '--diff3', '-L', 'project', '-L', input.baseLabel, '-L', input.nextLabel, ...files]);
    if (result.status === null || result.status < 0 || result.status > 127) {
      throw new TemplateError(`git merge-file failed.\n${result.stderr.trim()}`);
    }
    return { text: result.stdout, conflicts: result.status };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}
