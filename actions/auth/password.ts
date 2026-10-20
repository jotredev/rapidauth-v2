'use server';

import * as z from 'zod';
import { auth } from '@/lib/auth';
import { headers } from 'next/headers';
import { APIError } from 'better-auth/api';
import { logActivity } from '@/lib/activity-log';
import {
  changePasswordSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
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

    await auth.api.requestPasswordReset({
      body: {
        email,
        redirectTo: '/auth/reset-password',
      },
      headers: await headers(),
    });

    return {
      response: 'success',
      message:
        "If an account exists for this email, we sent you an email. If it doesn't arrive in a few minutes, contact support.",
      data: { email },
    };
  } catch (error) {
    if (error instanceof APIError) {
      console.error('Forgot password error:', error.message);
      return {
        response: 'error',
        message: error.message ?? 'Failed to send reset link',
        data: null,
      };
    }
    reportError(error, { area: 'auth.forgot-password' });
    return {
      response: 'error',
      message: 'An unexpected error occurred',
      data: null,
    };
  }
};

export const resetPasswordAction = async (
  values: z.infer<typeof resetPasswordSchema> & { token: string }
): Promise<{
  response: 'success' | 'error';
  message: string;
  data: null;
}> => {
  try {
    const { success, data } = resetPasswordSchema.safeParse(values);

    if (!success) {
      return {
        response: 'error',
        message: 'Invalid fields',
        data: null,
      };
    }

    const { password } = data;

    await auth.api.resetPassword({
      body: {
        token: values.token,
        newPassword: password,
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
      console.error('Reset password error:', error.message);
      return {
        response: 'error',
        message: error.message ?? 'Failed to reset password',
        data: null,
      };
    }
    reportError(error, { area: 'auth.reset-password' });
    return {
      response: 'error',
      message: 'An unexpected error occurred',
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
