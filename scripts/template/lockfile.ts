/**
 * Sets the name of the root workspace in the text of `bun.lock`. `bun install` keeps the name it finds there, so a
 * renamed project must change it. Only that one line is touched; the rest of the file stays as it is.
 */
export function renameLockWorkspace(lockText: string, packageName: string): string {
  return lockText.replace(/(\n    "": \{\n      "name": ")[^"\n]*(")/, (_match, open: string, close: string) => `${open}${packageName}${close}`);
}
