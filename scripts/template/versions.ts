const VERSION_PATTERN = /^(\d+)\.(\d+)\.(\d+)$/;

/** True for a release tag: exactly `X.Y.Z`, no prefix. */
export function isVersion(value: string): boolean {
  return VERSION_PATTERN.test(value);
}

/** Numeric comparison of two `X.Y.Z` versions (negative, zero or positive). */
export function compareVersions(a: string, b: string): number {
  const left = a.split('.').map(Number);
  const right = b.split('.').map(Number);
  for (let index = 0; index < 3; index++) if (left[index] !== right[index]) return left[index] - right[index];
  return 0;
}

export function majorOf(version: string): number {
  return Number(version.split('.')[0]);
}

/** Release tags of `git ls-remote --tags` output as version → commit (peeled `^{}` lines win over the tag object). */
export function parseLsRemoteTags(stdout: string): Map<string, string> {
  const direct = new Map<string, string>();
  const peeled = new Map<string, string>();
  for (const line of stdout.split('\n')) {
    const [sha, ref] = line.trim().split(/\s+/);
    if (!sha || !ref?.startsWith('refs/tags/')) continue;
    const name = ref.slice('refs/tags/'.length);
    if (name.endsWith('^{}')) {
      const base = name.slice(0, -3);
      if (isVersion(base)) peeled.set(base, sha);
    } else if (isVersion(name)) direct.set(name, sha);
  }
  return new Map([...direct].map(([name, sha]) => [name, peeled.get(name) ?? sha]));
}
