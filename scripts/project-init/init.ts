import { readFileSync, lstatSync, readlinkSync } from 'node:fs';
import path from 'node:path';
import type { SourceFile } from '../template/files';
import { buildMentionPattern, parseGitHubRepo } from '../template/forms';
import { MetadataError, githubRepoSchema, projectNameSchema, projectSlugSchema, readProjectMetadata, templateIdentityOf, type ProjectAnswers, type TemplateIdentity } from '../template/metadata';
import { findMentions, formatMentions } from '../template/mentions';
import { assertCleanRepository, findBaseVersion, originIs, originUrl } from './git';
import { buildPlan } from './plan';
import { startProject, type StartOutcome } from './start';
import { Transaction } from './transaction';
import { InitError, type InitContext, type StartMode } from './types';

export interface InitResult {
  answers: ProjectAnswers & { description: string };
  start: StartOutcome;
  /** Things that did not work after the project was initialized (install, theme sync, start mode). */
  warnings: string[];
}

/** Suggests a slug from a project name: "Acme Portal" becomes "acme-portal". */
export function suggestSlug(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function firstIssue(result: { success: boolean; error?: { issues: { message: string }[] } }): string | undefined {
  return result.success ? undefined : result.error?.issues[0]?.message;
}

function mentionsTemplate(template: TemplateIdentity, value: string): boolean {
  return buildMentionPattern(template).test(value);
}

function validateName(template: TemplateIdentity, value: string): string | undefined {
  return firstIssue(projectNameSchema.safeParse(value)) ?? (mentionsTemplate(template, value) ? 'Choose a name different from the template.' : undefined);
}

function validateSlug(template: TemplateIdentity, value: string): string | undefined {
  return firstIssue(projectSlugSchema.safeParse(value)) ?? (mentionsTemplate(template, value) ? 'Choose a slug different from the template.' : undefined);
}

function validateRepo(value: string): string | undefined {
  return value === '' ? undefined : firstIssue(githubRepoSchema.safeParse(value));
}

/** Uses the flag when given, asks when a person can answer, and fails with a clear message otherwise. */
async function answer(
  context: InitContext,
  flag: string | undefined,
  missing: string,
  ask: () => Promise<string>,
  validate: (value: string) => string | undefined,
): Promise<string> {
  const value = flag !== undefined ? flag.trim() : context.terminal.interactive ? (await ask()).trim() : undefined;
  if (value === undefined) throw new InitError(missing);
  const problem = validate(value);
  if (problem) throw new InitError(`Invalid value "${value}": ${problem}`);
  return value;
}

async function confirmTemplateFolder(context: InitContext, template: TemplateIdentity): Promise<void> {
  if (!originIs(context.git, template.origin)) return;
  const origin = originUrl(context.git);
  context.terminal.warn(
    `This folder points at the template repository itself (${origin}). Initializing it turns the template into a project and deletes its Engram memory folder.`,
  );
  const typed =
    context.flags.confirmTemplate ??
    (context.terminal.interactive ? await context.terminal.text({ message: `Type "${template.slug}" to continue` }) : undefined);
  if (typed?.trim() !== template.slug) {
    throw new InitError(`Not confirmed: the template slug "${template.slug}" was not typed. Nothing was changed.`);
  }
}

function readFinalFiles(root: string, paths: string[]): SourceFile[] {
  return paths.map((file) => {
    const absolute = path.join(root, file);
    return { path: file, content: lstatSync(absolute).isSymbolicLink() ? readlinkSync(absolute) : new Uint8Array(readFileSync(absolute)) };
  });
}

/** Runs one command after the project is initialized; a failure is reported but never undoes the init. */
function runFollowUp(context: InitContext, label: string, command: string, args: string[], warnings: string[]): void {
  context.terminal.info(`${label}...`);
  const result = context.run(command, args, { cwd: context.root, inherit: true });
  if (result.status !== 0) {
    const text = `${label} failed${result.error ? ` (${result.error})` : ''}. Run \`${[command, ...args].join(' ')}\` yourself.`;
    warnings.push(text);
    context.terminal.warn(text);
  }
}

/**
 * Turns a fresh copy of the template into a project: guards, base version, questions, one atomic set of changes,
 * and the chosen way to start. Throws `InitError` (nothing changed) or `InitCancelled`.
 */
export async function runInit(context: InitContext): Promise<InitResult> {
  const { terminal, flags, root } = context;

  // Guards, before any question.
  let metadata;
  try {
    metadata = readProjectMetadata(root);
  } catch (error) {
    if (error instanceof MetadataError) throw new InitError(`${error.message}\nRun this command from the root of a project made from the template.`);
    throw error;
  }
  if (metadata.mode === 'initialized') {
    throw new InitError(
      `This project is already initialized as "${metadata.project.name}". The init runs once and cannot be repeated.`,
    );
  }
  const template = templateIdentityOf(metadata);
  assertCleanRepository(context.git);
  if (!terminal.interactive && !flags.start) {
    throw new InitError('There is no terminal to ask questions. Pass --name, --slug and --start (docker, prod or later); --description and --repo are optional.');
  }
  await confirmTemplateFolder(context, template);

  // Which template version this copy came from (also proves the copy is untouched).
  terminal.info('Looking for the template version this copy was made from...');
  const base = findBaseVersion(context.git, template.origin);
  terminal.info(base.version ? `Based on template version ${base.version} (${base.baseCommit.slice(0, 7)}).` : `Based on template commit ${base.baseCommit.slice(0, 7)} (no release tag yet).`);

  // Questions.
  const name = await answer(
    context,
    flags.name,
    'Pass --name "Project Name".',
    () => terminal.text({ message: 'Project name', placeholder: 'Acme Portal', validate: (value) => validateName(template, value.trim()) }),
    (value) => validateName(template, value),
  );
  const slug = await answer(
    context,
    flags.slug,
    'Pass --slug project-slug.',
    () => terminal.text({ message: 'Project slug (lowercase letters, digits and hyphens)', initialValue: suggestSlug(name), validate: (value) => validateSlug(template, value.trim()) }),
    (value) => validateSlug(template, value),
  );
  const description = (
    flags.description ?? (terminal.interactive ? await terminal.text({ message: 'One-line description', placeholder: 'What does this project do?' }) : '')
  ).trim();

  const origin = originUrl(context.git);
  const originRepo = origin && !originIs(context.git, template.origin) ? parseGitHubRepo(origin) : null;
  const suggestedRepo = originRepo ? `${originRepo.owner}/${originRepo.repo}` : '';
  const repoText = await answer(
    context,
    flags.repo ?? (terminal.interactive ? undefined : suggestedRepo),
    '',
    () =>
      terminal.text({
        message: 'GitHub repository (owner/repo, empty to set it later)',
        initialValue: suggestedRepo,
        validate: (value) => validateRepo(value.trim()),
      }),
    validateRepo,
  );
  const answers = { name, slug, repo: repoText === '' ? null : repoText };

  // Compute every change in memory, then write them all or none.
  const plan = buildPlan({ root, git: context.git, template, project: { ...answers, description }, baseCommit: base.baseCommit, version: base.version });
  terminal.info(`Applying ${plan.ops.length} changes...`);
  const transaction = new Transaction(root, context.fs);
  try {
    for (const op of plan.ops) {
      if (op.kind === 'delete') transaction.remove(op.path);
      else if (op.kind === 'symlink') transaction.symlink(op.path, op.target);
      else transaction.write(op.path, op.content, op.mode);
    }
    const mentions = findMentions(template, readFinalFiles(root, plan.finalPaths));
    if (mentions.length > 0) {
      throw new InitError(`The result still mentions the template, so every change was undone:\n${formatMentions(mentions)}`);
    }
  } catch (error) {
    transaction.rollback();
    if (error instanceof InitError) throw error;
    throw new InitError(`The init failed and every change was undone: ${error instanceof Error ? error.message : String(error)}`);
  }
  terminal.success(`${name} is initialized.`);

  // From here the project is initialized: problems are reported, not rolled back.
  const warnings: string[] = [];
  runFollowUp(context, 'Installing dependencies and refreshing bun.lock', 'bun', ['install'], warnings);
  runFollowUp(context, 'Syncing the Classic theme', 'bun', ['run', 'theme:sync-classic'], warnings);

  const mode: StartMode =
    flags.start ??
    (await terminal.select<StartMode>({
      message: 'How do you want to start?',
      options: [
        { value: 'docker', label: 'Use Docker locally (project working right away)', hint: 'recommended' },
        { value: 'prod', label: 'Enter my production values now', hint: 'runs bun run setup:prod' },
        { value: 'later', label: "I'll configure it later" },
      ],
    }));
  const start = await startProject(context, mode, answers);
  if (!start.ready) warnings.push(`The "${mode}" start did not finish.`);

  if (originIs(context.git, template.origin)) {
    terminal.warn(
      'The origin remote still points at the template. Change it before opening this project with an AI agent (git remote set-url origin <your repository>): otherwise Engram links it to the template memory again.',
    );
  }
  terminal.info('Nothing was committed. Review the changes with git status, then commit them on your own branch.');
  return { answers: { ...answers, description }, start, warnings };
}
