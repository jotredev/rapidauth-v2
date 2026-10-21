import { prisma } from '@/lib/prisma';
import { reportError } from '@/lib/report-error';
import type { Prisma } from '@prisma/client';

export type OperationalLogLevel = 'info' | 'warn' | 'error' | 'critical';
export type OperationalLogSource = 'emails';
export type OperationalLogCode = 'email.delivery.sent' | 'email.delivery.failed';
export type EmailTemplate =
  | 'verification'
  | 'verification-code'
  | 'password-reset'
  | 'password-reset-code'
  | 'invitation'
  | 'account-deleted'
  | 'security-notice';

export interface BuildOperationalLogInput {
  level: OperationalLogLevel;
  source: OperationalLogSource;
  code: OperationalLogCode;
  userId?: string | null;
  metadata?: unknown;
}

export interface OperationalLogEntryData {
  level: OperationalLogLevel;
  source: OperationalLogSource;
  code: OperationalLogCode;
  userId?: string | null;
  metadata?: Prisma.InputJsonValue;
}

const VALID_TEMPLATES = new Set<string>([
  'verification',
  'verification-code',
  'password-reset',
  'password-reset-code',
  'invitation',
  'account-deleted',
  'security-notice',
]);

const ERROR_CODE_REGEX = /^[a-z0-9_.-]{1,64}$/;

export function buildOperationalLogEntry(
  input: BuildOperationalLogInput
): OperationalLogEntryData {
  let sanitizedMetadata: Record<string, unknown> | undefined;

  if (
    typeof input.metadata === 'object' &&
    input.metadata !== null &&
    !Array.isArray(input.metadata)
  ) {
    const meta = input.metadata as Record<string, unknown>;
    const clean: Record<string, unknown> = {};

    if (
      typeof meta.template === 'string' &&
      VALID_TEMPLATES.has(meta.template)
    ) {
      clean.template = meta.template;
    }

    if (
      typeof meta.durationMs === 'number' &&
      Number.isInteger(meta.durationMs) &&
      meta.durationMs >= 0
    ) {
      clean.durationMs = meta.durationMs;
    }

    if ('errorCode' in meta && meta.errorCode !== undefined) {
      if (
        typeof meta.errorCode === 'string' &&
        ERROR_CODE_REGEX.test(meta.errorCode)
      ) {
        clean.errorCode = meta.errorCode;
      } else {
        clean.errorCode = 'unknown';
      }
    }

    if (Object.keys(clean).length > 0) {
      sanitizedMetadata = clean;
    }
  }

  return {
    level: input.level,
    source: input.source,
    code: input.code,
    userId: input.userId ?? null,
    metadata: (sanitizedMetadata as Prisma.InputJsonValue) ?? undefined,
  };
}

export function createOperationalLogRecorder(
  write: (data: OperationalLogEntryData) => Promise<unknown>
) {
  return async function recordOperationalLog(
    input: BuildOperationalLogInput
  ): Promise<void> {
    try {
      const data = buildOperationalLogEntry(input);
      await write(data);
    } catch (error) {
      reportError(error, { area: 'operational-log.write' });
    }
  };
}

export const recordOperationalLog = createOperationalLogRecorder((data) =>
  prisma.operationalLog.create({
    data: {
      level: data.level,
      source: data.source,
      code: data.code,
      userId: data.userId,
      metadata: data.metadata,
    },
  })
);
