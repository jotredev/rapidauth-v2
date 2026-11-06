import { randomBytes } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';

/** Sets `KEY="value"` in dotenv text, replacing the existing line or appending a new one. */
export function setEnvValue(content: string, key: string, value: string): string {
  const line = new RegExp(`^${key}=.*$`, 'm');
  const rendered = `${key}="${value}"`;
  return line.test(content) ? content.replace(line, () => rendered) : `${content.trimEnd()}\n${rendered}\n`;
}

export interface LocalEnvOptions {
  /** Connection string of the local Docker database. */
  databaseUrl: string;
  /** Extra values to set, for example `DB_PORT` when the default host port is busy. */
  extra?: Record<string, string>;
}

/** Renders a `.env` from the text of `.env.example` with values that work on this computer. */
export function renderLocalEnv(example: string, options: LocalEnvOptions): string {
  let content = example.replace(/\r\n/g, '\n');
  content = setEnvValue(content, 'DATABASE_URL', options.databaseUrl);
  content = setEnvValue(content, 'BETTER_AUTH_SECRET', randomBytes(32).toString('hex'));
  content = setEnvValue(content, 'BETTER_AUTH_URL', 'http://localhost:3000');
  content = setEnvValue(content, 'SUPPORT_EMAIL', 'support@example.invalid');
  for (const [key, value] of Object.entries(options.extra ?? {})) content = setEnvValue(content, key, value);
  return content;
}

/** Creates `envPath` from `examplePath` with local development values (owner-only permissions). */
export function createLocalEnv(examplePath: string, envPath: string, options: LocalEnvOptions): void {
  writeFileSync(envPath, renderLocalEnv(readFileSync(examplePath, 'utf8'), options), { mode: 0o600 });
}
