/**
 * Paths that only make sense inside the template: `project:init` deletes them and `template:pull` never brings them.
 * Directories end with a slash and cover everything below them.
 */
export const TEMPLATE_ONLY_PATHS: readonly string[] = ['.forge614/', 'docs/superpowers/', 'scripts/project-init/'];

/** True when the repository path is one of the template-only paths or lives below one. */
export function isTemplateOnlyPath(file: string): boolean {
  return TEMPLATE_ONLY_PATHS.some((entry) => (entry.endsWith('/') ? file.startsWith(entry) : file === entry));
}
