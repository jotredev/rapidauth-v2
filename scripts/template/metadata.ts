import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { z } from 'zod';

/** Location of the versioned project metadata, relative to the project root. */
export const METADATA_PATH = '.setup/project.json';

/** Project names end up in UI text, YAML, shell and TypeScript strings, so they stay plain. */
const NAME_PATTERN = /^[\p{L}\p{N}][\p{L}\p{N} .-]{0,48}$/u;
/** Lowercase letters, digits and single hyphens, starting with a letter (valid Docker, Postgres and identifier base). */
const SLUG_PATTERN = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;
const REPO_PATTERN = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})\/[A-Za-z0-9._-]{1,100}$/;

export const projectNameSchema = z
  .string()
  .regex(NAME_PATTERN, 'Use letters, digits, spaces, dots and hyphens only (up to 49 characters, starting with a letter or digit).')
  .refine((value) => !/ {2,}|\s$/.test(value), 'Use single spaces and no trailing space.');

export const projectSlugSchema = z
  .string()
  .max(50, 'Use at most 50 characters.')
  .regex(SLUG_PATTERN, 'Use lowercase letters, digits and single hyphens, starting with a letter.');

export const githubRepoSchema = z.string().regex(REPO_PATTERN, 'Use the owner/repo form, for example acme/acme-portal.');

/** What the person answers; every other project name form is derived from these. */
export const projectAnswersSchema = z.strictObject({
  name: projectNameSchema,
  slug: projectSlugSchema,
  repo: githubRepoSchema.nullable(),
});

/** How the template spells its own name. Read from the metadata file, never written in code. */
export const templateIdentitySchema = z.strictObject({
  name: z.string().min(1),
  slug: projectSlugSchema,
  /** Template-specific spellings that cannot be derived from the name or slug (repository name, package name...). */
  aliases: z.array(z.string().min(1)),
  origin: z.url(),
});

const templateModeSchema = z.strictObject({
  schemaVersion: z.literal(1),
  mode: z.literal('template'),
  template: templateIdentitySchema,
});

const initializedSchema = z.strictObject({
  schemaVersion: z.literal(1),
  mode: z.literal('initialized'),
  project: z.strictObject({
    name: projectNameSchema,
    slug: projectSlugSchema,
    description: z.string(),
    repo: githubRepoSchema.nullable(),
  }),
  template: templateIdentitySchema.extend({
    /** Full SHA of the template commit the project was created from (or last pulled to). */
    baseCommit: z.string().regex(/^[0-9a-f]{40}$/, 'Use a full 40-character lowercase commit SHA.'),
    /** Last template release received, without the leading v. */
    version: z.string().regex(/^\d+\.\d+\.\d+$/, 'Use the X.Y.Z form.'),
  }),
});

const metadataSchema = z.discriminatedUnion('mode', [templateModeSchema, initializedSchema]);

export type TemplateIdentity = z.infer<typeof templateIdentitySchema>;
export type ProjectAnswers = z.infer<typeof projectAnswersSchema>;
export type TemplateModeMetadata = z.infer<typeof templateModeSchema>;
export type InitializedMetadata = z.infer<typeof initializedSchema>;
export type ProjectMetadata = TemplateModeMetadata | InitializedMetadata;

export class MetadataError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MetadataError';
  }
}

export function formatIssues(error: z.ZodError): string {
  return error.issues.map((issue) => `  - ${issue.path.join('.') || '(root)'}: ${issue.message}`).join('\n');
}

/** Validates the text of the metadata file and fails with a message that says what is wrong. */
export function parseProjectMetadata(text: string, source: string = METADATA_PATH): ProjectMetadata {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch (error) {
    throw new MetadataError(`${source} is not valid JSON: ${error instanceof Error ? error.message : String(error)}`);
  }
  const result = metadataSchema.safeParse(raw);
  if (!result.success) throw new MetadataError(`${source} is invalid:\n${formatIssues(result.error)}`);
  return result.data;
}

/** Reads and validates `.setup/project.json` under `root`. */
export function readProjectMetadata(root: string): ProjectMetadata {
  const file = path.join(root, METADATA_PATH);
  if (!existsSync(file)) throw new MetadataError(`${METADATA_PATH} was not found in ${root}.`);
  return parseProjectMetadata(readFileSync(file, 'utf8'), METADATA_PATH);
}

/** Stable text form of the metadata file: two-space JSON with a trailing newline. */
export function serializeProjectMetadata(metadata: ProjectMetadata): string {
  const parsed = parseProjectMetadata(JSON.stringify(metadata));
  return `${JSON.stringify(parsed, null, 2)}\n`;
}

/** Template identity (the part the rename engine and the mentions check need). */
export function templateIdentityOf(metadata: ProjectMetadata): TemplateIdentity {
  const { name, slug, aliases, origin } = metadata.template;
  return { name, slug, aliases: [...aliases], origin };
}

/** Project answers stored in an initialized project; null in template mode. */
export function projectAnswersOf(metadata: ProjectMetadata): ProjectAnswers | null {
  if (metadata.mode !== 'initialized') return null;
  const { name, slug, repo } = metadata.project;
  return { name, slug, repo };
}
