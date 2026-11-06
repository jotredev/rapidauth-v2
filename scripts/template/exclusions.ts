import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { z } from 'zod';
import { formatIssues } from './metadata';
import { TemplateError } from './types';

/** Optional list of template paths the project keeps for itself, relative to the project root. */
export const EXCLUSIONS_PATH = '.setup/template-exclusions.json';

/** A path or a folder (ending with a slash) inside the project: no globs, no `..`, no absolute paths. */
const entrySchema = z
  .string()
  .min(1)
  .refine((value) => !value.startsWith('/') && !value.includes('\\') && !value.includes('//'), 'Use a path relative to the project root with forward slashes.')
  .refine((value) => !value.split('/').some((part) => part === '..' || part === '.'), 'Do not use "." or ".." segments.')
  .refine((value) => !/[*?[\]{}!]/.test(value), 'Globs are not supported: list a file path, or a folder ending with a slash.');

const exclusionsSchema = z.strictObject({
  schemaVersion: z.literal(1),
  exclude: z.array(entrySchema),
});

/** Reads the exclusions file; no file means no exclusions. An invalid file stops the pull. */
export function readExclusions(root: string): string[] {
  const file = path.join(root, EXCLUSIONS_PATH);
  if (!existsSync(file)) return [];
  let raw: unknown;
  try {
    raw = JSON.parse(readFileSync(file, 'utf8'));
  } catch (error) {
    throw new TemplateError(`${EXCLUSIONS_PATH} is not valid JSON: ${error instanceof Error ? error.message : String(error)}`);
  }
  const result = exclusionsSchema.safeParse(raw);
  if (!result.success) throw new TemplateError(`${EXCLUSIONS_PATH} is invalid:\n${formatIssues(result.error)}`);
  return result.data.exclude;
}
