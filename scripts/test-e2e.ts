#!/usr/bin/env bun
import { spawnSync } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';

const project = 'rapidauth-e2e';
const compose = ['compose', '-p', project];
const databaseUrl = 'postgresql://rapidauth:rapidauth@127.0.0.1:55432/rapidauth?sslmode=disable';
const s3Container = `${project}-s3mock-${process.pid}`;
const mailpitContainer = `${project}-mailpit-${process.pid}`;
let s3Started = false;
let mailpitStarted = false;

function run(command: string, args: string[], env: NodeJS.ProcessEnv = process.env, capture = false) {
  const result = spawnSync(command, args, { cwd: process.cwd(), env, encoding: 'utf8', stdio: capture ? 'pipe' : 'inherit' });
  if (result.status !== 0) throw new Error(`${command} ${args.join(' ')} failed${capture ? `: ${result.stderr}` : ''}`);
  return (result.stdout ?? '').trim();
}

async function waitForS3(endpoint: string) {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try { await fetch(endpoint); return; } catch { await delay(500); }
  }
  throw new Error('S3Mock did not become ready within 30 seconds.');
}

async function waitForMailpit(apiUrl: string) {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try {
      if ((await fetch(`${apiUrl}/api/v1/info`)).ok) return;
    } catch { /* not listening yet */ }
    await delay(500);
  }
  throw new Error('Mailpit did not become ready within 30 seconds.');
}

async function main() {
  if (process.env.CI === 'true') {
    await waitForS3('http://127.0.0.1:9090');
    await waitForMailpit('http://127.0.0.1:8025');
    const env = {
      ...process.env,
      DATABASE_URL: process.env.DATABASE_URL ?? 'postgresql://rapidauth:rapidauth@127.0.0.1:5432/rapidauth?sslmode=disable',
      STORAGE_DRIVER: 'local',
    };
    run('bunx', ['playwright', 'test', ...process.argv.slice(2)], env);
    return;
  }

  const dockerEnv = { ...process.env, DB_PORT: '55432' };
  run('docker', [...compose, 'down', '-v'], dockerEnv, true);
  run('docker', [...compose, 'up', '-d', '--wait', 'db'], dockerEnv);
  run('docker', ['run', '-d', '--name', s3Container, '-p', '127.0.0.1::9090', '-e', 'COM_ADOBE_TESTING_S3MOCK_STORE_INITIAL_BUCKETS=rapidauth-avatars', 'adobe/s3mock:5.2.3']);
  s3Started = true;
  const mapping = run('docker', ['port', s3Container, '9090/tcp'], process.env, true);
  const port = mapping.split(':').at(-1);
  if (!port) throw new Error('Could not determine S3Mock host port.');
  const endpoint = `http://127.0.0.1:${port}`;
  await waitForS3(endpoint);
  run('docker', ['run', '-d', '--name', mailpitContainer, '-p', '127.0.0.1::1025', '-p', '127.0.0.1::8025', 'axllent/mailpit:v1.31.6']);
  mailpitStarted = true;
  const smtpPort = run('docker', ['port', mailpitContainer, '1025/tcp'], process.env, true).split(':').at(-1);
  const apiPort = run('docker', ['port', mailpitContainer, '8025/tcp'], process.env, true).split(':').at(-1);
  if (!smtpPort || !apiPort) throw new Error('Could not determine Mailpit host ports.');
  await waitForMailpit(`http://127.0.0.1:${apiPort}`);
  const env = {
    ...process.env,
    DATABASE_URL: databaseUrl,
    STORAGE_DRIVER: 'local',
    S3_ENDPOINT: endpoint,
    S3_REGION: 'us-east-1',
    S3_BUCKET: 'rapidauth-avatars',
    S3_ACCESS_KEY_ID: 's3mock-access-key',
    S3_SECRET_ACCESS_KEY: 's3mock-secret-key',
    S3_PUBLIC_URL: `${endpoint}/rapidauth-avatars`,
    S3_FORCE_PATH_STYLE: 'true',
    MAILPIT_SMTP_ADDRESS: `127.0.0.1:${smtpPort}`,
    MAILPIT_API_URL: `http://127.0.0.1:${apiPort}`,
  };
  run('bunx', ['playwright', 'test', ...process.argv.slice(2)], env);
}

try {
  await main();
} finally {
  if (s3Started) spawnSync('docker', ['rm', '-f', s3Container], { stdio: 'inherit' });
  if (mailpitStarted) spawnSync('docker', ['rm', '-f', mailpitContainer], { stdio: 'inherit' });
  if (process.env.CI !== 'true') {
    spawnSync('docker', [...compose, 'down', '-v'], { stdio: 'inherit' });
  }
}
