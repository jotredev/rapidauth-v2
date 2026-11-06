import type { ProjectAnswers, TemplateIdentity } from './metadata';

export function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Splits a name or slug into lowercase words on separators and camelCase boundaries. */
export function splitWords(value: string): string[] {
  return value
    .replace(/([\p{Ll}\p{N}])(\p{Lu})/gu, '$1 $2')
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean)
    .map((word) => word.toLowerCase());
}

const capitalize = (word: string) => word.charAt(0).toUpperCase() + word.slice(1);

/** Name forms built from a list of lowercase words. */
export const wordForms = {
  kebab: (w: string[]) => w.join('-'),
  snake: (w: string[]) => w.join('_'),
  joined: (w: string[]) => w.join(''),
  camel: (w: string[]) => w.map((word, index) => (index === 0 ? word : capitalize(word))).join(''),
  pascal: (w: string[]) => w.map(capitalize).join(''),
  upperSnake: (w: string[]) => w.join('_').toUpperCase(),
  upperKebab: (w: string[]) => w.join('-').toUpperCase(),
  spacedTitle: (w: string[]) => w.map(capitalize).join(' '),
  spacedLower: (w: string[]) => w.join(' '),
  upperJoined: (w: string[]) => w.join('').toUpperCase(),
};

/** Every form of the project name, all valid in their context because they come from the validated answers. */
export function projectForms(answers: ProjectAnswers) {
  const words = splitWords(answers.slug);
  return {
    display: answers.name,
    upperDisplay: answers.name.toUpperCase(),
    lowerDisplay: answers.name.toLowerCase(),
    kebab: answers.slug,
    /** Postgres user, password and database name; no hyphen, so it never needs quoting. */
    snake: wordForms.snake(words),
    joined: wordForms.joined(words),
    camel: wordForms.camel(words),
    pascal: wordForms.pascal(words),
    upperSnake: wordForms.upperSnake(words),
    upperKebab: wordForms.upperKebab(words),
  };
}

export type ProjectForms = ReturnType<typeof projectForms>;

export interface FormPair {
  from: string;
  to: string;
}

/** Lowercase and uppercase spellings of the template name without separators or spaces. */
export function templateJoinedForms(template: TemplateIdentity): { lower: string[]; upper: string[] } {
  const lists = templateWordLists(template);
  return {
    lower: [...new Set([template.slug, ...lists.map(wordForms.joined)])],
    upper: [...new Set([template.name.toUpperCase(), ...lists.map(wordForms.upperJoined)])],
  };
}

/** Template-word lists: one from the display name and one from the slug (they can split differently). */
function templateWordLists(template: TemplateIdentity): string[][] {
  const lists = [splitWords(template.name), splitWords(template.slug)].filter((list) => list.length > 0);
  const seen = new Set<string>();
  return lists.filter((list) => {
    const key = list.join('\u0000');
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/**
 * Template spelling to project spelling, one pair per distinct template form. The first form that produces a given
 * template string wins, so for a single-word template the plain slug form beats the others.
 */
export function formPairs(template: TemplateIdentity, answers: ProjectAnswers): FormPair[] {
  const to = projectForms(answers);
  const pairs = new Map<string, string>();
  const add = (from: string, value: string) => {
    if (from && !pairs.has(from)) pairs.set(from, value);
  };

  add(template.name, to.display);
  add(template.name.toUpperCase(), to.upperDisplay);
  for (const words of templateWordLists(template)) {
    add(wordForms.kebab(words), to.kebab);
    add(wordForms.snake(words), to.snake);
    add(wordForms.joined(words), to.kebab);
    add(wordForms.camel(words), to.camel);
    add(wordForms.pascal(words), to.pascal);
    add(wordForms.upperSnake(words), to.upperSnake);
    add(wordForms.upperKebab(words), to.upperKebab);
    add(wordForms.spacedTitle(words), to.display);
    add(wordForms.spacedLower(words), to.lowerDisplay);
    add(wordForms.upperJoined(words), to.upperDisplay);
  }
  return [...pairs].map(([from, value]) => ({ from, to: value })).sort(byLongestFirst);
}

export function byLongestFirst(a: { from: string }, b: { from: string }): number {
  return b.from.length - a.from.length || (a.from < b.from ? -1 : a.from > b.from ? 1 : 0);
}

/** `owner/repo` of a GitHub origin URL (https or ssh), or null for another host. */
export function parseGitHubRepo(origin: string): { owner: string; repo: string } | null {
  const match = /github\.com[/:]([^/\s]+)\/([^/\s]+?)(?:\.git)?\/?$/i.exec(origin.trim());
  return match ? { owner: match[1], repo: match[2] } : null;
}

/**
 * Case-insensitive pattern for any spelling of the template name: its words joined by optional separators
 * (so the no-separator forms match too) and every alias.
 */
export function buildMentionPattern(template: TemplateIdentity): RegExp {
  // Aliases first, longest first: an alternation takes the first branch that matches, not the longest.
  const aliases = [...template.aliases].sort((a, b) => b.length - a.length).map(escapeRegExp);
  const names = templateWordLists(template).map((words) => words.map(escapeRegExp).join('[\\s_.-]*'));
  return new RegExp([...new Set([...aliases, ...names])].join('|'), 'giu');
}
