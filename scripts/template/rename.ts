import { byLongestFirst, buildMentionPattern, escapeRegExp, formPairs, parseGitHubRepo, projectForms, templateJoinedForms } from './forms';
import { RENAME_SKIPPED_PATHS, decodeText, type SourceFile } from './files';
import {
  formatIssues,
  projectAnswersSchema,
  type ProjectAnswers,
  type TemplateIdentity,
} from './metadata';

export class RenameError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RenameError';
  }
}

interface Rule {
  pattern: RegExp;
  replace: (match: string, ...groups: string[]) => string;
}

export interface RenamePlan {
  /** Rules applied to file content, most specific first. */
  contentRules: Rule[];
  /** Rules applied to file paths. */
  pathRules: Rule[];
  /** Matches any spelling of the template name; used to skip files that need no work. */
  mentionPattern: RegExp;
}

export interface PlannedChange {
  /** Current path. */
  path: string;
  /** Path after the rename (equal to `path` when it does not change). */
  newPath: string;
  /** New text, or null when the content stays as it is (binary files, or only the path changes). */
  content: string | null;
}

/** Checks the answers and refuses any that still carry a template spelling (they would never pass the final check). */
export function validateAnswers(template: TemplateIdentity, answers: ProjectAnswers): ProjectAnswers {
  const result = projectAnswersSchema.safeParse(answers);
  if (!result.success) throw new RenameError(`The project answers are invalid:\n${formatIssues(result.error)}`);
  const pattern = buildMentionPattern(template);
  for (const [field, value] of Object.entries(result.data)) {
    pattern.lastIndex = 0;
    if (typeof value === 'string' && pattern.test(value)) {
      throw new RenameError(`The project ${field} "${value}" still contains the template name. Choose a different one.`);
    }
  }
  return result.data;
}

const literal = (from: string, to: string, flags = 'g'): Rule => ({
  pattern: new RegExp(escapeRegExp(from), flags),
  replace: () => to,
});

/** Replaces the standalone `token` inside every line that matches `line`. */
function lineRule(line: RegExp, token: string, to: string): Rule {
  const standalone = new RegExp(`(?<![\\w-])${escapeRegExp(token)}(?![\\w-])`, 'g');
  return { pattern: line, replace: (text) => text.replace(standalone, () => to) };
}

export function buildRenamePlan(template: TemplateIdentity, rawAnswers: ProjectAnswers): RenamePlan {
  const answers = validateAnswers(template, rawAnswers);
  const to = projectForms(answers);
  const pairs = formPairs(template, answers);
  const templateRepo = parseGitHubRepo(template.origin);
  const repoValue = answers.repo ?? `OWNER/${answers.slug}`;
  const repoName = answers.repo ? answers.repo.split('/')[1] : answers.slug;

  const contentRules: Rule[] = [];

  // 1. GitHub repository: the GHCR image (lowercase) and every other owner/repo mention.
  if (templateRepo) {
    const fullRepo = `${templateRepo.owner}/${templateRepo.repo}`;
    const ghcrValue = answers.repo ? answers.repo.toLowerCase() : repoValue;
    contentRules.push({
      pattern: new RegExp(`(ghcr\\.io/)${escapeRegExp(fullRepo)}(?![\\w-])`, 'gi'),
      replace: (_m, prefix) => `${prefix}${ghcrValue}`,
    });
    contentRules.push({
      pattern: new RegExp(`(?<![\\w.-])${escapeRegExp(fullRepo)}(?![\\w-])`, 'gi'),
      replace: () => repoValue,
    });
  }

  // 2. Database identifiers (user, password and name share one value), kept identical everywhere they are written.
  const slug = escapeRegExp(template.slug);
  contentRules.push({
    pattern: new RegExp(`(postgres(?:ql)?://)${slug}:${slug}(?![\\w-])`, 'g'),
    replace: (_m, scheme) => `${scheme}${to.snake}:${to.snake}`,
  });
  contentRules.push({
    // Only inside a Postgres connection string: an npm scope or any other @host/name text keeps the normal form.
    pattern: new RegExp(`(postgres(?:ql)?://[^\\s/@'"\`]*@[^\\s/'"\`]+/)${slug}(?![\\w-])`, 'g'),
    replace: (_m, prefix) => `${prefix}${to.snake}`,
  });
  contentRules.push(
    lineRule(/^[ \t-]*(?:POSTGRES_(?:USER|PASSWORD|DB)|PG(?:USER|PASSWORD|DATABASE))[ \t]*[:=].*$/gm, template.slug, to.snake),
    lineRule(/^.*\b(?:dropdb|createdb|psql|pg_isready)\b.*$/gm, template.slug, to.snake),
    lineRule(/^.*\burl\.(?:username|password|pathname)\b.*$/gm, template.slug, to.snake),
  );
  contentRules.push({
    pattern: new RegExp(`((?:user|password|database|usuario|contraseña|base)\\s+\`)${slug}(?=\`)`, 'gi'),
    replace: (_m, prefix) => `${prefix}${to.snake}`,
  });

  // 3. The display name glued to an email local part becomes the slug (the name has spaces).
  contentRules.push({
    pattern: new RegExp(`${escapeRegExp(template.name)}(?=[\\w.+-]*@)`, 'g'),
    replace: () => to.kebab,
  });

  // 4. Aliases (repository and package names).
  for (const alias of [...template.aliases].map((from) => ({ from })).sort(byLongestFirst)) {
    const isRepoName = templateRepo !== null && alias.from.toLowerCase() === templateRepo.repo.toLowerCase();
    contentRules.push(literal(alias.from, isRepoName ? repoName : to.kebab, 'gi'));
  }

  // 5. Names glued to identifier characters keep the identifier valid.
  const name = escapeRegExp(template.name);
  const joined = templateJoinedForms(template);
  const upperAlternatives = joined.upper.map(escapeRegExp).join('|');
  const lowerAlternatives = joined.lower.map(escapeRegExp).join('|');
  contentRules.push(
    { pattern: new RegExp(`(?<=[A-Za-z0-9_])${name}|${name}(?=[A-Za-z0-9_])`, 'g'), replace: () => to.pascal },
    {
      pattern: new RegExp(`(?<=[A-Z0-9_])(?:${upperAlternatives})|(?:${upperAlternatives})(?=[A-Z0-9_])`, 'g'),
      replace: () => to.upperSnake,
    },
    { pattern: new RegExp(`(?<![A-Za-z0-9])(?:${lowerAlternatives})(?=[A-Z])`, 'g'), replace: () => to.camel },
    { pattern: new RegExp(`(?<=[A-Za-z0-9])(?:${lowerAlternatives})`, 'g'), replace: () => to.joined },
  );

  // 6. Every remaining form, longest first.
  for (const pair of pairs) contentRules.push(literal(pair.from, pair.to));

  // Paths never hold spaces: forms with spaces become hyphenated.
  const pathRules: Rule[] = [
    ...[...template.aliases]
      .map((from) => ({ from }))
      .sort(byLongestFirst)
      .map((alias) => literal(alias.from, to.kebab, 'gi')),
    ...pairs.map((pair) => literal(pair.from, pair.to.replace(/\s+/g, '-'))),
  ];

  return { contentRules, pathRules, mentionPattern: buildMentionPattern(template) };
}

function applyRules(text: string, rules: Rule[]): string {
  return rules.reduce((current, rule) => current.replace(rule.pattern, rule.replace), text);
}

/**
 * Plans the rename of every template spelling in the given files, in memory. Nothing is written: the caller applies
 * the returned changes. Binary files keep their content (only their path can change); the lockfile and the metadata
 * file are left alone.
 */
export function planRename(template: TemplateIdentity, answers: ProjectAnswers, files: SourceFile[]): PlannedChange[] {
  const plan = buildRenamePlan(template, answers);
  const changes: PlannedChange[] = [];

  for (const file of files) {
    plan.mentionPattern.lastIndex = 0;
    const newPath = plan.mentionPattern.test(file.path) ? applyRules(file.path, plan.pathRules) : file.path;

    let content: string | null = null;
    if (!RENAME_SKIPPED_PATHS.has(file.path)) {
      const text = decodeText(file.content);
      if (text !== null) {
        plan.mentionPattern.lastIndex = 0;
        if (plan.mentionPattern.test(text)) {
          const next = applyRules(text, plan.contentRules);
          if (next !== text) content = next;
        }
      }
    }
    if (content !== null || newPath !== file.path) changes.push({ path: file.path, newPath, content });
  }

  assertNoPathCollisions(files, changes);
  return changes;
}

function assertNoPathCollisions(files: SourceFile[], changes: PlannedChange[]): void {
  const final = new Map<string, string>();
  const renamed = new Map(changes.map((change) => [change.path, change.newPath]));
  for (const file of files) {
    const target = renamed.get(file.path) ?? file.path;
    const other = final.get(target);
    if (other !== undefined) throw new RenameError(`Renaming would put both ${other} and ${file.path} at ${target}.`);
    final.set(target, file.path);
  }
}
