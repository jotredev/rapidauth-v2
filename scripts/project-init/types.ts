export type StartMode = 'docker' | 'prod' | 'later';

export const START_MODES: readonly StartMode[] = ['docker', 'prod', 'later'];

/** Values given on the command line. Anything missing is asked for, or the run fails when there is no terminal. */
export interface InitFlags {
  name?: string;
  slug?: string;
  description?: string;
  repo?: string;
  start?: StartMode;
  /** Typed confirmation for running inside the template itself (the template slug). */
  confirmTemplate?: string;
}

export interface TextPrompt {
  message: string;
  placeholder?: string;
  initialValue?: string;
  validate?: (value: string) => string | undefined;
}

export interface SelectPrompt<T extends string> {
  message: string;
  options: { value: T; label: string; hint?: string }[];
}

/** Everything the init says or asks. The real one wraps @clack/prompts; tests script it. */
export interface Terminal {
  /** True when a person can answer questions. */
  interactive: boolean;
  text(prompt: TextPrompt): Promise<string>;
  select<T extends string>(prompt: SelectPrompt<T>): Promise<T>;
  info(message: string): void;
  warn(message: string): void;
  error(message: string): void;
  success(message: string): void;
}

export interface GitResult {
  ok: boolean;
  stdout: string;
  stderr: string;
}

/** Runs `git <args>` inside the project root. */
export type GitRunner = (args: string[]) => GitResult;

export interface RunOptions {
  cwd: string;
  /** Pass the terminal through (questions, colors) instead of capturing output. */
  inherit?: boolean;
}

export interface RunResult {
  status: number | null;
  error?: string;
}

/** Runs a child process. */
export type CommandRunner = (command: string, args: string[], options: RunOptions) => RunResult;

/** Checks that touch the machine: Docker, ports and the database. */
export interface Services {
  /** Why Docker cannot be used, or undefined when it can. */
  dockerProblem(): string | undefined;
  isPortFree(port: number): Promise<boolean>;
  /** Waits until the database accepts connections. */
  waitForDatabase(databaseUrl: string): Promise<{ ok: true } | { ok: false; reason: string }>;
  /** Applies pending migrations (prisma migrate deploy); throws on failure. */
  migrate(databaseUrl: string): void;
}

/** The writes of the init. Rollback never goes through this object, so an injected failure cannot break it. */
export interface FsOps {
  writeFile(absolute: string, data: string | Uint8Array, mode?: number): void;
  symlink(target: string, absolute: string): void;
  removeFile(absolute: string): void;
  makeDir(absolute: string): void;
  removeDir(absolute: string): void;
}

export interface InitContext {
  /** Project root: the folder with `.setup/project.json`. */
  root: string;
  flags: InitFlags;
  terminal: Terminal;
  git: GitRunner;
  run: CommandRunner;
  services: Services;
  fs: FsOps;
}

/** A refusal or failure that leaves the project unchanged. The message is shown as is. */
export class InitError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InitError';
  }
}

/** The person cancelled a question. */
export class InitCancelled extends Error {
  constructor() {
    super('Cancelled.');
    this.name = 'InitCancelled';
  }
}
