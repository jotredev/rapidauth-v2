/** Shared types of the template tooling (`template:pull` and the pieces `project:init` reuses). */

export interface GitResult {
  ok: boolean;
  /** Exit status, or null when Git could not be started. */
  status: number | null;
  stdout: string;
  stderr: string;
  /** The same output as raw bytes, for blobs that are not text. */
  stdoutBytes: Uint8Array;
}

/** Runs `git <args>` inside the project root, optionally feeding `input` to its standard input. */
export type GitRunner = (args: string[], input?: string) => GitResult;

/** The writes of a transaction. Rollback never goes through this object, so an injected failure cannot break it. */
export interface FsOps {
  writeFile(absolute: string, data: string | Uint8Array, mode?: number): void;
  symlink(target: string, absolute: string): void;
  removeFile(absolute: string): void;
  makeDir(absolute: string): void;
  removeDir(absolute: string): void;
}

/** What the tooling says to the person. The real one wraps @clack/prompts; tests record it. */
export interface Reporter {
  info(message: string): void;
  warn(message: string): void;
  error(message: string): void;
  success(message: string): void;
}

/** A file of a template tree: its bytes, or the target text of a symbolic link. */
export interface TreeEntry {
  content: string | Uint8Array;
  symlink: boolean;
  mode: number;
}

/** A refusal or failure with a message meant to be shown as is. */
export class TemplateError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TemplateError';
  }
}
