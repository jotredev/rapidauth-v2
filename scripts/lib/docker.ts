import { execFileSync } from 'node:child_process';

export const DOCKER_COMPOSE_ARGS = ['compose'];

export const DOCKER_GUIDES = [
  'Guide (English): docs/en/03-docker.md',
  'Guía (español): docs/es/03-docker.md',
];

export function checkDockerPrerequisites(): string | undefined {
  try {
    execFileSync('docker', ['--version'], { stdio: 'ignore', timeout: 5_000 });
  } catch {
    return 'Docker is not installed or is not available in PATH.';
  }

  try {
    execFileSync('docker', ['compose', 'version'], { stdio: 'ignore', timeout: 5_000 });
  } catch {
    return 'Docker Compose is not installed or is not available.';
  }

  try {
    execFileSync('docker', ['info'], { stdio: 'ignore', timeout: 10_000 });
  } catch {
    return 'Docker is installed, but its engine is not responding. Start Docker Desktop, OrbStack, or Colima.';
  }
}

export function commandErrorOutput(error: unknown): string {
  if (!(error instanceof Error)) return String(error);
  const commandError = error as Error & { stdout?: Buffer | string; stderr?: Buffer | string };
  const stdout = commandError.stdout?.toString().trim();
  const stderr = commandError.stderr?.toString().trim();
  return [stderr, stdout, commandError.message].filter(Boolean).join('\n');
}

function wait(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

export async function ensureDockerDatabase(port?: string): Promise<void> {
  const environment = { ...process.env, ...(port ? { DB_PORT: port } : {}) };
  const output = execFileSync(
    'docker',
    [...DOCKER_COMPOSE_ARGS, 'up', '-d', 'db'],
    { encoding: 'utf8', timeout: 60_000, env: environment },
  ).trim();
  if (output) process.stdout.write(`${output}\n`);

  const containerId = execFileSync(
    'docker',
    [...DOCKER_COMPOSE_ARGS, 'ps', '-q', 'db'],
    { encoding: 'utf8', timeout: 10_000, env: environment },
  ).trim();
  if (!containerId) throw new Error('Docker Compose did not return a database container ID.');

  const deadline = Date.now() + 60_000;
  process.stdout.write('Waiting up to 60 seconds for PostgreSQL to become healthy...\n');
  while (Date.now() < deadline) {
    const remaining = deadline - Date.now();
    if (remaining <= 0) break;
    const health = execFileSync(
      'docker',
      ['inspect', '--format={{.State.Health.Status}}', containerId],
      { encoding: 'utf8', timeout: Math.min(5_000, remaining), env: environment },
    ).trim();

    if (health === 'healthy') {
      process.stdout.write('Local PostgreSQL is healthy.\n');
      return;
    }
    if (health === 'unhealthy') {
      throw new Error('The local PostgreSQL container became unhealthy. Check it with docker compose logs db.');
    }

    await wait(1_000);
  }

  throw new Error('Timed out after 60 seconds waiting for the local PostgreSQL container to become healthy.');
}
