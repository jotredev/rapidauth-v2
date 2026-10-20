import { expect, test } from '@playwright/test';
import {
  buildOperationalLogEntry,
  createOperationalLogRecorder,
} from '../../lib/operational-log';

test.describe('buildOperationalLogEntry', () => {
  test('discards unknown keys such as to, url, or token', () => {
    const entry = buildOperationalLogEntry({
      level: 'info',
      source: 'emails',
      code: 'email.delivery.sent',
      userId: 'usr_123',
      metadata: {
        to: 'user@example.com',
        url: 'https://example.com/verify?token=secret123',
        token: 'secret123',
        template: 'verification',
        durationMs: 42,
      },
    });

    expect(entry.metadata).toEqual({
      template: 'verification',
      durationMs: 42,
    });
    const serialized = JSON.stringify(entry.metadata);
    expect(serialized).not.toContain('@');
    expect(serialized).not.toContain('example.com');
    expect(serialized).not.toContain('secret123');
  });

  test('converts an invalid errorCode into "unknown"', () => {
    const invalidCodes = [
      'UPPERCASE_NOT_ALLOWED',
      'spaces not allowed',
      'invalid@char',
      'toolong'.repeat(15),
      '',
      123,
      null,
    ];

    for (const code of invalidCodes) {
      const entry = buildOperationalLogEntry({
        level: 'error',
        source: 'emails',
        code: 'email.delivery.failed',
        metadata: {
          errorCode: code,
          template: 'password-reset',
        },
      });

      expect(entry.metadata).toEqual({
        errorCode: 'unknown',
        template: 'password-reset',
      });
    }
  });

  test('preserves valid template, durationMs, and valid errorCode', () => {
    const entry = buildOperationalLogEntry({
      level: 'error',
      source: 'emails',
      code: 'email.delivery.failed',
      userId: 'usr_abc',
      metadata: {
        template: 'invitation',
        durationMs: 150,
        errorCode: 'outbox_forced_failure',
      },
    });

    expect(entry.level).toBe('error');
    expect(entry.source).toBe('emails');
    expect(entry.code).toBe('email.delivery.failed');
    expect(entry.userId).toBe('usr_abc');
    expect(entry.metadata).toEqual({
      template: 'invitation',
      durationMs: 150,
      errorCode: 'outbox_forced_failure',
    });
  });

  test('discards invalid template and negative durationMs', () => {
    const entry = buildOperationalLogEntry({
      level: 'info',
      source: 'emails',
      code: 'email.delivery.sent',
      metadata: {
        template: 'invalid-template',
        durationMs: -10,
      },
    });

    expect(entry.metadata).toBeUndefined();
  });
});

test.describe('createOperationalLogRecorder', () => {
  test('does not throw when the write function throws an error', async () => {
    const recorder = createOperationalLogRecorder(async () => {
      throw new Error('Database connection failed');
    });

    await expect(
      recorder({
        level: 'info',
        source: 'emails',
        code: 'email.delivery.sent',
        metadata: { template: 'verification', durationMs: 10 },
      })
    ).resolves.toBeUndefined();
  });
});
