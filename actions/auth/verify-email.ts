'use server';

import * as z from 'zod';
import { headers } from 'next/headers';
import { APIError } from 'better-auth/api';
import { auth } from '@/lib/auth';
import { checkRateLimit, getClientIp, hashKey } from '@/lib/rate-limit';
import { reportError } from '@/lib/report-error';

const verifyEmailCodeSchema = z.object({
  email: z.string().trim().email(),
  code: z.string().trim().regex(/^\d{6}$/),
});

export const verifyEmailCodeAction = async (
  values: z.infer<typeof verifyEmailCodeSchema>
): Promise<{
  response: 'success' | 'error';
  message: string;
  data: null;
}> => {
  try {
    const parsed = verifyEmailCodeSchema.safeParse(values);

    if (!parsed.success) {
      return {
        response: 'error',
        message: 'Invalid fields',
        data: null,
      };
    }

    const { email, code } = parsed.data;
    const normalizedEmail = email.toLowerCase();
    const clientIp = await getClientIp();
    const rateLimit = await checkRateLimit([
      ...(clientIp
        ? [{ key: `verify-email-code:ip:${clientIp}`, window: 600, max: 10 }]
        : []),
      {
        key: `verify-email-code:email:${hashKey(normalizedEmail)}`,
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

    await auth.api.verifyEmailOTP({
      body: { email: normalizedEmail, otp: code },
      headers: await headers(),
    });

    return {
      response: 'success',
      message: 'Email verified successfully',
      data: null,
    };
  } catch (error) {
    if (error instanceof APIError) {
      console.error('Verify email code error:', error.message, error.status);
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
      if (
        error.status === 'FORBIDDEN' ||
        (error as { statusCode?: number }).statusCode === 403
      ) {
        return {
          response: 'error',
          message:
            error.message ||
            (error.body as { message?: string } | undefined)?.message ||
            'Accept your invitation from the email we sent you.',
          data: null,
        };
      }
      return {
        response: 'error',
        message: "We couldn't verify this code.",
        data: null,
      };
    }
    reportError(error, { area: 'auth.verify-email-code' });
    return {
      response: 'error',
      message: "We couldn't verify this code.",
      data: null,
    };
  }
};
