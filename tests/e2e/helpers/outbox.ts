import { readdir, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

export type OutboxMessage = {
  to: string;
  subject: string;
  html: string;
  url?: string;
  code?: string;
  sentAt: string;
};

export async function getOutboxMessages(to: string): Promise<OutboxMessage[]> {
  const directory = resolve(process.env.EMAIL_OUTBOX_DIR ?? '.e2e-outbox');
  const files = (await readdir(directory)).filter((file) => file.endsWith('.json'));
  const messages = await Promise.all(
    files.map(async (file) =>
      JSON.parse(await readFile(resolve(directory, file), 'utf8')) as OutboxMessage,
    ),
  );
  return messages.filter((item) => item.to === to).reverse();
}

export async function getOutboxMessage(to: string): Promise<OutboxMessage> {
  const message = (await getOutboxMessages(to))[0];
  if (!message) throw new Error(`No test email found for ${to}`);
  return message;
}
