import { deleteRefs } from '../template/git';
import { compareVersions, isVersion } from '../template/versions';
import { InitError, type GitRunner } from './types';

/** Temporary namespace for the template's branches and tags. Never the template name; always deleted. */
export const TEMP_REF_PREFIX = 'refs/template-init';

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
      .filter((tag) => isVersion(tag.name));

    const reachable = tags
      .filter((tag) => tag.commit === baseCommit || git(['merge-base', '--is-ancestor', tag.commit, baseCommit]).ok)
      .map((tag) => tag.name)
      .sort(compareVersions);
    return { baseCommit, version: reachable.at(-1) ?? null };
  } finally {
    deleteRefs(git, TEMP_REF_PREFIX);
  }
}
