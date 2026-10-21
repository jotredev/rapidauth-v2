import { Resend } from 'resend';
import { render } from 'react-email';
import {
  AccountDeletedEmail,
  InvitationEmail,
  PasswordResetCodeEmail,
  SecurityNoticeEmail,
  VerificationCodeEmail,
} from '@/emails';
import { siteConfig } from '@/config/site';
import { getPublicSupportEmail, SUPPORT_EMAIL_NOT_CONFIGURED } from '@/lib/support-email';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { reportError } from '@/lib/report-error';
import {
  recordOperationalLog,
  type EmailTemplate,
} from '@/lib/operational-log';

export class EmailDeliveryError extends Error {
  readonly errorCode: string;

  constructor(message: string, errorCode: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'EmailDeliveryError';
    this.errorCode = errorCode;
  }
}

const emailDelivery = process.env.EMAIL_DELIVERY ?? 'resend';
if (emailDelivery === 'outbox' && process.env.NODE_ENV === 'production') {
  throw new Error('EMAIL_DELIVERY=outbox is only available outside production.');
}

let resend: Resend | undefined;

function getResendClient() {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("RESEND_API_KEY is required to send email.");
  }

  resend ??= new Resend(apiKey);
  return resend;
}

const FROM_EMAIL =
  process.env.FROM_EMAIL ?? 'RapidAuth <onboarding@resend.dev>';

async function deliverEmail({
  to,
  subject,
  html,
  url,
  code,
  template,
  userId,
}: {
  to: string;
  subject: string;
  html: string;
  url?: string;
  code?: string;
  template: EmailTemplate;
  userId?: string;
}) {
  const startTime = performance.now();

  try {
    if (emailDelivery === 'outbox') {
      const localPart = to.split('@')[0] ?? '';
      if (localPart.endsWith('+delivery-fail')) {
        throw new EmailDeliveryError(
          'Outbox delivery forced failure for testing',
          'outbox_forced_failure',
        );
      }

      const directory = process.env.EMAIL_OUTBOX_DIR ?? '.e2e-outbox';
      await mkdir(directory, { recursive: true });
      const filename = `${Date.now()}-${randomUUID()}.json`;
      const outboxPayload: Record<string, unknown> = {
        to,
        subject,
        html,
        ...(url !== undefined ? { url } : {}),
        ...(code !== undefined ? { code } : {}),
        sentAt: new Date().toISOString(),
      };
      await writeFile(
        join(directory, filename),
        JSON.stringify(outboxPayload, null, 2),
        { encoding: 'utf8', mode: 0o600 },
      );
    } else {
      let sendResult;
      try {
        sendResult = await getResendClient().emails.send({
          from: FROM_EMAIL,
          to,
          subject,
          html,
        });
      } catch (error) {
        throw new EmailDeliveryError(
          'Failed to send email',
          'exception',
          { cause: error },
        );
      }

      if (sendResult.error) {
        const errorCode =
          typeof sendResult.error.name === 'string' && sendResult.error.name.trim()
            ? sendResult.error.name.toLowerCase()
            : 'unknown';
        throw new EmailDeliveryError(
          'Failed to send email',
          errorCode,
          { cause: sendResult.error },
        );
      }
    }

    const durationMs = Math.max(0, Math.round(performance.now() - startTime));
    await recordOperationalLog({
      level: 'info',
      source: 'emails',
      code: 'email.delivery.sent',
      userId,
      metadata: { template, durationMs },
    });
  } catch (error) {
    const durationMs = Math.max(0, Math.round(performance.now() - startTime));
    const deliveryError =
      error instanceof EmailDeliveryError
        ? error
        : new EmailDeliveryError('Failed to send email', 'exception', { cause: error });

    reportError(deliveryError, { area: 'email.delivery' });

    await recordOperationalLog({
      level: 'error',
      source: 'emails',
      code: 'email.delivery.failed',
      userId,
      metadata: {
        template,
        durationMs,
        errorCode: deliveryError.errorCode,
      },
    });

    throw deliveryError;
  }
}

export async function sendVerificationCodeEmail({
  email,
  name,
  code,
  userId,
}: {
  email: string;
  name: string;
  code: string;
  userId?: string;
}) {
  const html = await render(
    VerificationCodeEmail({
      name,
      code,
    }),
  );

  await deliverEmail({
    to: email,
    subject: 'Your verification code',
    html,
    code,
    template: 'verification-code',
    userId,
  });
}

export async function sendPasswordResetCodeEmail({
  email,
  name,
  code,
  userId,
}: {
  email: string;
  name: string;
  code: string;
  userId?: string;
}) {
  const html = await render(
    PasswordResetCodeEmail({
      name,
      code,
    }),
  );

  await deliverEmail({
    to: email,
    subject: 'Your password reset code',
    html,
    code,
    template: 'password-reset-code',
    userId,
  });
}

export async function sendInvitationEmail({
  email,
  name,
  invitedByName,
  url,
  userId,
}: {
  email: string;
  name: string;
  invitedByName: string;
  url: string;
  userId?: string;
}) {
  const html = await render(
    InvitationEmail({
      name,
      invitedByName,
      appName: siteConfig.appName,
      invitationUrl: url,
    }),
  );

  await deliverEmail({
    to: email,
    subject: `You're invited to ${siteConfig.appName}`,
    html,
    url,
    template: 'invitation',
    userId,
  });
}

export async function sendAccountDeletedEmail({ email, name, deletedAt }: {
  email: string;
  name: string;
  deletedAt: string;
}) {
  const supportEmail = getPublicSupportEmail() ?? SUPPORT_EMAIL_NOT_CONFIGURED;
  const html = await render(AccountDeletedEmail({
    name,
    deletedAt,
    supportEmail,
    appName: siteConfig.appName,
  }));

  await deliverEmail({
    to: email,
    subject: 'Your account has been deleted',
    html,
    url: '',
    template: 'account-deleted',
  });
}

export type SecurityNoticeEvent =
  | 'password-changed'
  | 'password-reset'
  | 'temporary-password-created'
  | 'two-factor-enabled'
  | 'two-factor-disabled';

const securityNotices: Record<
  SecurityNoticeEvent,
  { subject: string; description: string }
> = {
  'password-changed': {
    subject: 'Your password was changed',
    description: `Your ${siteConfig.appName} password was changed`,
  },
  'password-reset': {
    subject: 'Your password was reset',
    description: `Your ${siteConfig.appName} password was reset`,
  },
  'temporary-password-created': {
    subject: 'A temporary password was created for your account',
    description: `A temporary password was created for your ${siteConfig.appName} account`,
  },
  'two-factor-enabled': {
    subject: 'Two-factor authentication was enabled',
    description: `Two-factor authentication was enabled for your ${siteConfig.appName} account`,
  },
  'two-factor-disabled': {
    subject: 'Two-factor authentication was disabled',
    description: `Two-factor authentication was disabled for your ${siteConfig.appName} account`,
  },
};

export async function sendSecurityNoticeEmail({
  to,
  userName,
  event,
  occurredAt,
  userId,
}: {
  to: string;
  userName: string;
  event: SecurityNoticeEvent;
  occurredAt: Date;
  userId?: string;
}) {
  const notice = securityNotices[event];
  const occurredAtUtc = `${occurredAt.toLocaleString('en-US', {
    dateStyle: 'long',
    timeStyle: 'short',
    timeZone: 'UTC',
  })} UTC`;
  const supportEmail = getPublicSupportEmail() ?? SUPPORT_EMAIL_NOT_CONFIGURED;
  const html = await render(
    SecurityNoticeEmail({
      name: userName,
      eventDescription: notice.description,
      occurredAt: occurredAtUtc,
      supportEmail,
      appName: siteConfig.appName,
    })
  );

  await deliverEmail({
    to,
    subject: notice.subject,
    html,
    url: '',
    template: 'security-notice',
    userId,
  });
}
