import type { GitRunner } from './types';
import { InitError } from './types';

/** Temporary namespace for the template's branches and tags. Never the template name; always deleted. */
export const TEMP_REF_PREFIX = 'refs/template-init';

/** `host/owner/repo` form of a Git URL, lowercase, without scheme, credentials, `.git` or trailing slash. */
export function normalizeGitUrl(url: string): string {
  let value = url.trim().toLowerCase();
  const scp = /^[^/@:]+@([^:/]+):(.+)$/.exec(value);
  if (scp) value = `${scp[1]}/${scp[2]}`;
  value = value.replace(/^[a-z][a-z0-9+.-]*:\/\//, '').replace(/^[^/@]+@/, '');
  value = value.replace(/\/+$/, '').replace(/\.git$/, '').replace(/\/+$/, '');
  return value;
}

export function sameGitUrl(a: string, b: string): boolean {
  return normalizeGitUrl(a) === normalizeGitUrl(b);
}

/**
 * The `origin` remote URL as written in the Git config (raw) and as Git expands it with `insteadOf` rules.
 * Both are returned, without duplicates; the list is empty when there is no origin.
 */
export function originUrls(git: GitRunner): string[] {
  const urls = [git(['config', '--get', 'remote.origin.url']), git(['remote', 'get-url', 'origin'])]
    .filter((result) => result.ok)
    .map((result) => result.stdout.trim())
    .filter(Boolean);
  return [...new Set(urls)];
}

/** True when either spelling of the origin is the given URL. */
export function originIs(git: GitRunner, url: string): boolean {
  return originUrls(git).some((origin) => sameGitUrl(origin, url));
}

/** The origin to show or suggest from: the raw one, which is what the person configured. */
export function originUrl(git: GitRunner): string | null {
  return originUrls(git)[0] ?? null;
}

function requireGit(git: GitRunner, args: string[], failure: string): string {
  const result = git(args);
  if (!result.ok) throw new InitError(`${failure}\n${result.stderr.trim()}`.trim());
  return result.stdout;
}

/** Fails unless the root is a Git work tree with at least one commit and nothing unsaved. */
export function assertCleanRepository(git: GitRunner): void {
  if (!git(['rev-parse', '--is-inside-work-tree']).ok) {
    throw new InitError('This folder is not a Git repository. Create the project from the template, or run git init first.');
  }
  if (!git(['rev-parse', '--verify', 'HEAD^{commit}']).ok) {
    throw new InitError('This repository has no commits yet. Commit the template files first.');
  }
  const status = requireGit(git, ['status', '--porcelain'], 'Could not read the Git status.');
  if (status.trim()) {
    throw new InitError(
      `The Git working tree has unsaved changes. Commit or discard them first, so nothing is lost if you want to undo the init:\n${status.trimEnd()}`,
    );
  }
}

export interface BaseVersion {
  /** Full SHA of the newest template commit whose tree is identical to HEAD. */
  baseCommit: string;
  /** Highest X.Y.Z tag at the base commit or before it, or null when there is none. */
  version: string | null;
}

const VERSION_TAG = /^(\d+)\.(\d+)\.(\d+)$/;

function compareVersions(a: string, b: string): number {
  const left = a.split('.').map(Number);
  const right = b.split('.').map(Number);
  for (let index = 0; index < 3; index++) if (left[index] !== right[index]) return left[index] - right[index];
  return 0;
}

function deleteTempRefs(git: GitRunner): void {
  const refs = git(['for-each-ref', '--format=%(refname)', TEMP_REF_PREFIX]).stdout.split('\n').filter(Boolean);
  for (const ref of refs) git(['update-ref', '-d', ref]);
}

/**
 * Finds which template commit this project was created from: fetches the template's branches and tags into a
 * temporary namespace, takes the newest commit whose tree equals the tree of HEAD and the highest version tag
 * reachable from it. The temporary references are always deleted. Nothing in the work tree is touched.
 */
export function findBaseVersion(git: GitRunner, templateOrigin: string): BaseVersion {
  try {
    const headTree = requireGit(git, ['rev-parse', 'HEAD^{tree}'], 'Could not read the current tree.').trim();

    const fetched = git([
      'fetch',
      '--quiet',
      '--no-tags',
      '--force',
      templateOrigin,
      `+refs/heads/*:${TEMP_REF_PREFIX}/heads/*`,
      `+refs/tags/*:${TEMP_REF_PREFIX}/tags/*`,
    ]);
    if (!fetched.ok) {
      throw new InitError(
        `Could not download the template history from ${templateOrigin}. Check your connection and try again. Nothing was changed.\n${fetched.stderr.trim()}`.trim(),
      );
    }

    const log = requireGit(
      git,
      ['log', `--glob=${TEMP_REF_PREFIX}/*`, '--format=%H %T'],
      'Could not read the template history.',
    );
    const match = log
      .split('\n')
      .map((line) => line.trim().split(' '))
      .find(([, tree]) => tree === headTree);
    if (!match) {
      throw new InitError(
        [
          'This project does not match any published version of the template: no template commit has exactly the same files as HEAD.',
          'The init only works on an unmodified copy made with "Use this template". Nothing was changed.',
        ].join('\n'),
      );
    }
    const baseCommit = match[0];

    const tags = requireGit(
      git,
      ['for-each-ref', '--format=%(refname) %(objectname) %(*objectname)', `${TEMP_REF_PREFIX}/tags`],
      'Could not read the template tags.',
    )
      .split('\n')
      .filter(Boolean)
      .map((line) => {
        const [ref, object, peeled] = line.split(' ');
        return { name: ref.slice(`${TEMP_REF_PREFIX}/tags/`.length), commit: peeled || object };
      })
      .filter((tag) => VERSION_TAG.test(tag.name));

    const reachable = tags
      .filter((tag) => tag.commit === baseCommit || git(['merge-base', '--is-ancestor', tag.commit, baseCommit]).ok)
      .map((tag) => tag.name)
      .sort(compareVersions);
    return { baseCommit, version: reachable.at(-1) ?? null };
  } finally {
    deleteTempRefs(git);
  }
}
