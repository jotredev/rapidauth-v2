/** A file given to the rename engine or the mentions check: a repository path and its bytes or text. */
export interface SourceFile {
  path: string;
  content: string | Uint8Array;
}

/**
 * External references kept on purpose: files that point at real resources outside this project (published theme
 * repositories and their preview pages). An initialized project keeps installing them, so they are neither renamed
 * nor reported as mentions.
 */
export const EXTERNAL_REFERENCE_PATHS: readonly string[] = ['themes/registry.json'];

/** Paths whose content is never rewritten: the lockfile is regenerated and the metadata is written on purpose. */
export const RENAME_SKIPPED_PATHS: ReadonlySet<string> = new Set([
  'bun.lock',
  '.setup/project.json',
  ...EXTERNAL_REFERENCE_PATHS,
]);

/** Paths the mentions check does not read. `.setup/project.json` is handled separately (see mentions.ts). */
export const MENTIONS_SKIPPED_PATHS: ReadonlySet<string> = new Set(['bun.lock', ...EXTERNAL_REFERENCE_PATHS]);

const decoder = new TextDecoder('utf-8', { fatal: true });

/** Returns the text of a file, or null when it is binary (a NUL byte or invalid UTF-8). */
export function decodeText(content: string | Uint8Array): string | null {
  if (typeof content === 'string') return content;
  if (content.subarray(0, 8000).includes(0)) return null;
  try {
    return decoder.decode(content);
  } catch {
    return null;
  }
}
