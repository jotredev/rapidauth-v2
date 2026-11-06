import { spawnSync } from 'node:child_process';
import type { GitRunner } from './types';

/** Runs the real `git` inside `root`. */
export function createGitRunner(root: string, env: NodeJS.ProcessEnv = process.env): GitRunner {
  return (args, input) => {
    const result = spawnSync('git', args, { cwd: root, env, input, maxBuffer: 512 * 1024 * 1024 });
    const stdoutBytes = new Uint8Array(result.stdout ?? []);
    return {
      ok: result.status === 0,
      status: result.status,
      stdout: Buffer.from(stdoutBytes).toString('utf8'),
      stderr: result.stderr?.toString('utf8') ?? result.error?.message ?? '',
      stdoutBytes,
    };
  };
}

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

/** Deletes every reference under a temporary namespace. */
export function deleteRefs(git: GitRunner, prefix: string): void {
  const refs = git(['for-each-ref', '--format=%(refname)', prefix]).stdout.split('\n').filter(Boolean);
  for (const ref of refs) git(['update-ref', '-d', ref]);
}
