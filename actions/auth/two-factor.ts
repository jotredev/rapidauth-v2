'use server';

import * as z from 'zod';
import { auth } from '@/lib/auth';
import { cookies, headers } from 'next/headers';
import { APIError } from 'better-auth/api';
import { logActivity } from '@/lib/activity-log';
import { twoFactorSchema, verifyTotpSetupSchema } from '@/validations/auth';
import { checkRateLimit, getClientIp, hashKey } from '@/lib/rate-limit';
import { sendSecurityNoticeEmail } from '@/lib/email';
import { prisma } from '@/lib/prisma';
import { reportError } from '@/lib/report-error';

const checkTwoFactorRateLimit = async () => {
  const clientIp = await getClientIp();
  const cookieStore = await cookies();
  const challengeCookie =
    cookieStore.get('__Secure-better-auth.two_factor') ??
    cookieStore.get('better-auth.two_factor');

  return checkRateLimit([
    ...(clientIp ? [{ key: `2fa:ip:${clientIp}`, window: 60, max: 10 }] : []),
    ...(challengeCookie?.value
      ? [{ key: `2fa:challenge:${hashKey(challengeCookie.value)}`, window: 300, max: 5 }]
      : []),
  ]);
};

export const verifyTotpAction = async (
  values: z.infer<typeof twoFactorSchema>
): Promise<{
  response: 'success' | 'error';
  message: string;
  data: null;
}> => {
  try {
    const { success, data } = twoFactorSchema.safeParse(values);

    if (!success) {
      return {
        response: 'error',
        message: 'Invalid code',
        data: null,
      };
    }

    const { code } = data;
    const rateLimit = await checkTwoFactorRateLimit();

    if (rateLimit.limited) {
      return {
        response: 'error',
        message: `Too many attempts. Try again in ${rateLimit.retryAfter} seconds.`,
        data: null,
      };
    }

    await auth.api.verifyTOTP({
      body: { code },
      headers: await headers(),
    });

    return {
      response: 'success',
      message: 'Two-factor authentication verified',
      data: null,
    };
  } catch (error) {
    if (error instanceof APIError) {
      console.error('Verify TOTP error:', error.message);
      return {
        response: 'error',
        message: error.message ?? 'Invalid code',
        data: null,
      };
    }
    reportError(error, { area: 'auth.verify-totp' });
    return {
      response: 'error',
      message: 'An unexpected error occurred',
      data: null,
    };
  }
};

export const verifyBackupCodeAction = async (
  code: string
): Promise<{
  response: 'success' | 'error';
  message: string;
  data: null;
}> => {
  try {
    if (!code || code.trim().length === 0) {
      return {
        response: 'error',
        message: 'Backup code is required',
        data: null,
      };
    }

    const rateLimit = await checkTwoFactorRateLimit();

    if (rateLimit.limited) {
      return {
        response: 'error',
        message: `Too many attempts. Try again in ${rateLimit.retryAfter} seconds.`,
        data: null,
      };
    }

    await auth.api.verifyBackupCode({
      body: { code },
      headers: await headers(),
    });

    return {
      response: 'success',
      message: 'Backup code verified',
      data: null,
    };
  } catch (error) {
    if (error instanceof APIError) {
      console.error('Verify backup code error:', error.message);
      return {
        response: 'error',
        message: error.message ?? 'Invalid backup code',
        data: null,
      };
    }
    reportError(error, { area: 'auth.verify-backup-code' });
    return {
      response: 'error',
      message: 'An unexpected error occurred',
      data: null,
    };
  }
};

type Enable2FAData = {
  totpURI: string;
  backupCodes: string[];
};

export const enable2FAAction = async (
  password: string
): Promise<{
  response: 'success' | 'error';
  message: string;
  data: Enable2FAData | null;
}> => {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (session?.user?.id) {
      const rateLimit = await checkRateLimit([
        { key: `password-check:user:${session.user.id}`, window: 60, max: 5 },
      ]);

      if (rateLimit.limited) {
        return {
          response: 'error',
          message: `Too many attempts. Try again in ${rateLimit.retryAfter} seconds.`,
          data: null,
        };
      }
    }

    const result = await auth.api.enableTwoFactor({
      body: { password, method: 'totp' },
      headers: await headers(),
    });

    if (result.method !== 'totp') {
      return {
        response: 'error',
        message: 'Two-factor setup returned OTP mode; TOTP mode is required.',
        data: null,
      };
    }

    return {
      response: 'success',
      message: 'Two-factor authentication enabled',
      data: {
        totpURI: result.totpURI,
        backupCodes: result.backupCodes,
      },
    };
  } catch (error) {
    if (error instanceof APIError) {
      return {
        response: 'error',
        message: error.message ?? 'Failed to enable 2FA',
        data: null,
      };
    }
    return {
      response: 'error',
      message: 'An unexpected error occurred',
      data: null,
    };
  }
};

export const verify2FASetupAction = async (
  code: string
): Promise<{
  response: 'success' | 'error';
  message: string;
  data: null;
}> => {
  try {
    const { success, data } = verifyTotpSetupSchema.safeParse({ code });

    if (!success) {
      return {
        response: 'error',
        message: 'Invalid verification code',
        data: null,
      };
    }

    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user?.id) {
      return {
        response: 'error',
        message: 'An authenticated session is required to verify 2FA setup.',
        data: null,
      };
    }

    const rateLimit = await checkRateLimit([
      { key: `2fa-setup:user:${session.user.id}`, window: 60, max: 5 },
    ]);

    if (rateLimit.limited) {
      return {
        response: 'error',
        message: `Too many attempts. Try again in ${rateLimit.retryAfter} seconds.`,
        data: null,
      };
    }

    const twoFactor = await prisma.twoFactor.findFirst({
      where: { userId: session.user.id },
      select: { verified: true },
    });

    await auth.api.verifyTOTP({
      body: { code: data.code },
      headers: await headers(),
    });

    if (twoFactor && !twoFactor.verified) {
      await logActivity(session.user.id, '2fa_enabled');

      try {
        await sendSecurityNoticeEmail({
          to: session.user.email,
          userName: session.user.name,
          event: 'two-factor-enabled',
          occurredAt: new Date(),
          userId: session.user.id,
        });
      } catch (error) {
        reportError(error, { area: 'auth.two-factor-enabled-notice' });
      }
    }

    return {
      response: 'success',
      message: 'Two-factor authentication setup complete',
      data: null,
    };
  } catch (error) {
    if (error instanceof APIError) {
      return {
        response: 'error',
        message: error.message ?? 'Invalid verification code',
        data: null,
      };
    }
    return {
      response: 'error',
      message: 'An unexpected error occurred',
      data: null,
    };
  }
};

export const disable2FAAction = async (
  password: string
): Promise<{
  response: 'success' | 'error';
  message: string;
  data: null;
}> => {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (session?.user?.id) {
      const rateLimit = await checkRateLimit([
        { key: `password-check:user:${session.user.id}`, window: 60, max: 5 },
      ]);

      if (rateLimit.limited) {
        return {
          response: 'error',
          message: `Too many attempts. Try again in ${rateLimit.retryAfter} seconds.`,
          data: null,
        };
      }
    }

    await auth.api.disableTwoFactor({
      body: { password },
      headers: await headers(),
    });

    if (session?.user?.id) {
      await logActivity(session.user.id, '2fa_disabled');

      try {
        await sendSecurityNoticeEmail({
          to: session.user.email,
          userName: session.user.name,
          event: 'two-factor-disabled',
          occurredAt: new Date(),
          userId: session.user.id,
        });
      } catch (error) {
        reportError(error, { area: 'auth.two-factor-disabled-notice' });
      }
    }

    return {
      response: 'success',
      message: 'Two-factor authentication disabled',
      data: null,
    };
  } catch (error) {
    if (error instanceof APIError) {
      return {
        response: 'error',
        message: error.message ?? 'Failed to disable 2FA',
        data: null,
      };
    }
    return {
      response: 'error',
      message: 'An unexpected error occurred',
      data: null,
    };
  }
};

export const get2FAStatusAction = async (): Promise<{
  response: 'success' | 'error';
  message: string;
  data: { enabled: boolean } | null;
}> => {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    return {
      response: 'success',
      message: '2FA status retrieved',
      data: {
        enabled: session?.user?.twoFactorEnabled ?? false,
      },
    };
  } catch {
    return {
      response: 'error',
      message: 'Failed to get 2FA status',
      data: null,
    };
  }
};
