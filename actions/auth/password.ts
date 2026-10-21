'use server';

import * as z from 'zod';
import { auth } from '@/lib/auth';
import { headers } from 'next/headers';
import { APIError } from 'better-auth/api';
import { logActivity } from '@/lib/activity-log';
import {
  changePasswordSchema,
  forgotPasswordSchema,
  resetPasswordWithCodeSchema,
} from '@/validations/auth';
import { checkRateLimit, getClientIp, hashKey } from '@/lib/rate-limit';
import { verifyTurnstile } from '@/lib/turnstile';
import { sendSecurityNoticeEmail } from '@/lib/email';
import { prisma } from '@/lib/prisma';
import { reportError } from '@/lib/report-error';
import {
  hasExpiredTemporaryPassword,
  TEMPORARY_PASSWORD_EXPIRED_MESSAGE,
} from '@/lib/temporary-password';

type ForgotPasswordData = {
  email: string;
};

export const forgotPasswordAction = async (
  values: z.infer<typeof forgotPasswordSchema>,
  captchaToken?: string
): Promise<{
  response: 'success' | 'error';
  message: string;
  data: ForgotPasswordData | null;
}> => {
  try {
    const { success, data } = forgotPasswordSchema.safeParse(values);

    if (!success) {
      return {
        response: 'error',
        message: 'Invalid fields',
        data: null,
      };
    }

    const { email } = data;
    const clientIp = await getClientIp();
    const normalizedEmail = email.trim().toLowerCase();
    const ipRateLimit = clientIp
      ? await checkRateLimit([
          { key: `reset:ip:${clientIp}`, window: 600, max: 5 },
        ])
      : null;

    if (ipRateLimit?.limited) {
      return {
        response: 'error',
        message: `Too many attempts. Try again in ${ipRateLimit.retryAfter} seconds.`,
        data: null,
      };
    }

    if (!(await verifyTurnstile(captchaToken, 'forgot-password'))) {
      return {
        response: 'error',
        message: 'Captcha verification failed. Please try again.',
        data: null,
      };
    }

    const emailRateLimit = await checkRateLimit([
      { key: `reset:email:${hashKey(normalizedEmail)}`, window: 600, max: 3 },
    ]);

    if (emailRateLimit.limited) {
      return {
        response: 'error',
        message: `Too many attempts. Try again in ${emailRateLimit.retryAfter} seconds.`,
        data: null,
      };
    }

    await auth.api.requestPasswordResetEmailOTP({
      body: {
        email: normalizedEmail,
      },
      headers: await headers(),
    });

    return {
      response: 'success',
      message:
        "If an account exists for this email, we sent a code. If it doesn't arrive in a few minutes, contact support.",
      data: { email },
    };
  } catch (error) {
    reportError(error, { area: 'auth.forgot-password' });
    return {
      response: 'success',
      message:
        "If an account exists for this email, we sent a code. If it doesn't arrive in a few minutes, contact support.",
      data: { email: values.email },
    };
  }
};

export const resetPasswordWithCodeAction = async (
  values: z.infer<typeof resetPasswordWithCodeSchema>
): Promise<{
  response: 'success' | 'error';
  message: string;
  data: null;
}> => {
  try {
    const { success, data, error } =
      resetPasswordWithCodeSchema.safeParse(values);

    if (!success) {
      return {
        response: 'error',
        message: error.issues[0]?.message ?? 'Invalid fields',
        data: null,
      };
    }

    const { email, code, password } = data;
    const clientIp = await getClientIp();
    const normalizedEmail = email.trim().toLowerCase();
    const rateLimit = await checkRateLimit([
      ...(clientIp
        ? [{ key: `reset-password-code:ip:${clientIp}`, window: 600, max: 10 }]
        : []),
      {
        key: `reset-password-code:email:${hashKey(normalizedEmail)}`,
        window: 600,
        max: 10,
      },
    ]);

    if (rateLimit.limited) {
      return {
        response: 'error',
        message: `Too many attempts. Try again in ${rateLimit.retryAfter} seconds.`,
        data: null,
      };
    }

    // Better Auth 1.7.10 deletes expired verification rows during matchesUsableStoredOTP,
    // which makes atomicVerifyOTP throw INVALID_OTP instead of OTP_EXPIRED. Check expiration first.
    const latestVerification = await prisma.verification.findFirst({
      where: {
        identifier: `forget-password-otp-${normalizedEmail}`,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    if (latestVerification && latestVerification.expiresAt < new Date()) {
      return {
        response: 'error',
        message: 'This code has expired. Request a new one.',
        data: null,
      };
    }

    await auth.api.resetPasswordEmailOTP({
      body: {
        email: normalizedEmail,
        otp: code,
        password,
      },
      headers: await headers(),
    });

    return {
      response: 'success',
      message: 'Password reset successfully',
      data: null,
    };
  } catch (error) {
    if (error instanceof APIError) {
      console.error('Reset password code error:', error.message, error.status);
      const errorCode = (error.body as { code?: string } | undefined)?.code;
      if (errorCode === 'INVALID_OTP') {
        return {
          response: 'error',
          message: 'Invalid code.',
          data: null,
        };
      }
      if (errorCode === 'OTP_EXPIRED') {
        return {
          response: 'error',
          message: 'This code has expired. Request a new one.',
          data: null,
        };
      }
      if (errorCode === 'TOO_MANY_ATTEMPTS') {
        return {
          response: 'error',
          message: 'Too many attempts. Request a new code.',
          data: null,
        };
      }
    }
    reportError(error, { area: 'auth.reset-password-with-code' });
    return {
      response: 'error',
      message: "We couldn't reset your password with this code.",
      data: null,
    };
  }
};

export const changePasswordAction = async (
  values: z.infer<typeof changePasswordSchema>
): Promise<{
  response: 'success' | 'error';
  message: string;
  data: null;
}> => {
  try {
    const validation = changePasswordSchema.safeParse(values);

    if (!validation.success) {
      return {
        response: 'error',
        message: validation.error.issues[0]?.message ?? 'Invalid fields',
        data: null,
      };
    }

    const requestHeaders = await headers();
    const session = await auth.api.getSession({ headers: requestHeaders });

    if (!session?.user?.id) {
      return {
        response: 'error',
        message: 'Unauthorized',
        data: null,
      };
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        mustChangePassword: true,
        temporaryPasswordExpiresAt: true,
      },
    });

    if (user && hasExpiredTemporaryPassword(user)) {
      await auth.api.signOut({ headers: requestHeaders });
      return {
        response: 'error',
        message: TEMPORARY_PASSWORD_EXPIRED_MESSAGE,
        data: null,
      };
    }

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

    await auth.api.changePassword({
      body: {
        currentPassword: validation.data.currentPassword,
        newPassword: validation.data.newPassword,
        revokeOtherSessions: true,
      },
      headers: requestHeaders,
    });

    await prisma.user.update({
      where: { id: session.user.id },
      data: {
        mustChangePassword: false,
        temporaryPasswordExpiresAt: null,
      },
    });

    await logActivity(session.user.id, 'password_change');

    try {
      await sendSecurityNoticeEmail({
        to: session.user.email,
        userName: session.user.name,
        event: 'password-changed',
        occurredAt: new Date(),
        userId: session.user.id,
      });
    } catch (error) {
      reportError(error, { area: 'auth.password-change-notice' });
    }

    return {
      response: 'success',
      message: 'Password changed successfully',
      data: null,
    };
  } catch (error) {
    if (error instanceof APIError) {
      console.error('Change password error:', error.message);
      return {
        response: 'error',
        message: error.message ?? 'Failed to change password',
        data: null,
      };
    }
    reportError(error, { area: 'auth.change-password' });
    return {
      response: 'error',
      message: 'An unexpected error occurred',
      data: null,
    };
  }
};
