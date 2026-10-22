import { expect, test } from '@playwright/test';
import { spawnSync } from 'node:child_process';

// Mailpit comes from the CI `services:` block (localhost:1025 / :8025) or from
// scripts/test-e2e.ts, which exports MAILPIT_SMTP_ADDRESS and MAILPIT_API_URL.
const apiUrl = process.env.MAILPIT_API_URL ?? 'http://127.0.0.1:8025';
const smtpAddress = process.env.MAILPIT_SMTP_ADDRESS ?? '127.0.0.1:1025';

type MailpitMessage = { ID: string; Subject: string };

async function findMessages(to: string): Promise<MailpitMessage[]> {
  const response = await fetch(`${apiUrl}/api/v1/search?query=${encodeURIComponent(`to:${to}`)}`);
  expect(response.ok).toBe(true);
  return ((await response.json()) as { messages: MailpitMessage[] }).messages;
}

function sendEmail(to: string, code: string, address: string) {
  const env: NodeJS.ProcessEnv = { ...process.env };
  delete env.EMAIL_DELIVERY;
  delete env.RESEND_API_KEY;
  const result = spawnSync('bun', ['run', 'tests/e2e/helpers/send-mailpit-email.ts'], {
    encoding: 'utf8',
    env: { ...env, MAILPIT_SMTP_ADDRESS: address, E2E_MAIL_TO: to, E2E_MAIL_CODE: code },
  });
  return result.stdout.trim().split('\n').at(-1);
}

test('without RESEND_API_KEY the verification code reaches Mailpit', async () => {
  const to = `mailpit-${Date.now()}@e2e.invalid`;
  const code = '482913';

  expect(sendEmail(to, code, smtpAddress)).toBe('sent');

  await expect.poll(async () => (await findMessages(to)).length).toBe(1);
  const [message] = await findMessages(to);
  expect(message.Subject).toBe('Your verification code');
  const detail = (await (await fetch(`${apiUrl}/api/v1/message/${message.ID}`)).json()) as {
    HTML: string;
  };
  expect(detail.HTML).toContain(code);
});

test('an unreachable Mailpit ends in EmailDeliveryError', async () => {
  const output = sendEmail(`mailpit-down-${Date.now()}@e2e.invalid`, '111111', '127.0.0.1:1');
  expect(output).toMatch(/^error:(econnection|esocket|econnrefused)$/);
});
