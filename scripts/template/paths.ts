/**
 * Paths that only make sense inside the template: `project:init` deletes them and `template:pull` never brings them.
 * Directories end with a slash and cover everything below them.
 */
export const TEMPLATE_ONLY_PATHS: readonly string[] = ['.forge614/', 'docs/superpowers/', 'scripts/project-init/'];

/** True when the repository path is one of the template-only paths or lives below one. */
export function isTemplateOnlyPath(file: string): boolean {
  return TEMPLATE_ONLY_PATHS.some((entry) => (entry.endsWith('/') ? file.startsWith(entry) : file === entry));
}

/** What `template:pull` does with a path. */
export type PathClass = 'template-only' | 'seeded' | 'project' | 'template';

/** Files the init writes for the project (neutral versions of the template's own): after the init they belong to the project. */
const SEEDED_FILES: ReadonlySet<string> = new Set(['README.md', 'app/page.tsx', 'components/landing-content.tsx', 'config/site.ts']);

/** `theme:sync-classic` copies the landing files into every theme folder, so those copies are the project's too. */
const SEEDED_THEME_COPY = /^themes\/[^/]+\/(?:app\/page\.tsx|components\/landing-content\.tsx)$/;

const PROJECT_PREFIXES: readonly string[] = ['.setup/', '.forge614/'];
const PROJECT_FILES: ReadonlySet<string> = new Set(['bun.lock']);

/** `.env`, `.env.local`, `docker/.env`...: secrets and local values. The `.example` files are part of the template. */
function isEnvFile(file: string): boolean {
  const name = file.slice(file.lastIndexOf('/') + 1);
  return /^\.env(?:\..+)?$/.test(name) && !name.endsWith('.example');
}

/**
 * Classifies a repository path. *Template-only* paths never reach a project, *seeded* and *project* paths are never
 * touched by a pull, and only *template* paths travel. A path listed in `exclusions` (exact path, or a folder ending
 * with a slash) becomes *project*.
 */
export function classifyPath(file: string, exclusions: readonly string[] = []): PathClass {
  if (isTemplateOnlyPath(file)) return 'template-only';
  if (SEEDED_FILES.has(file) || SEEDED_THEME_COPY.test(file)) return 'seeded';
  if (PROJECT_FILES.has(file) || PROJECT_PREFIXES.some((prefix) => file.startsWith(prefix)) || isEnvFile(file)) return 'project';
  if (exclusions.some((entry) => (entry.endsWith('/') ? file.startsWith(entry) : file === entry))) return 'project';
  return 'template';
}

/** Folders and files that `theme:sync-classic` copies into `themes/classic/`; when one changes, the sync has to run again. */
export const THEME_SYNCED_PATHS: readonly string[] = ['app/auth/', 'components/auth/', 'components/ui/', 'app/globals.css', 'app/layout.tsx'];

export function isThemeSyncedPath(file: string): boolean {
  return THEME_SYNCED_PATHS.some((entry) => (entry.endsWith('/') ? file.startsWith(entry) : file === entry));
}
