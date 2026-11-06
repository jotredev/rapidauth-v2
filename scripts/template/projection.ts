import { decodeText, type SourceFile } from './files';
import { escapeRegExp } from './forms';
import { renameLockWorkspace } from './lockfile';
import type { ProjectAnswers, TemplateIdentity } from './metadata';
import { isTemplateOnlyPath } from './paths';
import { planRename } from './rename';
import { TemplateError, type TreeEntry } from './types';

/** Version every new project starts at, in `package.json` and in the image tag. */
export const INITIAL_VERSION = '0.1.0';

/** Folders where the published image and its tag are written. */
const IMAGE_TAG_PREFIXES = ['docker/', 'docs/'];

/** What identifies the project: the stored answers and the template's own spellings. A project's metadata fits. */
export interface ProjectionInput {
  template: TemplateIdentity;
  project: ProjectAnswers;
}

/** Sets the version and drops the `project:init` command, keeping the rest of the file as it is. */
function resetPackageJson(text: string): string {
  let parsed: { version?: string; scripts?: Record<string, string> };
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new TemplateError('package.json is not valid JSON, so it cannot be updated.');
  }
  parsed.version = INITIAL_VERSION;
  if (parsed.scripts) delete parsed.scripts['project:init'];
  return `${JSON.stringify(parsed, null, 2)}\n`;
}

function textOf(entry: TreeEntry | undefined, file: string): string {
  const text = entry ? decodeText(entry.content) : null;
  if (text === null) throw new TemplateError(`${file} is missing or is not a text file, so it cannot be updated.`);
  return text;
}

/**
 * Turns a tree of the template into what a project made from it looks like: template-only paths removed, every
 * template spelling renamed (contents and paths), the image tag and `package.json` reset to the first version, and the
 * root workspace of `bun.lock` renamed. `project:init` applies this to the files it finds, and `template:pull` applies
 * it to the base and the new template trees, so a pull never sees a difference the init itself introduced. Pure: the
 * input is not modified. Files the init writes from scratch (README, landing, metadata) are not part of it.
 */
export function projectTemplateTree(files: Map<string, TreeEntry>, input: ProjectionInput): Map<string, TreeEntry> {
  const { template, project } = input;
  const kept = new Map<string, TreeEntry>();
  for (const [file, entry] of files) if (!isTemplateOnlyPath(file)) kept.set(file, entry);

  // 1. Rename every template spelling, in contents and in paths.
  const sources: SourceFile[] = [...kept].map(([file, entry]) => ({ path: file, content: entry.content }));
  const renamed = new Map(
    planRename(template, { name: project.name, slug: project.slug, repo: project.repo }, sources).map((change) => [change.path, change]),
  );
  const next = new Map<string, TreeEntry>();
  for (const [file, entry] of kept) {
    const change = renamed.get(file);
    next.set(change?.newPath ?? file, { ...entry, content: change?.content ?? entry.content });
  }

  // 2. The released image tag of the template becomes the project's first version (only where images are documented
  //    or deployed: tests and scripts keep their sample tags).
  const ghcrRepo = project.repo ? project.repo.toLowerCase() : `OWNER/${project.slug}`;
  const imageTag = new RegExp(`(ghcr\\.io/${escapeRegExp(ghcrRepo)}):\\d+\\.\\d+\\.\\d+`, 'gi');
  for (const [file, entry] of next) {
    if (entry.symlink || !IMAGE_TAG_PREFIXES.some((prefix) => file.startsWith(prefix))) continue;
    const text = decodeText(entry.content);
    if (text === null) continue;
    const updated = text.replace(imageTag, (_match, image: string) => `${image}:${INITIAL_VERSION}`);
    if (updated !== text) next.set(file, { ...entry, content: updated });
  }

  // 3. package.json starts at 0.1.0 without the init command; bun install keeps the root workspace name of the
  //    lockfile, so it follows the package name (and only it).
  const packageJson = resetPackageJson(textOf(next.get('package.json'), 'package.json'));
  next.set('package.json', { content: packageJson, symlink: false, mode: next.get('package.json')?.mode ?? 0o644 });
  const lock = next.get('bun.lock');
  if (lock) {
    const packageName = (JSON.parse(packageJson) as { name: string }).name;
    const lockText = textOf(lock, 'bun.lock');
    const updated = renameLockWorkspace(lockText, packageName);
    if (updated !== lockText) next.set('bun.lock', { ...lock, content: updated });
  }
  return next;
}
