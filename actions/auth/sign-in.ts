'use server';

import * as z from 'zod';
import { auth } from '@/lib/auth';
import { headers } from 'next/headers';
import { APIError } from 'better-auth/api';
import { loginSchema } from '@/validations/auth';
import { checkRateLimit, getClientIp, hashKey } from '@/lib/rate-limit';
import { verifyTurnstile } from '@/lib/turnstile';
import { reportError } from '@/lib/report-error';
import { EmailDeliveryError } from '@/lib/email';

type SignInData = {
  twoFactorRequired?: boolean;
};

const e2eErrorReportingEnabled =
  process.env.NODE_ENV !== 'production' &&
  process.env.RAPIDAUTH_E2E_ERROR_REPORTING === 'true';

export const signInAction = async (
  values: z.infer<typeof loginSchema>
): Promise<{
  response: 'success' | 'error';
  message: string;
  data: SignInData | null;
}> => {
  try {
    const { success, data } = loginSchema.safeParse(values);

    if (!success) {
      return {
        response: 'error',
        message: 'Invalid fields',
        data: null,
      };
    }

    const { email, password } = data;
    if (
      e2eErrorReportingEnabled &&
      email.trim().toLowerCase() === 'sentry-error@e2e.invalid'
    ) {
      throw new Error('Synthetic E2E error for the reportError integration.');
    }
    const clientIp = await getClientIp();
    const normalizedEmail = email.trim().toLowerCase();
    const rateLimit = await checkRateLimit([
      ...(clientIp ? [{ key: `signin:ip:${clientIp}`, window: 60, max: 10 }] : []),
      { key: `signin:email:${hashKey(normalizedEmail)}`, window: 60, max: 5 },
    ]);

    if (rateLimit.limited) {
      return {
        response: 'error',
        message: `Too many attempts. Try again in ${rateLimit.retryAfter} seconds.`,
        data: null,
      };
    }

    const result = await auth.api.signInEmail({
      body: { email, password },
      headers: await headers(),
    });

    if ('twoFactorRedirect' in result && result.twoFactorRedirect) {
      return {
        response: 'success',
        message: 'Two-factor authentication required',
        data: { twoFactorRequired: true },
      };
    }

    return {
      response: 'success',
      message: 'Login successful',
      data: null,
    };
  } catch (error) {
    if (error instanceof APIError) {
      console.error('Sign in error:', error.message, error.status);
      return {
        response: 'error',
        message: error.message ?? 'Invalid credentials',
        data: null,
      };
    }
    reportError(error, { area: 'auth.sign-in' });
    return {
      response: 'error',
      message: 'An unexpected error occurred',
      data: null,
    };
  }
};

export const resendVerificationEmailAction = async (
  email: string,
  captchaToken?: string
): Promise<{
  response: 'success' | 'error';
  message: string;
  data: null;
}> => {
  try {
    const emailValidation = z.string().email().safeParse(email);

    if (!emailValidation.success) {
      return {
        response: 'error',
        message: 'Invalid fields',
        data: null,
      };
    }

    const clientIp = await getClientIp();
    const normalizedEmail = email.trim().toLowerCase();
    const ipRateLimit = clientIp
      ? await checkRateLimit([
          { key: `verify-email:ip:${clientIp}`, window: 600, max: 5 },
        ])
      : null;

    if (ipRateLimit?.limited) {
      return {
        response: 'error',
        message: `Too many attempts. Try again in ${ipRateLimit.retryAfter} seconds.`,
        data: null,
      };
    }

    if (!(await verifyTurnstile(captchaToken, 'resend-verification'))) {
      return {
        response: 'error',
        message: 'Captcha verification failed. Please try again.',
        data: null,
      };
    }

    const emailRateLimit = await checkRateLimit([
      { key: `verify-email:email:${hashKey(normalizedEmail)}`, window: 600, max: 3 },
    ]);

    if (emailRateLimit.limited) {
      return {
        response: 'error',
        message: `Too many attempts. Try again in ${emailRateLimit.retryAfter} seconds.`,
        data: null,
      };
    }

    await auth.api.sendVerificationEmail({
      body: {
        email,
        callbackURL: '/auth/verify-email',
      },
      headers: await headers(),
    });

    return {
      response: 'success',
      message:
        "If an account exists for this email, we sent you an email. If it doesn't arrive in a few minutes, contact support.",
      data: null,
    };
  } catch (error) {
    if (error instanceof EmailDeliveryError) {
      return {
        response: 'success',
        message:
          "If an account exists for this email, we sent you an email. If it doesn't arrive in a few minutes, contact support.",
        data: null,
      };
    }
    if (error instanceof APIError) {
      return {
        response: 'error',
        message: error.message ?? 'Failed to send verification email',
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
